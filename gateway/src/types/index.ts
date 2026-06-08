import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Context object passed to GraphQL resolvers
 */
export interface ApolloCloudContext {
  user?: UserContext;
  req: any;
}

/**
 * User information extracted from Firebase JWT
 */
export interface UserContext {
  uid: string;
  email?: string;
  roles: string[];
  claims: Record<string, any>;
}

/**
 * Configuration for the gateway
 */
export interface GatewayConfig {
  port: number;
  firebaseProjectId?: string;
  firebaseServiceAccountKey?: string;
  gcpProjectId?: string;
  gcpRegion?: string;
  discoveryMode?: 'cloudrun' | 'docker' | 'file';
  dockerSocketPath?: string;
  discoveryFilePath?: string;
  discoveryFileDefaultHost?: string;
  graphName?: string;
  graphLabelKey?: string;
  adminConsoleFirebaseApiKey?: string;
  adminConsoleFirebaseAuthDomain?: string;
  adminConsoleFirebaseProjectId?: string;
  adminConsoleFirebaseStorageBucket?: string;
  adminConsoleFirebaseMessagingSenderId?: string;
  adminConsoleFirebaseAppId?: string;
  adminConsoleFirebaseMeasurementId?: string;
  adminConsoleEnabled: boolean;
  enableApolloSandbox: boolean;
  enableSchemaRefresh: boolean;
  schemaRefreshIntervalSeconds: number;
  enableCloudRunIamAuth: boolean;
}

/**
 * Cloud Run service metadata
 */
export interface SubgraphService {
  name: string;
  url: string;
  labels: Record<string, string>;
}

/**
 * RBAC directive arguments
 */
export interface RequiresRoleDirectiveArgs {
  roles: string[];
  match: 'ANY' | 'ALL';
}

/**
 * Firebase decoded token with custom claims
 */
export interface FirebaseDecodedToken extends DecodedIdToken {
  roles?: string[];
  [key: string]: any;
}
