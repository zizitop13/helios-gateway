---
title: Quality checks and reports
nav_section: contributing
---

# Quality checks and reports

The **Quality** workflow runs on every pull request, push to `main`, and manual run.
It uses Node 24. Run the same checks locally from the repository root:

```bash
npm ci
npm run setup
cd testing/e2e
npx playwright install --with-deps chromium
cd ../..
npm run check
```

`npm run check` runs every check even when an earlier check fails, writes HTML
reports, and exits unsuccessfully if any check failed. It does not use cloud
credentials. Individual checks are also available:

| Command | What it checks |
| --- | --- |
| `npm run lint` | ESLint and TypeScript rules across the gateway, both UIs, scripts, and fixtures; warnings fail CI |
| `npm run analyze` | SonarJS rules for duplicated branches, redundant logic, collection mistakes, and cognitive complexity (maximum 30) |
| `npm run build` | TypeScript compilation and production builds of the gateway and both UIs |
| `npm run test:unit` | All gateway Jest tests, coverage, JSON, and JUnit results |
| `npm run test:mutation` | Stryker mutates all executable gateway TypeScript, including CLI, discovery, auth, RBAC, routes, and admin API; score must be at least 45% |
| `npm run test:e2e` | All existing Playwright projects, including Chromium admin UI scenarios, against an isolated local stack |
| `npm run test:stress` | Concurrent health probes, reads spanning three subgraphs, mutations, and anonymous/forbidden requests; checks post-load recovery |

Build before running E2E or stress individually. Their fixture runner starts the
Firebase Auth emulator, seeds four test users with real custom claims, starts all
four demo subgraphs and the compiled gateway, waits for composition, and cleans
up its processes on success, failure, or interruption. It uses ports 4400–4402,
5001–5004, and 9099. The Users HTTP contract browser tests also start a Vite
frontend on port 4403. Logs are in `reports/local/`.

Stress stages run for five seconds each, ramping federated reads through 4, 20,
and 40 concurrent clients. Every response is checked for correct status and
content, including the expected RBAC errors. Each stage requires zero failures,
at least 20 requests, and p95 latency at most 2,000 ms. Configure duration with
`STRESS_DURATION_SECONDS` (1–300) or the latency limit with `STRESS_MAX_P95_MS`.
These are local CI smoke stress tests, not production capacity measurements.

Stryker uses the existing Jest suite and per-test coverage analysis. Tests,
type-only declarations, and export-only barrel files are excluded from mutation.
The first full CI run measured a 48.26% mutation score (64.82% for covered code),
including 544 uncovered mutants and 558 survivors. The initial gate is 45%, with
80% as the target. The report keeps every survivor and uncovered mutant visible
so the gate can be raised as test coverage improves. Local reruns reuse unchanged
results from `gateway/reports/stryker-incremental.json`; each clean CI checkout
runs the complete analysis without a mutation-result cache. ESLint permits existing explicit `any`
types at SDK and Jest integration boundaries; other recommended TypeScript rules
are enforced. SonarJS scans production code and tooling rather than unit test
doubles or generated BDD files.

## HTML history on GitHub Pages

[Open report history]({{ '/reports/' | relative_url }}).

Reports use UTC timestamps and GitHub's run number and attempt, for example:

```text
reports/2026-10-18T12-30-00-000Z-build-42-attempt-1/
  summary-2026-10-18T12-30-00-000Z-build-42-attempt-1.html
  unit-2026-10-18T12-30-00-000Z-build-42-attempt-1.html
  mutation-2026-10-18T12-30-00-000Z-build-42-attempt-1.html
  e2e-2026-10-18T12-30-00-000Z-build-42-attempt-1.html
  stress-2026-10-18T12-30-00-000Z-build-42-attempt-1.html
```

Lint, static analysis, and build reports use the same naming scheme. The dated
HTML summaries link to detailed coverage, Stryker, and Playwright reports. Each
check has its complete log, and stress reports include request counts,
throughput, p50, p95, and p99.

PR runs upload the `quality-report` artifact for review. After any completed
main-branch Quality run, including failed runs, the Pages workflow downloads its
report, archives it in the `quality-reports` branch, rebuilds the documentation,
and deploys both together. Documentation-only deployments restore the same
archive, preserving report history. Reports are retained in that branch beyond
the 30-day Actions artifact lifetime. Publication uses the existing GitHub Pages
environment and repository `GITHUB_TOKEN`; Pages must use GitHub Actions as its
publishing source.

Manual and documentation-only Pages deployments also recover the most recent
available completed main-branch Quality report. This allows a publication failure
to be repaired without rerunning all quality checks. Only reports from this
repository's main-branch push/manual runs are eligible. The archive uses the exact
`refs/heads/quality-reports` ref, so similarly named branches such as
`ci/quality-reports` do not interfere with its first publication. Each deployment
runs regression checks for initial creation, history preservation, and remote
connection failures before restoring the archive.

Pages artifacts include the workflow run and attempt in their names so retries do
not select an older upload. When GitHub's built-in branch-based Pages workflow is
also running, report deployment waits for it to finish before publishing the
complete site. A final HTTP check verifies the selected build is visible in the
public report history.
