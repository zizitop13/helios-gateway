import { ApolloServer } from '@apollo/server';
import { ApolloCloudGateway } from '../gateway';
import { IAuthManager } from '../auth';
import { ApolloCloudContext, UserContext } from '../types';
import http from 'http';

const adminUser: UserContext = {
  uid: 'admin-1',
  email: 'admin@example.com',
  roles: ['admin'],
  claims: {},
};

function createMockAuthManager(overrides: Partial<IAuthManager> = {}): jest.Mocked<IAuthManager> {
  return {
    initialize: jest.fn(),
    verifyToken: jest.fn().mockResolvedValue(adminUser),
    createSessionCookie: jest.fn().mockResolvedValue('firebase-session-cookie'),
    verifySessionCookie: jest.fn().mockResolvedValue(adminUser),
    assignRolesToUser: jest.fn(),
    extractTokenFromHeader: jest.fn((authHeader?: string) => {
      if (!authHeader) {
        return null;
      }
      return authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    }),
    ...overrides,
  } as jest.Mocked<IAuthManager>;
}

async function startTestServer(options: {
  authManager?: jest.Mocked<IAuthManager>;
  withGraphql?: boolean;
} = {}) {
  const gateway = new ApolloCloudGateway({
    discoveryMode: 'docker',
    adminConsoleEnabled: false,
    enableApolloSandbox: false,
    enableSchemaRefresh: false,
    enableCloudRunIamAuth: false,
  });

  const authManager = options.authManager || createMockAuthManager();
  (gateway as any).authManager = authManager;

  if (options.withGraphql) {
    const server = new ApolloServer<ApolloCloudContext>({
      typeDefs: `
        type Query {
          protectedUser: String!
        }
      `,
      resolvers: {
        Query: {
          protectedUser: (_source, _args, context) => {
            if (!context.user) {
              throw new Error('Authentication required');
            }

            return context.user.uid;
          },
        },
      },
    });
    await server.start();
    (gateway as any).server = server;
  }

  (gateway as any).setupExpress();

  const app = (gateway as any).app;
  const httpServer = http.createServer(app);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start test server');
  }

  return {
    authManager,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      if (options.withGraphql) {
        await (gateway as any).server.stop();
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

function cookieHeaderFromSetCookie(setCookie: string | null, cookieName: string): string {
  if (!setCookie) {
    throw new Error(`Missing ${cookieName} Set-Cookie header`);
  }

  const cookie = setCookie
    .split(';')
    .find((entry) => entry.trim().startsWith(`${cookieName}=`));

  if (!cookie) {
    throw new Error(`Missing ${cookieName} cookie`);
  }

  return cookie.trim();
}

async function getCsrf(baseUrl: string) {
  const response = await fetch(`${baseUrl}/csrfToken`);
  const payload = await response.json() as { csrfToken: string };
  const setCookie = response.headers.get('set-cookie');

  return {
    csrfToken: payload.csrfToken,
    csrfCookie: cookieHeaderFromSetCookie(setCookie, 'apollo_csrf_token'),
    setCookie,
  };
}

describe('Firebase session login flow', () => {
  it('GET /csrfToken returns a token and sets a readable CSRF cookie', async () => {
    const server = await startTestServer();

    try {
      const response = await fetch(`${server.baseUrl}/csrfToken`);
      const payload = await response.json() as { csrfToken: string };
      const setCookie = response.headers.get('set-cookie');

      expect(response.status).toBe(200);
      expect(payload.csrfToken).toMatch(/^[a-f0-9]{64}$/);
      expect(setCookie).toContain(`apollo_csrf_token=${payload.csrfToken}`);
      expect(setCookie).not.toMatch(/HttpOnly/i);
    } finally {
      await server.close();
    }
  });

  it('POST /sessionLogin without CSRF header returns 403', async () => {
    const server = await startTestServer();

    try {
      const { csrfCookie } = await getCsrf(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/sessionLogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: csrfCookie,
        },
        body: JSON.stringify({ idToken: 'raw-id-token' }),
      });

      expect(response.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('POST /sessionLogin with mismatched CSRF cookie and header returns 403', async () => {
    const server = await startTestServer();

    try {
      const { csrfCookie } = await getCsrf(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/sessionLogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'different-token',
          Cookie: csrfCookie,
        },
        body: JSON.stringify({ idToken: 'raw-id-token' }),
      });

      expect(response.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('POST /sessionLogin without idToken returns 400', async () => {
    const server = await startTestServer();

    try {
      const { csrfToken, csrfCookie } = await getCsrf(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/sessionLogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Cookie: csrfCookie,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('POST /sessionLogin stores a Firebase session cookie instead of the raw idToken', async () => {
    const authManager = createMockAuthManager();
    const server = await startTestServer({ authManager });

    try {
      const { csrfToken, csrfCookie } = await getCsrf(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/sessionLogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Cookie: csrfCookie,
        },
        body: JSON.stringify({ idToken: 'raw-id-token' }),
      });
      const payload = await response.json() as { status: string; expiresIn: number };
      const setCookie = response.headers.get('set-cookie');

      expect(response.status).toBe(200);
      expect(payload).toEqual({ status: 'success', expiresIn: 432000000 });
      expect(authManager.verifyToken).toHaveBeenCalledWith('raw-id-token');
      expect(authManager.createSessionCookie).toHaveBeenCalledWith('raw-id-token', 432000000);
      expect(setCookie).toContain('apollo_playground_token=firebase-session-cookie');
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).not.toContain('apollo_playground_token=raw-id-token');
    } finally {
      await server.close();
    }
  });

  it('protected GraphQL accepts a valid Firebase session cookie', async () => {
    const authManager = createMockAuthManager();
    const server = await startTestServer({ authManager, withGraphql: true });

    try {
      const { csrfToken, csrfCookie } = await getCsrf(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Cookie: `${csrfCookie}; apollo_playground_token=firebase-session-cookie`,
        },
        body: JSON.stringify({ query: 'query { protectedUser }' }),
      });
      const payload = await response.json() as { data?: { protectedUser?: string } };

      expect(response.status).toBe(200);
      expect(authManager.verifySessionCookie).toHaveBeenCalledWith('firebase-session-cookie');
      expect(payload.data?.protectedUser).toBe('admin-1');
    } finally {
      await server.close();
    }
  });

  it('protected GraphQL rejects missing or invalid session cookies', async () => {
    const authManager = createMockAuthManager({
      verifySessionCookie: jest.fn().mockResolvedValue(null),
    });
    const server = await startTestServer({ authManager, withGraphql: true });

    try {
      const missingCookieResponse = await fetch(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'query { protectedUser }' }),
      });
      const missingCookiePayload = await missingCookieResponse.json() as { errors?: unknown[] };

      const { csrfToken, csrfCookie } = await getCsrf(server.baseUrl);
      const invalidCookieResponse = await fetch(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Cookie: `${csrfCookie}; apollo_playground_token=invalid-session-cookie`,
        },
        body: JSON.stringify({ query: 'query { protectedUser }' }),
      });
      const invalidCookiePayload = await invalidCookieResponse.json() as { errors?: unknown[] };

      expect(missingCookieResponse.status).toBe(200);
      expect(missingCookiePayload.errors).toBeDefined();
      expect(invalidCookieResponse.status).toBe(200);
      expect(authManager.verifySessionCookie).toHaveBeenCalledWith('invalid-session-cookie');
      expect(invalidCookiePayload.errors).toBeDefined();
    } finally {
      await server.close();
    }
  });
});
