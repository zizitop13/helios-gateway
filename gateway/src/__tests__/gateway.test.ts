import { createServer, Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { ApolloCloudGateway } from '../gateway';
import { IAuthManager } from '../auth';
import { RBACManager } from '../rbac';

jest.mock('firebase-admin', () => ({ initializeApp: jest.fn() }));
jest.mock('@google-cloud/run', () => ({ ServicesClient: jest.fn() }));

const sdl = `
  directive @requiresRole(roles: [String!]!) on FIELD_DEFINITION
  type Query { securedValue: String @requiresRole(roles: ["admin"]) }
`;

async function close(server?: Server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe('Gateway startup and request handling', () => {
  it('discovers and composes a subgraph, serves health/admin routes, and enforces roles on real HTTP requests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'helios-unit-'));
    let gatewayHttp: Server | undefined;
    let gateway: ApolloCloudGateway | undefined;
    const subgraph = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const { query } = JSON.parse(body);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ data: query.includes('_service') ? { _service: { sdl } } : { securedValue: 'from-subgraph' } }));
    });
    await new Promise<void>(resolve => subgraph.listen(0, '127.0.0.1', resolve));
    const port = (subgraph.address() as AddressInfo).port;
    const file = join(directory, 'subgraphs.json');
    await writeFile(file, JSON.stringify({ services: [{ name: 'secured', port }] }));
    const admin = { uid: 'admin-id', email: 'admin@example.test', roles: ['admin'], claims: {} };
    const viewer = { uid: 'viewer-id', roles: ['viewer'], claims: {} };
    const auth: IAuthManager = {
      initialize: jest.fn(),
      extractTokenFromHeader: header => header?.replace(/^Bearer /, '') || null,
      verifyToken: async token => token === 'admin-token' ? admin : viewer,
      verifySessionCookie: async () => null,
      createSessionCookie: async () => 'session',
      assignRolesToUser: async () => null,
    };

    try {
      gateway = new ApolloCloudGateway({ discoveryMode: 'file', discoveryFilePath: file, discoveryFileDefaultHost: '127.0.0.1', port: 0, enableSchemaRefresh: false, enableCloudRunIamAuth: false, adminConsoleEnabled: true, enableApolloSandbox: false });
      (gateway as any).authManager = auth;
      const app = (gateway as any).app;
      const listen = app.listen.bind(app);
      jest.spyOn(app, 'listen').mockImplementation((...args: unknown[]) => { gatewayHttp = listen(...args); return gatewayHttp; });
      await gateway.start();
      if (!gatewayHttp!.listening) await new Promise(resolve => gatewayHttp!.once('listening', resolve));
      const base = `http://127.0.0.1:${(gatewayHttp!.address() as AddressInfo).port}`;
      expect(auth.initialize).toHaveBeenCalledTimes(1);
      expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ status: 'ok' });
      const status = await fetch(`${base}/admin/api/status`, { headers: { Authorization: 'Bearer admin-token' } });
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({ discoveryMode: 'file', servicesCount: 1 });
      const graphql = (token?: string) => fetch(`${base}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query: '{ securedValue }' }) });
      const anonymous = await graphql();
      expect(anonymous.status).toBe(401);
      await anonymous.body?.cancel();
      const forbidden = await graphql('viewer-token');
      expect(forbidden.status).toBe(403);
      await forbidden.body?.cancel();
      const authorized = await graphql('admin-token');
      expect(authorized.status).toBe(200);
      expect(await authorized.json()).toEqual({ data: { securedValue: 'from-subgraph' } });
    } finally {
      jest.restoreAllMocks();
      await close(gatewayHttp);
      await (gateway as any)?.server?.stop();
      await close(subgraph);
      RBACManager.clearPolicies();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
