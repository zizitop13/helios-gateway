import { AdminAuthGuard } from '../admin';
import { AdminApiController } from '../admin';
import { FirebaseAuthManager } from '../auth';
import { ServiceDiscoveryManager } from '../discovery';
import { IDiscoveryProvider } from '../discovery';
import { SubgraphService, UserContext } from '../types';
import { Request, Response } from 'express';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createSessionCookie: jest.fn(),
    verifySessionCookie: jest.fn()
  })),
  credential: {
    cert: jest.fn()
  }
}));

describe('Admin Module', () => {
  describe('AdminAuthGuard', () => {
    let authManager: FirebaseAuthManager;
    let adminGuard: AdminAuthGuard;

    beforeEach(() => {
      authManager = new FirebaseAuthManager();
      adminGuard = new AdminAuthGuard(authManager);
    });

    it('should reject requests without authorization header', async () => {
      const req = { headers: {} } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', async () => {
      authManager.extractTokenFromHeader = jest.fn().mockReturnValue('invalid-token');
      authManager.verifyToken = jest.fn().mockResolvedValue(null);

      const req = { headers: { authorization: 'Bearer invalid-token' } } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject users without admin role', async () => {
      const userWithoutAdmin: UserContext = {
        uid: 'user123',
        email: 'user@example.com',
        roles: ['user'],
        claims: {}
      };

      authManager.extractTokenFromHeader = jest.fn().mockReturnValue('valid-token');
      authManager.verifyToken = jest.fn().mockResolvedValue(userWithoutAdmin);

      const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Admin role required to access this resource'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow users with admin role', async () => {
      const adminUser: UserContext = {
        uid: 'admin123',
        email: 'admin@example.com',
        roles: ['admin', 'user'],
        claims: {}
      };

      authManager.extractTokenFromHeader = jest.fn().mockReturnValue('valid-token');
      authManager.verifyToken = jest.fn().mockResolvedValue(adminUser);

      const req = { headers: { authorization: 'Bearer valid-token' } } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(adminUser);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin users with a valid session cookie', async () => {
      const adminUser: UserContext = {
        uid: 'admin123',
        email: 'admin@example.com',
        roles: ['admin'],
        claims: {}
      };

      authManager.verifySessionCookie = jest.fn().mockResolvedValue(adminUser);

      const req = {
        headers: {
          cookie: 'apollo_playground_token=firebase-session-cookie'
        }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(authManager.verifySessionCookie).toHaveBeenCalledWith('firebase-session-cookie');
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(adminUser);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid session cookies', async () => {
      authManager.verifySessionCookie = jest.fn().mockResolvedValue(null);

      const req = {
        headers: {
          cookie: 'apollo_playground_token=invalid-session-cookie'
        }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      await adminGuard.middleware()(req, res, next);

      expect(authManager.verifySessionCookie).toHaveBeenCalledWith('invalid-session-cookie');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('AdminApiController', () => {
    let controller: AdminApiController;
    let mockDiscoveryManager: ServiceDiscoveryManager;

    beforeEach(() => {
      const mockProvider: IDiscoveryProvider = {
        discoverServices: jest.fn().mockResolvedValue([])
      };
      mockDiscoveryManager = new ServiceDiscoveryManager(mockProvider);
      controller = new AdminApiController(mockDiscoveryManager, 'docker');
    });

    describe('GET /subgraphs', () => {
      it('should return discovered subgraphs', async () => {
        const mockServices: SubgraphService[] = [
          { name: 'users', url: 'http://users:4001/graphql', labels: {} },
          { name: 'products', url: 'http://products:4002/graphql', labels: {} }
        ];

        mockDiscoveryManager.getDiscoveredServices = jest.fn().mockReturnValue(mockServices);

        const req = {} as Request;
        const res = {
          json: jest.fn()
        } as unknown as Response;

        const router = controller.getRouter();
        // Manually invoke the route handler
        const routeHandler = router.stack[0]?.route?.stack[0]?.handle;
        if (routeHandler) {
          await (routeHandler as any)(req, res);
        }

        expect(res.json).toHaveBeenCalledWith({
          subgraphs: [
            { name: 'users', url: 'http://users:4001/graphql', status: 'active', labels: {} },
            { name: 'products', url: 'http://products:4002/graphql', status: 'active', labels: {} }
          ]
        });
      });
    });

    describe('GET /subgraphs/stream', () => {
      const originalFetch = global.fetch;

      afterEach(() => {
        global.fetch = originalFetch;
      });

      it('should stream each discovered subgraph after health is checked', async () => {
        const mockServices: SubgraphService[] = [
          { name: 'users', url: 'http://users:4001/graphql', labels: { surface: 'gateway' } },
        ];

        mockDiscoveryManager.getDiscoveredServices = jest.fn().mockReturnValue(mockServices);
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ data: { _service: { sdl: 'type Query { ok: Boolean }' } } }),
        } as any);

        const req = {
          header: jest.fn((name: string) => (name === 'authorization' ? 'Bearer admin-token' : undefined)),
          on: jest.fn(),
          user: {
            uid: 'admin123',
            email: 'admin@example.com',
            roles: ['admin'],
            claims: {},
          },
        } as any;
        const res = {
          writeHead: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
        } as unknown as Response;

        const router = controller.getRouter();
        const routeHandler = router.stack.find((layer: any) => layer.route?.path === '/subgraphs/stream')
          ?.route?.stack[0]?.handle;

        expect(routeHandler).toBeDefined();
        await (routeHandler as any)(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }));
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: subgraph'));
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"name":"users"'));
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"status":"active"'));
        expect(res.end).toHaveBeenCalled();
      });
    });

    describe('GET /status', () => {
      it('should return gateway status', async () => {
        const mockServices: SubgraphService[] = [
          { name: 'users', url: 'http://users:4001/graphql', labels: {} }
        ];

        mockDiscoveryManager.getDiscoveredServices = jest.fn().mockReturnValue(mockServices);

        const req = {} as Request;
        const res = {
          json: jest.fn()
        } as unknown as Response;

        const router = controller.getRouter();
        // Manually invoke the route handler for /status (second route)
        const routeHandler = router.stack[1]?.route?.stack[0]?.handle;
        if (routeHandler) {
          await (routeHandler as any)(req, res);
        }

        const result = (res.json as jest.Mock).mock.calls[0][0];
        expect(result).toHaveProperty('uptime');
        expect(result.discoveryMode).toBe('docker');
        expect(result.servicesCount).toBe(1);
      });
    });

    describe('GET /me', () => {
      it('should return user information', async () => {
        const mockUser: UserContext = {
          uid: 'admin123',
          email: 'admin@example.com',
          roles: ['admin'],
          claims: { exp: Math.floor(Date.now() / 1000) + 3600 }
        };

        const req = { user: mockUser } as any;
        const res = {
          json: jest.fn()
        } as unknown as Response;

        const router = controller.getRouter();
        // Manually invoke the route handler for /me (third route)
        const routeHandler = router.stack[2]?.route?.stack[0]?.handle;
        if (routeHandler) {
          await (routeHandler as any)(req, res);
        }

        const result = (res.json as jest.Mock).mock.calls[0][0];
        expect(result.uid).toBe('admin123');
        expect(result.email).toBe('admin@example.com');
        expect(result.roles).toEqual(['admin']);
        expect(result).toHaveProperty('tokenExpiration');
      });
    });
  });
});
