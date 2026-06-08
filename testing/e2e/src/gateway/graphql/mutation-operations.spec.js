import { test, expect } from '@playwright/test';
import { auth } from '../../support/auth/index.auth.js';
import { firstErrorCode, graphqlRequest } from '../../support/clients/graphql.client.js';
import { validateRequiredEnv } from '../../support/env.js';

const updateOrderMutation = /* GraphQL */ `
  mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) {
    updateOrder(id: $id, input: $input) {
      id
      status
      total
    }
  }
`;

test.describe('gateway mutation operations', () => {
  test.beforeAll(() => {
    validateRequiredEnv();
  });

  test('blocks anonymous access to protected mutation', async ({ request }) => {
    const { status, payload } = await graphqlRequest(request, updateOrderMutation, '', {
      id: 'o1',
      input: { status: 'PENDING' },
    });

    expect(status).toBe(401);
    expect(firstErrorCode(payload)).toBe('UNAUTHENTICATED');
  });

  test('blocks viewer from staff mutation', async ({ request }) => {
    const viewerToken = await auth.signInAs(request, 'viewer');
    const { status, payload } = await graphqlRequest(request, updateOrderMutation, viewerToken, {
      id: 'o1',
      input: { status: 'PENDING' },
    });

    expect(status).toBe(403);
    expect(firstErrorCode(payload)).toBe('FORBIDDEN');
  });

  test('allows staff to update an order', async ({ request }) => {
    const staffToken = await auth.signInAs(request, 'staff');
    const { status, payload } = await graphqlRequest(request, updateOrderMutation, staffToken, {
      id: 'o1',
      input: { status: 'PENDING', total: 201 },
    });

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(payload.data?.updateOrder).toMatchObject({
      id: 'o1',
      status: 'PENDING',
      total: 201,
    });
  });
});
