import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const baseUrl = process.env.ADMIN_CONSOLE_URL;
const endpoint = process.env.GRAPHQL_ENDPOINT;
const seconds = Number(process.env.STRESS_DURATION_SECONDS || 5);
const maxP95Ms = Number(process.env.STRESS_MAX_P95_MS || 2000);
assert(baseUrl && endpoint, 'Run with npm run test:stress to start the local gateway stack');
assert(Number.isFinite(seconds) && seconds >= 1 && seconds <= 300, 'STRESS_DURATION_SECONDS must be between 1 and 300');
assert(Number.isFinite(maxP95Ms) && maxP95Ms > 0, 'STRESS_MAX_P95_MS must be positive');

async function signIn(role) {
  const response = await fetch(`${process.env.FIREBASE_AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env[`E2E_${role}_EMAIL`], password: process.env[`E2E_${role}_PASSWORD`], returnSecureToken: true }),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  assert(response.ok && result.idToken, 'Could not sign into Firebase Auth emulator');
  return result.idToken;
}
const admin = await signIn('ADMIN_FINANCE');
const viewer = await signIn('VIEWER');

function graphql(query, token, expectedStatus = 200, verify = () => {}) {
  return async () => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query }), signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    assert.equal(response.status, expectedStatus);
    if (expectedStatus === 200) assert.equal(payload.errors, undefined, JSON.stringify(payload.errors));
    verify(payload);
  };
}
const federated = graphql('{ orders { id pet { id name } customer { id email tier } } }', admin, 200, payload => {
  assert(payload.data.orders.length > 0);
  for (const order of payload.data.orders) {
    assert(order.id && order.pet.id && order.pet.name && order.customer.id && order.customer.email && order.customer.tier);
  }
});
const stages = [
  {
    name: 'health-under-concurrency', concurrency: 10,
    request: async () => {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'ok');
    },
  },
  { name: 'federation-ramp-4', concurrency: 4, request: federated },
  { name: 'federation-ramp-20', concurrency: 20, request: federated },
  { name: 'federation-burst-40', concurrency: 40, request: federated },
  {
    name: 'mutation-burst', concurrency: 20,
    request: graphql('mutation { updateOrder(id: "o1", input: { status: "PENDING", total: 201 }) { id status total } }', admin, 200, payload => {
      assert.deepEqual(payload.data.updateOrder, { id: 'o1', status: 'PENDING', total: 201 });
    }),
  },
  {
    name: 'anonymous-access-denied', concurrency: 20,
    request: graphql('{ pets { id } }', '', 401, payload => assert.equal(payload.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')),
  },
  {
    name: 'insufficient-role-denied', concurrency: 20,
    request: graphql('{ financeReport }', viewer, 403, payload => assert.equal(payload.errors?.[0]?.extensions?.code, 'FORBIDDEN')),
  },
];
const results = [];
try {
  for (const stage of stages) {
    const started = performance.now();
    const deadline = started + seconds * 1000;
    const latencies = [];
    let failures = 0;
    const errors = [];
    await Promise.all(Array.from({ length: stage.concurrency }, async () => {
      do {
        const requestStarted = performance.now();
        try { await stage.request(); }
        catch (error) { failures += 1; if (errors.length < 3) errors.push(error.message); }
        latencies.push(performance.now() - requestStarted);
      } while (performance.now() < deadline);
    }));
    latencies.sort((a, b) => a - b);
    const percentile = p => Number(latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)].toFixed(2));
    const durationSeconds = (performance.now() - started) / 1000;
    const result = {
      name: stage.name, concurrency: stage.concurrency, requests: latencies.length, failures,
      requestsPerSecond: Number((latencies.length / durationSeconds).toFixed(2)),
      durationSeconds: Number(durationSeconds.toFixed(2)),
      p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), errors,
    };
    result.passed = failures === 0 && latencies.length >= 20 && result.p95Ms <= maxP95Ms;
    results.push(result);
    console.log(JSON.stringify(result));
  }
  // A saturated gateway must still serve a correct federated response afterwards.
  await federated();
} catch (error) {
  results.push({ name: 'recovery', passed: false, errors: [error.message] });
} finally {
  const passed = results.length >= stages.length && results.every(result => result.passed);
  await mkdir('reports/raw', { recursive: true });
  await writeFile('reports/raw/stress.json', JSON.stringify({
    passed, thresholds: { maxP95Ms, maxFailures: 0, minRequestsPerStage: 20 },
    durationPerStageSeconds: seconds, stages: results,
    note: 'Local CI smoke stress test with closed-loop concurrency; this is not a production capacity measurement.',
  }, null, 2));
  assert(passed, 'Gateway stress thresholds failed; see reports/raw/stress.json');
}
