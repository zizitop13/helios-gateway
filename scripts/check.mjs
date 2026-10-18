import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const checks = [
  ['lint', ['run', 'lint', '--', '--format', 'json', '--output-file', 'reports/raw/lint.json']],
  ['analysis', ['run', 'analyze', '--', '--format', 'json', '--output-file', 'reports/raw/analysis.json']],
  ['build', ['run', 'build']],
  ['unit', ['run', 'test:unit']],
  ['mutation', ['run', 'test:mutation']],
  ['e2e', ['run', 'test:e2e']],
  ['stress', ['run', 'test:stress']],
];
const selected = process.argv.slice(2);
for (const name of selected) if (!checks.some(([check]) => name === check)) throw new Error(`Unknown check: ${name}`);
await mkdir('reports/raw', { recursive: true });
const results = [];
const startedAt = new Date().toISOString();
const runId = process.env.REPORT_RUN_ID || `${startedAt.replace(/[:.]/g, '-')}-build-${process.env.GITHUB_RUN_NUMBER || 'local'}-attempt-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
if (!/^[\w.-]+$/.test(runId)) throw new Error('Invalid REPORT_RUN_ID');
// Remove stale machine reports so a failed check cannot inherit a previous success.
const outputs = {
  lint: 'reports/raw/lint.json', analysis: 'reports/raw/analysis.json',
  unit: 'gateway/reports/unit.json', mutation: 'gateway/reports/mutation',
  e2e: 'testing/e2e/playwright-report', stress: 'reports/raw/stress.json',
};
for (const [name, args] of checks.filter(([name]) => selected.length === 0 || selected.includes(name))) {
  if (outputs[name]) await rm(outputs[name], { recursive: true, force: true });
  const log = createWriteStream(`reports/raw/${name}.log`);
  const start = Date.now();
  console.log(`\nRunning ${name}...`);
  const child = spawn('npm', args, { cwd: root, env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  child.stdout.on('data', data => { process.stdout.write(data); log.write(data); });
  child.stderr.on('data', data => { process.stderr.write(data); log.write(data); });
  const exitCode = await new Promise(done => {
    child.once('error', error => { log.write(`${error.stack}\n`); done(1); });
    child.once('exit', code => done(code ?? 1));
  });
  await new Promise(done => log.end(done));
  results.push({ name, exitCode, passed: exitCode === 0, durationSeconds: Number(((Date.now() - start) / 1000).toFixed(2)) });
  await writeFile('reports/raw/checks.json', JSON.stringify({ runId, startedAt, results }, null, 2));
}
const { generateReports } = await import('./reports.mjs');
await generateReports();
process.exitCode = results.some(result => !result.passed) ? 1 : 0;
