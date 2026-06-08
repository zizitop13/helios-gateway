import { Request, Response, Router } from 'express';
import { ServiceDiscoveryManager } from '../discovery';
import { UserContext } from '../types';
import { IAuthManager } from '../auth';
import { CloudRunAuthManager } from '../utils';
import { RBACManager } from '../rbac';

/**
 * Gateway Status Information
 */
export interface GatewayStatus {
  uptime: number;
  discoveryMode: string;
  servicesCount: number;
  graphName?: string;
  graphLabelKey?: string;
}

interface SubgraphHealthResult {
  name: string;
  url: string;
  healthy: boolean;
  error?: string;
}

interface SubgraphStreamResult {
  name: string;
  url: string;
  status: 'active' | 'failed';
  labels: Record<string, string>;
  health: SubgraphHealthResult;
}

/**
 * Admin API Controller
 * Provides REST endpoints for the admin console
 */
export class AdminApiController {
  private static readonly SUBGRAPH_HEALTH_TIMEOUT_MS = 5000;
  private router: Router;
  private startTime: Date;

  constructor(
    private discoveryManager?: ServiceDiscoveryManager,
    private discoveryMode?: string,
    private authManager?: IAuthManager,
    private cloudRunAuthManager?: CloudRunAuthManager,
    private graphName?: string,
    private graphLabelKey?: string,
    private getActiveSubgraphs?: () => Array<{ name: string }>
  ) {
    this.router = Router();
    this.startTime = new Date();
    this.setupRoutes();
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.router.get('/subgraphs', this.getSubgraphs.bind(this));
    this.router.get('/status', this.getStatus.bind(this));
    this.router.get('/me', this.getMe.bind(this));
    this.router.get('/subgraphs/health', this.getSubgraphsHealth.bind(this));
    this.router.get('/subgraphs/stream', this.streamSubgraphs.bind(this));
    this.router.get('/subgraphs/:name/health', this.getSubgraphHealth.bind(this));
    this.router.post('/users/roles', this.assignUserRoles.bind(this));
    this.router.get('/roles', this.getRoles.bind(this));
  }

  /**
   * Get all discovered subgraphs
   */
  private async getSubgraphs(req: Request, res: Response): Promise<void> {
    try {
      const services = this.discoveryManager?.getDiscoveredServices() || [];
      const activeSubgraphs = this.getActiveSubgraphs?.();
      const activeSubgraphNames = activeSubgraphs
        ? new Set(activeSubgraphs.map((subgraph) => subgraph.name))
        : undefined;
      
      const subgraphs = services.map(service => ({
        name: service.name,
        url: service.url,
        status: activeSubgraphNames && !activeSubgraphNames.has(service.name) ? 'failed' : 'active',
        labels: service.labels
      }));

      res.json({ subgraphs });
    } catch (error) {
      console.error('Error fetching subgraphs:', error);
      res.status(500).json({ error: 'Failed to fetch subgraphs' });
    }
  }

  /**
   * Get gateway status and metrics
   */
  private async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const uptimeMs = Date.now() - this.startTime.getTime();
      const services = this.discoveryManager?.getDiscoveredServices() || [];

      const status: GatewayStatus = {
        uptime: uptimeMs,
        discoveryMode: this.discoveryMode || 'none',
        servicesCount: services.length,
        graphName: this.graphName,
        graphLabelKey: this.graphLabelKey
      };

      res.json(status);
    } catch (error) {
      console.error('Error fetching status:', error);
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  }

  /**
   * Get current user information
   */
  private async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserContext;
      
      if (!user) {
        res.status(401).json({ error: 'User not found in request' });
        return;
      }

      const exp = user.claims.exp;
      const tokenExpiration = exp ? new Date(exp * 1000).toISOString() : undefined;

      res.json({
        uid: user.uid,
        email: user.email,
        roles: user.roles,
        tokenExpiration
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  }

  /**
   * Health-check all discovered subgraphs
   */
  private async getSubgraphsHealth(req: Request, res: Response): Promise<void> {
    try {
      const services = this.discoveryManager?.getDiscoveredServices() || [];
      const authorizationHeader = req.header('authorization');
      const user = (req as any).user as UserContext | undefined;

      const results = await Promise.all(
        services.map((service) => this.checkSubgraphHealth(service, authorizationHeader, user))
      );

      const allHealthy = results.every((r) => r.healthy);

      if (!allHealthy) {
        res.status(503).json({
          status: 'unhealthy',
          subgraphs: results,
        });
        return;
      }

      res.json({
        status: 'healthy',
        subgraphs: results,
      });
    } catch (error) {
      console.error('Error during subgraphs health check:', error);
      res.status(500).json({ error: 'Failed to perform subgraphs health check' });
    }
  }

  /**
   * Stream discovered subgraphs as each health check completes.
   */
  private async streamSubgraphs(req: Request, res: Response): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('\n');

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const writeEvent = (event: string, data: unknown) => {
      if (closed) {
        return;
      }

      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const services = this.discoveryManager?.getDiscoveredServices() || [];
      const activeSubgraphs = this.getActiveSubgraphs?.();
      const activeSubgraphNames = activeSubgraphs
        ? new Set(activeSubgraphs.map((subgraph) => subgraph.name))
        : undefined;
      const authorizationHeader = req.header('authorization');
      const user = (req as any).user as UserContext | undefined;

      writeEvent('start', { total: services.length });

      await Promise.all(
        services.map(async (service) => {
          const health = await this.checkSubgraphHealth(service, authorizationHeader, user);
          const isActive =
            health.healthy &&
            (!activeSubgraphNames || activeSubgraphNames.has(service.name));
          const result: SubgraphStreamResult = {
            name: service.name,
            url: service.url,
            status: isActive ? 'active' : 'failed',
            labels: service.labels,
            health,
          };

          writeEvent('subgraph', result);
        })
      );

      writeEvent('done', { total: services.length });
    } catch (error) {
      console.error('Error during subgraphs stream:', error);
      writeEvent('error', { message: 'Failed to stream subgraphs' });
    } finally {
      if (!closed) {
        res.end();
      }
    }
  }

  /**
   * Health-check one discovered subgraph by name
   */
  private async getSubgraphHealth(req: Request, res: Response): Promise<void> {
    try {
      const services = this.discoveryManager?.getDiscoveredServices() || [];
      const name = req.params.name;
      const authorizationHeader = req.header('authorization');
      const user = (req as any).user as UserContext | undefined;
      const service = services.find((candidate) => candidate.name === name);

      if (!service) {
        res.status(404).json({
          error: 'Subgraph not found',
          message: `No discovered subgraph with name "${name}"`,
        });
        return;
      }

      const result = await this.checkSubgraphHealth(service, authorizationHeader, user);

      if (!result.healthy) {
        res.status(503).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error during single subgraph health check:', error);
      res.status(500).json({ error: 'Failed to perform subgraph health check' });
    }
  }

  private async checkSubgraphHealth(
    service: { name: string; url: string },
    authorizationHeader?: string,
    user?: UserContext
  ): Promise<SubgraphHealthResult> {
    const healthQuery = `
      query {
        _service {
          sdl
        }
      }
    `;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (this.cloudRunAuthManager) {
        try {
          const identityToken = await this.cloudRunAuthManager.getIdentityToken(service.url);
          headers.Authorization = `Bearer ${identityToken}`;
        } catch (error) {
          console.error(`Failed to get identity token for ${service.url}:`, error);
        }
      } else if (authorizationHeader) {
        headers.Authorization = authorizationHeader;
      }

      if (user) {
        headers['x-user-id'] = user.uid;
        headers['x-user-email'] = user.email || '';
        headers['x-user-roles'] = JSON.stringify(user.roles);
      }

      const abortController = new AbortController();
      const timeout = setTimeout(
        () => abortController.abort(),
        AdminApiController.SUBGRAPH_HEALTH_TIMEOUT_MS
      );

      let response: globalThis.Response;
      try {
        response = await fetch(service.url, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({ query: healthQuery }),
        });
      } catch (error: any) {
        if (abortController.signal.aborted) {
          return {
            name: service.name,
            url: service.url,
            healthy: false,
            error: `Health check timed out after ${AdminApiController.SUBGRAPH_HEALTH_TIMEOUT_MS}ms`,
          };
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return {
          name: service.name,
          url: service.url,
          healthy: false,
          error: `HTTP ${response.status}`,
        };
      }

      const body = (await response.json()) as {
        data?: unknown;
        errors?: unknown;
      };

      if (body.errors) {
        return {
          name: service.name,
          url: service.url,
          healthy: false,
          error: 'GraphQL errors returned',
        };
      }

      return {
        name: service.name,
        url: service.url,
        healthy: true,
      };
    } catch (err) {
      console.error(`Error health-checking subgraph ${service.name}:`, err);
      return {
        name: service.name,
        url: service.url,
        healthy: false,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Assign custom-claim roles to a Firebase user.
   * Requires admin auth (enforced by AdminAuthGuard on /admin/api).
   */
  private async assignUserRoles(req: Request, res: Response): Promise<void> {
    try {
      if (!this.authManager) {
        res.status(500).json({ error: 'Auth manager not configured' });
        return;
      }

      const { uid, email, roles } = req.body as {
        uid?: string;
        email?: string;
        roles?: string[];
      };

      const trimmedUid = uid?.trim();
      const trimmedEmail = email?.trim();

      if ((!trimmedUid && !trimmedEmail) || (trimmedUid && trimmedEmail)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Provide exactly one identifier: uid or email',
        });
        return;
      }

      if (!Array.isArray(roles)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'roles must be an array of strings',
        });
        return;
      }

      const normalizedRoles = roles
        .map((role) => (typeof role === 'string' ? role.trim() : ''))
        .filter((role) => role.length > 0);

      if (normalizedRoles.length !== roles.length) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'roles must contain only non-empty strings',
        });
        return;
      }

      const dedupedRoles = [...new Set(normalizedRoles)];
      const result = await this.authManager.assignRolesToUser(trimmedUid, trimmedEmail, dedupedRoles);

      if (!result) {
        res.status(404).json({
          error: 'User not found',
          message: 'No Firebase user matched the provided identifier',
        });
        return;
      }

      const actor = (req as any).user as UserContext | undefined;

      res.json({
        status: 'ok',
        assigned: result,
        assignedBy: actor?.uid,
        note: 'User must refresh ID token (re-login or token refresh) for new roles to take effect.',
      });
    } catch (error) {
      console.error('Error assigning user roles:', error);
      res.status(500).json({ error: 'Failed to assign roles' });
    }
  }

  /**
   * Get available roles discovered from subgraph RBAC policies.
   */
  private async getRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = RBACManager.getAvailableRoles();
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching available roles:', error);
      res.status(500).json({ error: 'Failed to fetch available roles' });
    }
  }

  /**
   * Get the Express router
   */
  getRouter(): Router {
    return this.router;
  }
}
