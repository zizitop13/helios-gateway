import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloGateway, RemoteGraphQLDataSource, LocalCompose } from '@apollo/gateway';
import express from 'express';
import cors from 'cors';
import { Request } from 'express';
import { parse } from 'graphql';
import { FirebaseAuthManager, IAuthManager } from './auth';
import {
  ServiceDiscoveryManager,
  CloudRunDiscovery,
  DockerDiscovery,
  FileDiscovery,
  IDiscoveryProvider,
} from './discovery';
import { ApolloCloudContext, GatewayConfig, SubgraphService, UserContext } from './types';
import { loadConfig, validateConfig, CloudRunAuthManager } from './utils';
import { AdminAuthGuard, AdminApiController, AdminConsoleHandler } from './admin';
import { RBACManager } from './rbac';
import { createBaseRouter, createSessionRouter, extractCookieValue, extractCsrfHeader } from './routes';

/**
 * Apollo Cloud Gateway
 * Main gateway implementation with Firebase auth, RBAC, and service discovery
 * 
 * The gateway keeps one ApolloServer instance alive and updates its schema dynamically.
 */
export class ApolloCloudGateway {
  private config: GatewayConfig;
  private authManager: IAuthManager;
  private cloudRunAuthManager?: CloudRunAuthManager;
  private discoveryManager?: ServiceDiscoveryManager;
  private gateway?: ApolloGateway;
  private server?: ApolloServer<ApolloCloudContext>;
  private app: express.Application;
  private adminApiController?: AdminApiController;
  private static readonly AUTH_TOKEN_COOKIE = 'apollo_playground_token';
  private static readonly CSRF_COOKIE = 'apollo_csrf_token';
  private static readonly CSRF_HEADER = 'x-csrf-token';
  private readonly sessionCookieMaxAgeMs: number;
  private schemaRefreshTimer?: NodeJS.Timeout;
  private supergraphUpdate?: (updatedSupergraphSdl: string) => void;
  private isRefreshingSchema = false;
  private activeSubgraphs: SubgraphService[] = [];
  private static readonly SUBGRAPH_INTROSPECTION_TIMEOUT_MS = 5000;
  private static readonly RBAC_POLICY_PRELOAD_TIMEOUT_MS = 5000;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...loadConfig(), ...config };
    validateConfig(this.config);

    this.authManager = new FirebaseAuthManager(
      this.config.firebaseProjectId,
      this.config.firebaseServiceAccountKey
    );

    if (this.config.enableCloudRunIamAuth) {
      this.cloudRunAuthManager = new CloudRunAuthManager();
      console.log('Cloud Run IAM authentication enabled');
    }

    const expiresInDays = Number.parseInt(process.env.TOKEN_EXPIRES_IN_DAYS || '5', 10);
    const normalizedDays = Number.isFinite(expiresInDays) && expiresInDays > 0 ? expiresInDays : 5;
    this.sessionCookieMaxAgeMs = normalizedDays * 24 * 60 * 60 * 1000;

    this.app = express();
  }

  /**
   * Initialize and start the gateway
   */
  async start(): Promise<void> {
    console.log('Starting Apollo Cloud Gateway...');

    this.authManager.initialize();

    if (this.config.discoveryMode === 'docker') {
      await this.setupDockerDiscovery();
    } else if (this.config.discoveryMode === 'file') {
      await this.setupFileDiscovery();
    } else if (this.config.discoveryMode === 'cloudrun' && this.config.gcpProjectId) {
      await this.setupCloudRunDiscovery();
    } else {
      console.warn('No discovery mode configured, using static gateway');
      await this.setupStaticGateway();
    }

    this.setupExpress();
    this.startSchemaRefreshLoop();

    this.app.listen(this.config.port, () => {
      console.log(`🚀 Apollo Cloud Gateway ready at http://localhost:${this.config.port}/graphql`);
    });
  }

  /**
   * Setup Docker service discovery
   */
  private async setupDockerDiscovery(): Promise<void> {
    console.log('Using Docker discovery mode');
    const provider = new DockerDiscovery(
      this.config.dockerSocketPath,
      this.config.graphName,
      this.config.graphLabelKey
    );
    await this.setupDiscoveryWithProvider(provider);
  }

  /**
   * Setup Cloud Run service discovery
   */
  private async setupCloudRunDiscovery(): Promise<void> {
    if (!this.config.gcpProjectId) return;

    console.log('Using Cloud Run discovery mode');
    const provider = new CloudRunDiscovery(
      this.config.gcpProjectId,
      this.config.gcpRegion,
      this.config.graphName,
      this.config.graphLabelKey
    );
    await this.setupDiscoveryWithProvider(provider);
  }

  private async setupFileDiscovery(): Promise<void> {
    if (!this.config.discoveryFilePath) {
      return;
    }

    console.log('Using file discovery mode');
    const provider = new FileDiscovery(
      this.config.discoveryFilePath,
      this.config.graphName,
      this.config.graphLabelKey,
      this.config.discoveryFileDefaultHost
    );
    await this.setupDiscoveryWithProvider(provider);
  }

  /**
   * Setup service discovery with a given provider
   */
  private async setupDiscoveryWithProvider(provider: IDiscoveryProvider): Promise<void> {
    this.discoveryManager = new ServiceDiscoveryManager(provider);

    const initialServices = await this.discoveryManager.discoverServices();
    console.log(`Discovered ${initialServices.length} services at startup`);
    await this.buildGateway(initialServices);
  }

  /**
   * Setup gateway with static configuration
   */
  private async setupStaticGateway(): Promise<void> {
    const staticServices: SubgraphService[] = [];
    await this.buildGateway(staticServices);
  }

  /**
   * Build Apollo Gateway with discovered services
   */
  private async buildGateway(services: SubgraphService[]): Promise<void> {
    console.log(`Building gateway from ${services.length} discovered subgraphs...`);
    const initialComposition = await this.composeDiscoveredServices(services);

    this.logExcludedSubgraphs(initialComposition.excludedSubgraphs, 'startup');

    if (!initialComposition.supergraphSdl) {
      console.error('Initial schema composition failed; /graphql endpoint will not be available.');
      this.gateway = undefined;
      this.server = undefined;
      return;
    }

    this.activeSubgraphs = initialComposition.includedSubgraphs;
    console.log(
      `Initial composition produced a supergraph with ${initialComposition.includedSubgraphs.length} subgraphs.`
    );
    console.log('Preloading RBAC policies from composed subgraphs...');
    await this.loadRbacPoliciesFromSubgraphs(initialComposition.includedSubgraphs);
    console.log('RBAC policy preload completed.');

    console.log('Creating Apollo Gateway instance...');
    this.gateway = new ApolloGateway({
      supergraphSdl: async ({ update }) => {
        this.supergraphUpdate = update;
        return { supergraphSdl: initialComposition.supergraphSdl! };
      },
      buildService: ({ url }) => {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest: async ({ request, context }) => {
            if (this.cloudRunAuthManager && url) {
              try {
                const identityToken = await this.cloudRunAuthManager.getIdentityToken(url);
                request.http?.headers.set('Authorization', `Bearer ${identityToken}`);
              } catch (error: any) {
                console.error(`Failed to get identity token for ${url}:`, error?.message || error);
              }
            }

            if (context.user) {
              request.http?.headers.set('x-user-id', context.user.uid);
              request.http?.headers.set('x-user-email', context.user.email || '');
              request.http?.headers.set('x-user-roles', JSON.stringify(context.user.roles));
            }
          }
        });
      }
    });

    try {
      console.log('Creating Apollo Server instance...');
      const plugins = [RBACManager.createApolloPlugin()];

      if (this.config.enableApolloSandbox) {
        plugins.push(
          ApolloServerPluginLandingPageLocalDefault({
            embed: true,
          })
        );
      }

      this.server = new ApolloServer<ApolloCloudContext>({
        gateway: this.gateway,
        introspection: this.config.enableApolloSandbox ? true : undefined,
        plugins,
      });

      console.log('Starting Apollo Server...');
      await this.server.start();
      console.log(
        `Initial supergraph composition succeeded with ${initialComposition.includedSubgraphs.length} subgraphs.`
      );
      console.log('Apollo Server started successfully');
    } catch (error: any) {
      const details = error instanceof Error ? (error.stack || error.message) : String(error);
      console.error('Failed to start Apollo Gateway, continuing without GraphQL endpoint:', details);
      this.gateway = undefined;
      this.server = undefined;
    }
  }

  private startSchemaRefreshLoop(): void {
    if (!this.config.enableSchemaRefresh) {
      console.log('Schema refresh is disabled by ENABLE_SCHEMA_REFRESH=false.');
      return;
    }

    if (!this.supergraphUpdate || !this.discoveryManager) {
      console.warn('Schema refresh is enabled but no running supergraph is available to refresh.');
      return;
    }

    const refreshIntervalMs = this.config.schemaRefreshIntervalSeconds * 1000;
    this.schemaRefreshTimer = setInterval(() => {
      void this.refreshSchema();
    }, refreshIntervalMs);
    this.schemaRefreshTimer.unref?.();

    console.log(`Schema refresh enabled; interval is ${this.config.schemaRefreshIntervalSeconds} seconds.`);
  }

  private async refreshSchema(): Promise<void> {
    if (this.isRefreshingSchema || !this.discoveryManager || !this.supergraphUpdate) {
      return;
    }

    this.isRefreshingSchema = true;

    try {
      const discoveredServices = await this.discoveryManager.discoverServices();
      const compositionResult = await this.composeDiscoveredServices(discoveredServices);

      this.logExcludedSubgraphs(compositionResult.excludedSubgraphs, 'refresh');

      if (!compositionResult.supergraphSdl) {
        console.error('Schema refresh failed while keeping previous schema.');
        return;
      }

      this.supergraphUpdate(compositionResult.supergraphSdl);
      await this.loadRbacPoliciesFromSubgraphs(compositionResult.includedSubgraphs);
      this.activeSubgraphs = compositionResult.includedSubgraphs;

      console.log(
        `Schema refresh succeeded with ${compositionResult.includedSubgraphs.length} subgraphs.`
      );
    } catch (error: any) {
      console.error(
        `Schema refresh failed while keeping previous schema: ${error?.message || String(error)}`
      );
    } finally {
      this.isRefreshingSchema = false;
    }
  }

  private async composeDiscoveredServices(services: SubgraphService[]): Promise<{
    supergraphSdl?: string;
    includedSubgraphs: SubgraphService[];
    excludedSubgraphs: Array<{ service: SubgraphService; reason: string }>;
  }> {
    const discoveredNames = services.map((service) => service.name);
    console.log(
      `Discovered subgraphs (${services.length}): ${discoveredNames.length > 0 ? discoveredNames.join(', ') : 'none'}`
    );

    const excludedSubgraphs: Array<{ service: SubgraphService; reason: string }> = [];
    const includedSubgraphs: SubgraphService[] = [];
    const serviceDefinitions: ConstructorParameters<typeof LocalCompose>[0]['localServiceList'] = [];

    const introspectionResults = await Promise.all(
      services.map(async (service) => {
        try {
          const sdl = await this.fetchSubgraphSdl(service);
          return { service, sdl };
        } catch (error: any) {
          return { service, error };
        }
      })
    );

    for (const result of introspectionResults) {
      if ('error' in result) {
        excludedSubgraphs.push({
          service: result.service,
          reason: result.error?.message || 'introspection failed',
        });
        continue;
      }

      try {
        includedSubgraphs.push(result.service);
        serviceDefinitions.push({
          name: result.service.name,
          url: result.service.url,
          typeDefs: parse(result.sdl),
        });
      } catch (error: any) {
        includedSubgraphs.pop();
        excludedSubgraphs.push({
          service: result.service,
          reason: `SDL parse failed: ${error?.message || String(error)}`,
        });
      }
    }

    if (serviceDefinitions.length === 0) {
      console.error('No subgraphs could be introspected for composition.');
      return {
        includedSubgraphs: [],
        excludedSubgraphs,
      };
    }

    try {
      const localCompose = new LocalCompose({ localServiceList: serviceDefinitions });
      const compositionResult = await localCompose.initialize({
        update: () => {
          // No-op: composition is used here as a one-shot helper.
        },
        getDataSource: ({ url }) => new RemoteGraphQLDataSource({ url }),
        healthCheck: async () => {
          // No-op: each subgraph was already contacted during SDL fetch.
        },
      });

      return {
        supergraphSdl: compositionResult.supergraphSdl,
        includedSubgraphs,
        excludedSubgraphs,
      };
    } catch (error: any) {
      console.error(`Composition failed with introspected subgraphs: ${error?.message || String(error)}`);
      return {
        includedSubgraphs: [],
        excludedSubgraphs,
      };
    }
  }

  private async fetchSubgraphSdl(service: SubgraphService): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (this.cloudRunAuthManager) {
      try {
        const identityToken = await this.cloudRunAuthManager.getIdentityToken(service.url);
        headers.Authorization = `Bearer ${identityToken}`;
      } catch (error: any) {
        throw new Error(`failed to get identity token: ${error?.message || String(error)}`);
      }
    }

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      ApolloCloudGateway.SUBGRAPH_INTROSPECTION_TIMEOUT_MS
    );

    let response: Response;
    try {
      response = await fetch(service.url, {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          query: 'query __ApolloGetServiceDefinition__ { _service { sdl } }',
        }),
      });
    } catch (error: any) {
      if (abortController.signal.aborted) {
        throw new Error(
          `introspection timed out after ${ApolloCloudGateway.SUBGRAPH_INTROSPECTION_TIMEOUT_MS}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: { _service?: { sdl?: string } };
      errors?: Array<{ message?: string }> | unknown;
    };

    if (payload.errors) {
      const errorMessage = Array.isArray(payload.errors)
        ? payload.errors.map((error) => error.message || String(error)).join('; ')
        : String(payload.errors);
      throw new Error(`introspection errors: ${errorMessage}`);
    }

    const sdl = payload.data?._service?.sdl;
    if (!sdl) {
      throw new Error('introspection returned no SDL');
    }

    return sdl;
  }

  private logExcludedSubgraphs(
    excludedSubgraphs: Array<{ service: SubgraphService; reason: string }>,
    phase: 'startup' | 'refresh'
  ): void {
    if (excludedSubgraphs.length === 0) {
      return;
    }

    console.warn(
      `Excluded subgraphs during ${phase}: ${excludedSubgraphs
        .map(({ service, reason }) => `${service.name} (${reason})`)
        .join(', ')}`
    );
  }

  private setupExpress(): void {
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));

    this.app.use(
      createBaseRouter({
        csrfCookieName: ApolloCloudGateway.CSRF_COOKIE,
        buildCookieOptions: (httpOnly) => this.buildCookieOptions(httpOnly),
        buildAdminConsoleFirebaseConfig: () => this.buildAdminConsoleFirebaseConfig(),
      })
    );

    this.app.use(
      createSessionRouter({
        authCookieName: ApolloCloudGateway.AUTH_TOKEN_COOKIE,
        csrfCookieName: ApolloCloudGateway.CSRF_COOKIE,
        csrfHeaderName: ApolloCloudGateway.CSRF_HEADER,
        sessionCookieMaxAgeMs: this.sessionCookieMaxAgeMs,
        authManager: this.authManager,
        buildCookieOptions: (httpOnly) => this.buildCookieOptions(httpOnly),
      })
    );

    if (this.config.adminConsoleEnabled) {
      this.setupAdminConsole();
    }

    this.setupGraphqlRoute();
  }

  private setupGraphqlRoute(): void {
    if (this.server) {
      this.app.use('/graphql', (req, res, next) => {
        if (this.authManager.extractTokenFromHeader(req.headers.authorization)) {
          next();
          return;
        }

        const cookieToken = extractCookieValue(
          req.headers.cookie,
          ApolloCloudGateway.AUTH_TOKEN_COOKIE
        );
        if (!cookieToken) {
          next();
          return;
        }

        if (!this.validateCsrfToken(req)) {
          res.status(403).json({ error: 'Forbidden', message: 'Invalid CSRF token' });
          return;
        }

        next();
      });

      this.app.use(
        '/graphql',
        expressMiddleware(this.server, {
          context: async ({ req }): Promise<ApolloCloudContext> => {
            const authHeader = req.headers.authorization;
            const cookieHeader = req.headers.cookie;
            let user: UserContext | undefined = undefined;

            const headerToken = this.authManager.extractTokenFromHeader(authHeader);
            const cookieToken = this.extractTokenFromCookies(cookieHeader);

            if (headerToken) {
              const verifiedUser = await this.authManager.verifyToken(headerToken);
              user = verifiedUser || undefined;
            }

            if (!user && cookieToken) {
              const verifiedUser = await this.authManager.verifySessionCookie(cookieToken);
              user = verifiedUser || undefined;
            }

            return { user, req };
          }
        })
      );
      console.log('GraphQL endpoint registered at /graphql');
    } else {
      console.warn('GraphQL gateway not initialized; /graphql endpoint will not be available.');
    }
  }

  /**
   * Setup admin console routes and API
   */
  private setupAdminConsole(): void {
    console.log('Admin console enabled, setting up routes...');

    this.adminApiController = new AdminApiController(
      this.discoveryManager,
      this.config.discoveryMode,
      this.authManager,
      this.cloudRunAuthManager,
      this.config.graphName,
      this.config.graphLabelKey,
      () => this.activeSubgraphs
    );

    const adminGuard = new AdminAuthGuard(this.authManager);

    this.app.use('/admin/api', adminGuard.middleware(), this.adminApiController.getRouter());

    const consoleHandler = new AdminConsoleHandler();
    
    this.app.use('/admin/console', consoleHandler.serveStatic());
    
    this.app.get('/admin/console/*', consoleHandler.serveSPA());

    console.log('Admin console routes configured at /admin/console and /admin/api');
  }

  private async loadRbacPoliciesFromSubgraphs(services: SubgraphService[]): Promise<void> {
    RBACManager.clearPolicies();

    if (services.length === 0) {
      return;
    }

    await Promise.all(
      services.map(async (service) => {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (this.cloudRunAuthManager) {
            const identityToken = await this.cloudRunAuthManager.getIdentityToken(service.url);
            headers.Authorization = `Bearer ${identityToken}`;
          }

          const abortController = new AbortController();
          const timeout = setTimeout(
            () => abortController.abort(),
            ApolloCloudGateway.RBAC_POLICY_PRELOAD_TIMEOUT_MS
          );

          let response: globalThis.Response;
          try {
            response = await fetch(service.url, {
              method: 'POST',
              headers,
              signal: abortController.signal,
              body: JSON.stringify({
                query: 'query __ApolloGetServiceDefinition__ { _service { sdl } }',
              }),
            });
          } catch (error: any) {
            if (abortController.signal.aborted) {
              console.warn(
                `RBAC policy preload failed for ${service.name}: timed out after ${ApolloCloudGateway.RBAC_POLICY_PRELOAD_TIMEOUT_MS}ms`
              );
              return;
            }
            throw error;
          } finally {
            clearTimeout(timeout);
          }

          if (!response.ok) {
            console.warn(`RBAC policy preload failed for ${service.name}: HTTP ${response.status}`);
            return;
          }

          const payload = (await response.json()) as {
            data?: { _service?: { sdl?: string } };
            errors?: unknown;
          };

          if (payload.errors || !payload.data?._service?.sdl) {
            console.warn(`RBAC policy preload returned no SDL for ${service.name}`);
            return;
          }

          RBACManager.registerPoliciesFromSDL(payload.data._service.sdl);
        } catch (error: any) {
          console.warn(
            `RBAC policy preload failed for ${service.name}: ${error?.message || String(error)}`
          );
        }
      })
    );
  }

  private extractTokenFromCookies(cookieHeader?: string): string | null {
    const rawValue = extractCookieValue(cookieHeader, ApolloCloudGateway.AUTH_TOKEN_COOKIE);
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  private extractCsrfQueryToken(req: Request): string | null {
    const csrfQuery = req.query?.csrfToken;
    if (Array.isArray(csrfQuery)) {
      return typeof csrfQuery[0] === 'string' ? csrfQuery[0] : null;
    }
    return typeof csrfQuery === 'string' ? csrfQuery : null;
  }

  private validateCsrfToken(req: Request): boolean {
    const csrfCookie = extractCookieValue(req.headers.cookie, ApolloCloudGateway.CSRF_COOKIE);
    const csrfToken =
      extractCsrfHeader(req, ApolloCloudGateway.CSRF_HEADER) || this.extractCsrfQueryToken(req);
    return Boolean(csrfCookie && csrfToken && csrfCookie === csrfToken);
  }

  private buildCookieOptions(httpOnly: boolean): express.CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      maxAge: this.sessionCookieMaxAgeMs,
      httpOnly,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
  }

  private buildAdminConsoleFirebaseConfig(): Record<string, string> {
    const config: Record<string, string> = {};

    if (this.config.adminConsoleFirebaseApiKey) {
      config.apiKey = this.config.adminConsoleFirebaseApiKey;
    }
    if (this.config.adminConsoleFirebaseAuthDomain) {
      config.authDomain = this.config.adminConsoleFirebaseAuthDomain;
    }
    if (this.config.adminConsoleFirebaseProjectId) {
      config.projectId = this.config.adminConsoleFirebaseProjectId;
    }
    if (this.config.adminConsoleFirebaseStorageBucket) {
      config.storageBucket = this.config.adminConsoleFirebaseStorageBucket;
    }
    if (this.config.adminConsoleFirebaseMessagingSenderId) {
      config.messagingSenderId = this.config.adminConsoleFirebaseMessagingSenderId;
    }
    if (this.config.adminConsoleFirebaseAppId) {
      config.appId = this.config.adminConsoleFirebaseAppId;
    }
    if (this.config.adminConsoleFirebaseMeasurementId) {
      config.measurementId = this.config.adminConsoleFirebaseMeasurementId;
    }
    if (this.config.adminConsoleFirebaseAuthEmulatorUrl) {
      config.authEmulatorUrl = this.config.adminConsoleFirebaseAuthEmulatorUrl;
    }

    return config;
  }
}
