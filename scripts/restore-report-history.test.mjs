import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { archiveReports } from './archive-reports.mjs';

const restoreScript = fileURLToPath(new URL('./restore-report-history.sh', import.meta.url));
const identity = ['-c', 'user.name=Report test', '-c', 'user.email=reports@example.test'];
const git = (cwd, ...args) => execFileSync('git', [...identity, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'helios-report-history-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const remote = join(directory, 'origin.git');
  const seed = join(directory, 'seed');
  const checkout = join(directory, 'checkout');
  git(directory, 'init', '--bare', '--initial-branch=main', remote);
  git(directory, 'clone', remote, seed);
  await mkdir(join(seed, 'docs'));
  await writeFile(join(seed, 'docs', 'index.md'), 'Documentation must remain unchanged.\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'Initial docs');
  git(seed, 'branch', 'ci/quality-reports');
  git(seed, 'push', 'origin', 'main', 'ci/quality-reports');
  git(directory, 'clone', '--depth=1', pathToFileURL(remote).href, checkout);
  const head = git(checkout, 'rev-parse', 'HEAD');
  return { directory, remote, checkout, head, history: join(checkout, '.report-history') };
}

function restore(checkout) {
  return spawnSync('bash', [restoreScript], { cwd: checkout, encoding: 'utf8' });
}

test('first publication ignores ci/quality-reports and preserves the source checkout', async t => {
  const { checkout, history, head } = await fixture(t);
  assert.match(git(checkout, 'ls-remote', '--exit-code', '--heads', 'origin', 'quality-reports'), /refs\/heads\/ci\/quality-reports$/);
  const result = restore(checkout);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(history, 'symbolic-ref', '--short', 'HEAD'), 'quality-reports');
  assert.equal(existsSync(join(history, 'docs')), false);
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);
  assert.equal(await readFile(join(checkout, 'docs/index.md'), 'utf8'), 'Documentation must remain unchanged.\n');
});

test('a later deployment restores earlier builds and retains them when adding a new report', async t => {
  const { directory, checkout, history, head } = await fixture(t);
  const incoming = join(directory, 'incoming');
  async function addReport(number) {
    const runId = `2026-10-18T12-00-00-000Z-build-${number}-attempt-1`;
    const runDirectory = join(incoming, runId);
    await mkdir(runDirectory, { recursive: true });
    await writeFile(join(runDirectory, 'run.json'), JSON.stringify({
      runId, startedAt: `2026-10-18T12:0${number}:00.000Z`, buildNumber: String(number), attempt: '1', passed: true, commit: head,
    }));
    await writeFile(join(runDirectory, `summary-${runId}.html`), `<h1>Build ${number}</h1>`);
    await archiveReports(incoming, join(history, 'reports'));
    return runId;
  }
  const first = restore(checkout);
  assert.equal(first.status, 0, first.stderr);
  const firstRun = await addReport(1);
  git(history, 'add', 'reports');
  git(history, 'commit', '-m', 'Archive build 1');
  git(history, 'push', 'origin', 'HEAD:refs/heads/quality-reports');
  git(checkout, 'worktree', 'remove', '.report-history');
  const second = restore(checkout);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(join(history, 'reports', firstRun, `summary-${firstRun}.html`), 'utf8'), '<h1>Build 1</h1>');
  const secondRun = await addReport(2);
  const index = await readFile(join(history, 'reports/index.html'), 'utf8');
  assert(index.includes(firstRun) && index.includes(secondRun));
  await archiveReports(incoming, join(history, 'reports'));
  assert.equal(await readFile(join(history, 'reports/index.html'), 'utf8'), index);
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);
});

test('an unreachable remote fails without creating an empty report history', async t => {
  const { directory, checkout, history } = await fixture(t);
  git(checkout, 'remote', 'set-url', 'origin', join(directory, 'missing.git'));
  const result = restore(checkout);
  assert.notEqual(result.status, 0);
  assert.notEqual(result.status, 2);
  assert.equal(existsSync(history), false);
});
