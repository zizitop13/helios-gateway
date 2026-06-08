import { test, expect } from '@playwright/test';
import { auth } from '../../support/auth/index.auth.js';
import { graphqlRequest } from '../../support/clients/graphql.client.js';
import { subscriptionFieldsQuery } from '../../support/clients/subscription.client.js';
import { validateRequiredEnv } from '../../support/env.js';

test.describe('gateway subscription operations', () => {
  test.beforeAll(() => {
    validateRequiredEnv();
  });

  test('exposes composed order update subscription field', async ({ request }) => {
    const staffToken = await auth.signInAs(request, 'staff');
    const { status, payload } = await graphqlRequest(
      request,
      subscriptionFieldsQuery(),
      staffToken
    );

    const subscriptionFields =
      payload.data?.__schema?.subscriptionType?.fields?.map((field) => field.name) || [];

    expect(status).toBe(200);
    expect(payload.errors).toBeUndefined();
    expect(subscriptionFields).toContain('orderUpdated');
  });
});
