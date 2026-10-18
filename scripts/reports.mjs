import { stripVTControlCharacters } from 'node:util';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml, page, table } from './report-html.mjs';
import { indexReports } from './archive-reports.mjs';

const root = resolve(import.meta.dirname, '..');
const names = ['lint', 'analysis', 'build', 'unit', 'mutation', 'e2e', 'stress'];
async function readJson(path) {
  try { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function copyIfPresent(source, destination) {
  try { await cp(resolve(root, source), destination, { recursive: true }); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function lintDetails(data) {
  return table(['File', 'Line', 'Rule', 'Finding'], data.flatMap(file => file.messages.map(message => [file.filePath.replace(`${root}/`, ''), message.line, message.ruleId, message.message])));
}

function unitDetails(data, coverage) {
  const counts = table(['Passed', 'Failed', 'Skipped', 'Suites'], [[data.numPassedTests, data.numFailedTests, data.numPendingTests, data.numTotalTestSuites]]);
  const tests = table(['Test', 'Status', 'Duration (ms)'], data.testResults.flatMap(suite => suite.assertionResults.map(test => [test.fullName, test.status, test.duration])));
  const failures = data.testResults.filter(suite => suite.message).map(suite => `<pre>${escapeHtml(suite.message)}</pre>`).join('');
  const totals = coverage?.total;
  return counts + (totals ? `<h2>Coverage</h2>${table(['Statements %', 'Branches %', 'Functions %', 'Lines %'], [[totals.statements.pct, totals.branches.pct, totals.functions.pct, totals.lines.pct]])}` : '') + `<h2>Tests</h2>${tests}${failures}`;
}

function mutationDetails(data) {
  const totals = {};
  const rows = Object.entries(data.files).map(([file, value]) => {
    const statuses = {};
    for (const mutant of value.mutants) {
      statuses[mutant.status] = (statuses[mutant.status] || 0) + 1;
      totals[mutant.status] = (totals[mutant.status] || 0) + 1;
    }
    return [file, value.mutants.length, statuses.Killed || 0, statuses.Timeout || 0, statuses.Survived || 0, statuses.NoCoverage || 0];
  });
  const detected = (totals.Killed || 0) + (totals.Timeout || 0);
  const valid = detected + (totals.Survived || 0) + (totals.NoCoverage || 0);
  const score = valid ? (100 * detected / valid).toFixed(2) : 'N/A';
  return `<p>Mutation score: <strong>${escapeHtml(score)}%</strong>. CI requires at least 60%. Timeouts count as detected; uncovered mutants count against the score. Compile/runtime errors are excluded.</p>${table(['File', 'Mutants', 'Killed', 'Timeout', 'Survived', 'No coverage'], rows)}`;
}

async function detailsFor(result) {
    let body = '';
    if (result.name === 'lint' || result.name === 'analysis') {
      const data = await readJson(`reports/raw/${result.name}.json`);
      body = data ? lintDetails(data) : '<p>No analyzer output was produced.</p>';
    } else if (result.name === 'unit') {
      const data = await readJson('gateway/reports/unit.json');
      if (data) body = unitDetails(data, await readJson('gateway/coverage/coverage-summary.json'));
    } else if (result.name === 'mutation') {
      const data = await readJson('gateway/reports/mutation/mutation.json');
      if (data) body = mutationDetails(data);
    } else if (result.name === 'stress') {
      const data = await readJson('reports/raw/stress.json');
      if (data) body = `<p>${escapeHtml(data.note)}</p><p>Thresholds: p95 ≤ ${escapeHtml(data.thresholds.maxP95Ms)} ms, zero failures, ≥ 20 requests per stage.</p>${table(['Stage', 'Concurrency', 'Requests', 'Failures', 'Req/s', 'p50 ms', 'p95 ms', 'p99 ms', 'Result'], data.stages.map(stage => [stage.name, stage.concurrency, stage.requests, stage.failures, stage.requestsPerSecond, stage.p50Ms, stage.p95Ms, stage.p99Ms, stage.passed ? 'PASS' : 'FAIL']))}`;
      if (data) body += `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }
    return body;
}

async function writeCheckReport(result, run, directory, metadata, nativeLinks) {
    const body = await detailsFor(result);
    let log = result.reason || '';
    try { log += await readFile(resolve(root, `reports/raw/${result.name}.log`), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const native = nativeLinks[result.name] ? `<p><a href="${nativeLinks[result.name]}">Open detailed ${escapeHtml(result.name)} report</a></p>` : '';
    await writeFile(resolve(directory, `${result.name}-${run.runId}.html`), page(`${result.name}: ${result.passed ? 'PASS' : 'FAIL'}`, `${metadata}<p><a href="summary-${run.runId}.html">All checks</a> · Duration: ${result.durationSeconds}s · Exit code: ${escapeHtml(result.exitCode ?? 'not completed')}</p>${native}${body}<details><summary>Full check log</summary><pre>${escapeHtml(stripVTControlCharacters(log))}</pre></details>`));
}

export async function generateReports({ finalize = false } = {}) {
  let run = await readJson('reports/raw/checks.json');
  if (!run) {
    const startedAt = new Date().toISOString();
    run = { startedAt, runId: `${startedAt.replace(/[:.]/g, '-')}-build-${process.env.GITHUB_RUN_NUMBER || 'local'}-attempt-${process.env.GITHUB_RUN_ATTEMPT || '1'}`, results: [] };
  }
  if (!/^[\w.-]+$/.test(run.runId)) throw new Error('Invalid report run ID');
  if (finalize) {
    for (const name of names) if (!run.results.some(result => result.name === name)) {
      run.results.push({ name, passed: false, exitCode: null, durationSeconds: 0, reason: 'Check did not finish. Inspect workflow setup and timeout logs.' });
    }
  }
  run.buildNumber = process.env.GITHUB_RUN_NUMBER || 'local';
  run.attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
  run.commit = process.env.GITHUB_SHA || '';
  run.passed = run.results.length === names.length && run.results.every(result => result.passed);
  const directory = resolve(root, 'reports/site', run.runId);
  await mkdir(directory, { recursive: true });
  const nativeLinks = {};
  if (await copyIfPresent('gateway/coverage', resolve(directory, 'coverage'))) nativeLinks.unit = 'coverage/index.html';
  if (await copyIfPresent('gateway/reports/mutation', resolve(directory, 'mutation'))) nativeLinks.mutation = 'mutation/index.html';
  if (await copyIfPresent('testing/e2e/playwright-report', resolve(directory, 'playwright'))) nativeLinks.e2e = 'playwright/index.html';
  await copyIfPresent('reports/local', resolve(directory, 'fixture-logs'));

  const metadata = `<p>UTC: ${escapeHtml(run.startedAt)} · build ${escapeHtml(run.buildNumber)} · attempt ${escapeHtml(run.attempt)}<br>Commit: <code>${escapeHtml(run.commit)}</code></p>`;
  for (const result of run.results) {
    await writeCheckReport(result, run, directory, metadata, nativeLinks);
  }
  const links = run.results.map(result => `<li><a href="${result.name}-${run.runId}.html">${escapeHtml(result.name)}</a> — <span class="${result.passed ? 'pass' : 'fail'}">${result.passed ? 'PASS' : 'FAIL'}</span> (${result.durationSeconds}s)</li>`).join('');
  await writeFile(resolve(directory, `summary-${run.runId}.html`), page(`Build ${run.buildNumber}: ${run.passed ? 'PASS' : 'FAIL'}`, `${metadata}<p><a href="../index.html">Report history</a></p><ul>${links}</ul>`));
  await writeFile(resolve(directory, 'run.json'), JSON.stringify(run, null, 2));
  await indexReports(resolve(root, 'reports/site'));
  if (process.env.GITHUB_STEP_SUMMARY && finalize) {
    const url = `https://zizitop13.github.io/helios-gateway/reports/${run.runId}/summary-${run.runId}.html`;
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `Quality checks: **${run.passed ? 'PASS' : 'FAIL'}**\n\n| Check | Result | Seconds |\n| --- | --- | --- |\n${run.results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.durationSeconds} |`).join('\n')}\n\n[Pages report](${url}) (published after main-branch runs). PR reports are available in the quality-report artifact.\n`, { flag: 'a' });
  }
  console.log(`HTML reports: ${directory}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateReports({ finalize: process.argv.includes('--ci-finalize') });
}
