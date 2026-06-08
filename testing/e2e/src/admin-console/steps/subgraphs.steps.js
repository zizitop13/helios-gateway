import { Then, When, expect } from '../../fixtures.js';

const brokenSubgraphName = process.env.E2E_BROKEN_SUBGRAPH_NAME || 'broken-service-e2e';
const brokenHealthErrorPattern = /HTTP 500|timed out/i;

export async function waitForBrokenHealthCheckResult(layoutPage) {
  await expect(
    layoutPage.getSandboxHealthSummary(
      'One or more subgraphs failed health check. You can still open Sandbox.'
    )
  ).toBeVisible({ timeout: 20_000 });
}

export async function assertBrokenServiceFailure(layoutPage) {
  await expect(layoutPage.sandboxHealthDialog).toContainText(brokenSubgraphName);
  await expect(layoutPage.sandboxHealthDialog).toContainText(brokenHealthErrorPattern);
}

export async function openSandboxHealthCheck(layoutPage) {
  await layoutPage.openSandboxHealthCheck();
}

export async function waitForSubgraphTable(subgraphsPage) {
  await subgraphsPage.waitForLoad();
}

Then('I should see the broken subgraph shown as failed and can open the Sandbox', async ({ layoutPage }) => {
  await waitForBrokenHealthCheckResult(layoutPage);
  await assertBrokenServiceFailure(layoutPage);
  await expect(layoutPage.openSandboxButton).toBeVisible();
});

Then('the subgraph table should be visible', async ({ subgraphsPage }) => {
  await waitForSubgraphTable(subgraphsPage);
  await expect(subgraphsPage.table).toBeVisible();
});

Then('each subgraph row should have a name and a URL', async ({ subgraphsPage }) => {
  await waitForSubgraphTable(subgraphsPage);
  const rowTexts = await subgraphsPage.getRowTexts();
  expect(rowTexts.length).toBeGreaterThan(0);
  for (const text of rowTexts) {
    expect(text).toMatch(/https?:\/\//);
  }
});

Then('each subgraph row should show a status badge', async ({ subgraphsPage, page }) => {
  await waitForSubgraphTable(subgraphsPage);
  const badges = page.locator('tbody tr td').filter({ hasText: /active|failed|inactive/i });
  await expect(badges.first()).toBeVisible();
});

Then('I should see the broken subgraph shown as failed in the subgraphs table', async ({ subgraphsPage }) => {
  await waitForSubgraphTable(subgraphsPage);
  const brokenServiceRow = subgraphsPage.getRowByName(brokenSubgraphName);
  await expect(brokenServiceRow).toBeVisible({ timeout: 15_000 });
  await expect(brokenServiceRow).toContainText(/failed/i);
});

When('I open the GraphQL Sandbox health check modal', async ({ layoutPage }) => {
  await openSandboxHealthCheck(layoutPage);
});

