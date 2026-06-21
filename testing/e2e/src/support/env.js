export const requiredEnv = [
  'GRAPHQL_ENDPOINT',
  'FIREBASE_WEB_API_KEY',
  'E2E_VIEWER_EMAIL',
  'E2E_VIEWER_PASSWORD',
  'E2E_STAFF_EMAIL',
  'E2E_STAFF_PASSWORD',
  'E2E_SUPPORT_EMAIL',
  'E2E_SUPPORT_PASSWORD',
  'E2E_ADMIN_FINANCE_EMAIL',
  'E2E_ADMIN_FINANCE_PASSWORD',
];

export function validateRequiredEnv(keys = requiredEnv) {
  for (const key of keys) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY;
export const firebaseAuthEmulatorUrl = process.env.FIREBASE_AUTH_EMULATOR_URL?.replace(/\/$/u, '');

export const gatewayBaseUrl = (
  process.env.ADMIN_CONSOLE_URL ||
  process.env.GRAPHQL_ENDPOINT?.replace(/\/graphql\/?$/u, '') ||
  ''
).replace(/\/$/u, '');

export const graphqlEndpoint =
  process.env.GATEWAY_GRAPHQL_ENDPOINT ||
  (process.env.ADMIN_CONSOLE_URL ? `${gatewayBaseUrl}/graphql` : process.env.GRAPHQL_ENDPOINT);

export const adminApiBaseUrl = `${gatewayBaseUrl}/admin/api`;
export const brokenSubgraphName = process.env.E2E_BROKEN_SUBGRAPH_NAME || 'broken-service';
