import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(resolve(root, 'gateway/package.json'));
const admin = require('firebase-admin');
const mode = process.argv[2];
if (!['e2e', 'stress'].includes(mode)) throw new Error('Usage: node testing/local/run.mjs e2e|stress');

const project = 'demo-helios';
const baseUrl = 'http://127.0.0.1:4400';
const emulatorUrl = 'http://127.0.0.1:9099';
const logDir = resolve(root, 'reports/local', mode);
await mkdir(logDir, { recursive: true });
const roles = {
  VIEWER: ['viewer'], STAFF: ['staff'], SUPPORT: ['support'], ADMIN_FINANCE: ['admin', 'finance'],
};
const env = {
  ...process.env,
  NODE_ENV: 'test',
  GCLOUD_PROJECT: project,
  FIREBASE_PROJECT_ID: project,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_AUTH_EMULATOR_URL: emulatorUrl,
  FIREBASE_WEB_API_KEY: 'demo-api-key',
  GRAPHQL_ENDPOINT: `${baseUrl}/graphql`,
  ADMIN_CONSOLE_URL: baseUrl,
  ADMIN_CONSOLE_FIREBASE_API_KEY: 'demo-api-key',
  ADMIN_CONSOLE_FIREBASE_PROJECT_ID: project,
  ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
  ADMIN_CONSOLE_FIREBASE_APP_ID: 'demo-app-id',
  ADMIN_CONSOLE_FIREBASE_AUTH_EMULATOR_URL: emulatorUrl,
  DISCOVERY_MODE: 'file',
  DISCOVERY_FILE_PATH: resolve(logDir, 'subgraphs.yaml'),
  DISCOVERY_FILE_DEFAULT_HOST: '127.0.0.1',
  ADMIN_CONSOLE_ENABLED: 'true',
  ENABLE_APOLLO_SANDBOX: 'true',
  ENABLE_SCHEMA_REFRESH: 'true',
  SCHEMA_REFRESH_INTERVAL_SECONDS: '5',
  ENABLE_CLOUD_RUN_IAM_AUTH: 'false',
  PORT: '4400',
};
for (const role of Object.keys(roles)) {
  env[`E2E_${role}_EMAIL`] = `${role.toLowerCase()}@example.test`;
  env[`E2E_${role}_PASSWORD`] = 'local-test-password';
}
// Never use a developer's credentials for this isolated fixture stack.
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.FIREBASE_SERVICE_ACCOUNT_KEY;
delete env.SUPER_ADMIN_ID;

const children = [];
function start(name, command, args, options = {}) {
  const log = createWriteStream(resolve(logDir, `${name}.log`));
  const child = spawn(command, args, {
    cwd: root, env, detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', ...options,
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on('error', error => log.write(`${error.stack}\n`));
  children.push({ child, log, name });
  return child;
}

async function waitFor(name, url, options = {}, validate = response => response.ok) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const failed = children.find(({ child }) => child.exitCode !== null || child.signalCode !== null);
    if (failed) throw new Error(`${failed.name} exited early. See ${logDir}/${failed.name}.log`);
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(2000) });
      const ready = await validate(response);
      await response.body?.cancel();
      if (ready) return;
    } catch { /* Service is still starting. */ }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${name}. See ${logDir}`);
}

let cleanupPromise;
function cleanup() {
  return cleanupPromise ??= (async () => {
    for (const { child } of children.toReversed()) {
      if (child.exitCode === null && child.pid) {
        if (process.platform === 'win32') child.kill('SIGTERM');
        else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ } }
      }
    }
    await Promise.all(children.map(async ({ child, log }) => {
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([new Promise(done => child.once('exit', done)), delay(5000)]);
      }
      if (child.exitCode === null && child.signalCode === null && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
      }
      log.end();
    }));
  })();
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await cleanup(); process.exit(signal === 'SIGINT' ? 130 : 143); });
}

try {
  start('firebase', process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--only', 'auth', '--project', project, '--config', 'testing/local/firebase.json']);
  await waitFor('Firebase Auth emulator', `${emulatorUrl}/emulator/v1/projects/${project}/config`);
  Object.assign(process.env, { FIREBASE_AUTH_EMULATOR_HOST: env.FIREBASE_AUTH_EMULATOR_HOST });
  const app = admin.initializeApp({ projectId: project }, `quality-${mode}`);
  try {
    for (const [role, claims] of Object.entries(roles)) {
      const user = await app.auth().createUser({ uid: role.toLowerCase(), email: env[`E2E_${role}_EMAIL`], password: env[`E2E_${role}_PASSWORD`], emailVerified: true });
      await app.auth().setCustomUserClaims(user.uid, { roles: claims });
    }
  } finally { await app.delete(); }

  const services = ['pets', 'orders', 'customers', 'broken'];
  await writeFile(env.DISCOVERY_FILE_PATH, JSON.stringify({ services: services.map((name, i) => ({ name: `${name}-service`, port: 5001 + i })) }));
  for (const [i, service] of services.entries()) {
    start(service, process.execPath, ['src/index.js'], { cwd: resolve(root, `testing/services/${service}-service`), env: { ...env, PORT: String(5001 + i) } });
  }
  await Promise.all(services.map((name, i) => waitFor(name, `http://127.0.0.1:${5001 + i}/graphql`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query __ApolloGetServiceDefinition__ { _service { sdl } }' }),
  })));
  start('gateway', process.execPath, ['gateway/dist/main.js']);
  await waitFor('gateway', `${baseUrl}/health`);
  await waitFor('composed GraphQL schema', env.GRAPHQL_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ pets { id } }' }),
  }, response => response.status === 401);

  console.log(`Local stack ready for ${mode}. Logs: ${logDir}`);
  const command = mode === 'e2e'
    ? ['npm', ['--prefix', 'testing/e2e', 'run', 'e2e:test']]
    : [process.execPath, ['testing/stress/gateway.mjs']];
  const test = spawn(command[0], command[1], { cwd: root, env, stdio: 'inherit', detached: process.platform !== 'win32', shell: process.platform === 'win32' });
  children.push({ child: test, log: { end() {} }, name: mode });
  const code = await new Promise((done, reject) => { test.once('error', reject); test.once('exit', (status) => done(status ?? 1)); });
  process.exitCode = code;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
