import { test, expect } from '@playwright/test';
import { auth } from '../../support/auth/index.auth.js';
import { firstErrorCode, graphqlRequest } from '../../support/clients/graphql.client.js';
import { validateRequiredEnv } from '../../support/env.js';

test.describe('gateway access control', () => {
  test.beforeAll(() => {
    validateRequiredEnv();
  });

  test('blocks anonymous access to protected query', async ({ request }) => {
    const { status, payload } = await graphqlRequest(request, 'query { pets { id name } }', '');

    expect(status).toBe(401);
    expect(firstErrorCode(payload)).toBe('UNAUTHENTICATED');
  });

  test('allows viewer to query pets', async ({ request }) => {
    const viewerToken = await auth.signInAs(request, 'viewer');
    const { status, payload } = await graphqlRequest(
      request,
      'query { pets { id name } }',
      viewerToken
    );

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(Array.isArray(payload.data?.pets)).toBe(true);
    expect(payload.data.pets.length).toBeGreaterThan(0);
  });

  test('blocks viewer from staff query', async ({ request }) => {
    const viewerToken = await auth.signInAs(request, 'viewer');
    const { status, payload } = await graphqlRequest(
      request,
      'query { orders { id status total } }',
      viewerToken
    );

    expect(status).toBe(403);
    expect(firstErrorCode(payload)).toBe('FORBIDDEN');
  });

  test('allows staff to query orders', async ({ request }) => {
    const staffToken = await auth.signInAs(request, 'staff');
    const { status, payload } = await graphqlRequest(
      request,
      'query { orders { id status total } }',
      staffToken
    );

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(Array.isArray(payload.data?.orders)).toBe(true);
    expect(payload.data.orders.length).toBeGreaterThan(0);
  });

  test('allows support to read customer emails', async ({ request }) => {
    const supportToken = await auth.signInAs(request, 'support');
    const { status, payload } = await graphqlRequest(
      request,
      'query { customers { id email tier } }',
      supportToken
    );

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(Array.isArray(payload.data?.customers)).toBe(true);
    expect(payload.data.customers.length).toBeGreaterThan(0);
    expect(typeof payload.data.customers[0].email).toBe('string');
  });

  test('allows admin and finance role match', async ({ request }) => {
    const adminFinanceToken = await auth.signInAs(request, 'adminFinance');
    const { status, payload } = await graphqlRequest(
      request,
      'query { financeReport }',
      adminFinanceToken
    );

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(Array.isArray(payload.data?.financeReport)).toBe(true);
  });
});
