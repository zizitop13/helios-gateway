import { test, expect } from '@playwright/test';
import { auth } from '../support/auth/index.auth.js';
import { adminApiRequest } from '../support/clients/admin-api.client.js';
import { brokenSubgraphName, validateRequiredEnv } from '../support/env.js';

let adminToken = '';
const brokenHealthErrorPattern = /HTTP 500|timed out/i;

test.describe('admin subgraph health', () => {
  test.beforeAll(async ({ request }) => {
    validateRequiredEnv();
    adminToken = await auth.signInAs(request, 'adminFinance');
  });

  test('reports the broken service in the aggregate subgraph health endpoint', async ({ request }) => {
    const { status, payload } = await adminApiRequest(request, '/subgraphs/health', adminToken);

    expect(status).toBe(503);
    expect(payload.status).toBe('unhealthy');

    const brokenService = payload.subgraphs.find((subgraph) => subgraph.name === brokenSubgraphName);
    expect(brokenService).toBeDefined();
    expect(brokenService.healthy).toBe(false);
    expect(brokenService.error).toMatch(brokenHealthErrorPattern);
  });

  test('reports the broken service in the single-subgraph health endpoint', async ({ request }) => {
    const { status, payload } = await adminApiRequest(
      request,
      `/subgraphs/${encodeURIComponent(brokenSubgraphName)}/health`,
      adminToken
    );

    expect(status).toBe(503);
    expect(payload.name).toBe(brokenSubgraphName);
    expect(payload.healthy).toBe(false);
    expect(payload.error).toMatch(brokenHealthErrorPattern);
  });
});
