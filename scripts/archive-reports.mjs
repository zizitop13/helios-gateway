import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml, page } from './report-html.mjs';

export async function indexReports(directory) {
  await mkdir(directory, { recursive: true });
  const runs = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[\w.-]+$/.test(entry.name)) continue;
    const run = JSON.parse(await readFile(resolve(directory, entry.name, 'run.json'), 'utf8'));
    runs.push(run);
  }
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const list = runs.map(run => `<li><a href="${escapeHtml(run.runId)}/summary-${escapeHtml(run.runId)}.html">${escapeHtml(run.startedAt)} · build ${escapeHtml(run.buildNumber)} · attempt ${escapeHtml(run.attempt)}</a> — <span class="${run.passed ? 'pass' : 'fail'}">${run.passed ? 'PASS' : 'FAIL'}</span> <small>${escapeHtml(run.commit?.slice(0, 12))}</small></li>`).join('');
  await writeFile(resolve(directory, 'index.html'), page('Quality report history', `<p>Every run is retained with its UTC date, build number, and run attempt. Failed checks remain visible.</p><ol>${list}</ol>`));
}

export async function archiveReports(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isDirectory() && /^[\w.-]+$/.test(entry.name)) {
      const manifest = await readFile(resolve(source, entry.name, 'run.json'), 'utf8');
      let existing;
      try { existing = await readFile(resolve(destination, entry.name, 'run.json'), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing) {
        if (existing !== manifest) throw new Error(`Refusing to overwrite archived report ${entry.name}`);
        continue;
      }
      await cp(resolve(source, entry.name), resolve(destination, entry.name), { recursive: true, force: false, errorOnExist: true });
    }
  }
  await indexReports(destination);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: node scripts/archive-reports.mjs <new-reports> <archive>');
  await archiveReports(source, destination);
}
