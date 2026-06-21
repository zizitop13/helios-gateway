import { GatewayConfig } from '../types';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): GatewayConfig {
  const rawDiscoveryMode = (process.env.DISCOVERY_MODE || 'cloudrun').toLowerCase();
  const discoveryMode: GatewayConfig['discoveryMode'] =
    rawDiscoveryMode === 'docker' || rawDiscoveryMode === 'file' || rawDiscoveryMode === 'cloudrun'
      ? rawDiscoveryMode
      : 'cloudrun';
  const refreshIntervalSeconds = Number.parseInt(
    process.env.SCHEMA_REFRESH_INTERVAL_SECONDS || '60',
    10
  );

  return {
    port: parseInt(process.env.PORT || '4000', 10),
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseServiceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    gcpProjectId: process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    gcpRegion: process.env.GCP_REGION || 'us-central1',
    discoveryMode,
    dockerSocketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    discoveryFilePath: process.env.DISCOVERY_FILE_PATH?.trim() || undefined,
    discoveryFileDefaultHost: process.env.DISCOVERY_FILE_DEFAULT_HOST?.trim() || undefined,
    graphName: process.env.GRAPH_NAME?.trim() || undefined,
    graphLabelKey: process.env.GRAPH_LABEL_KEY?.trim() || 'graph',
    adminConsoleFirebaseApiKey: process.env.ADMIN_CONSOLE_FIREBASE_API_KEY?.trim() || undefined,
    adminConsoleFirebaseAuthDomain: process.env.ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    adminConsoleFirebaseProjectId: process.env.ADMIN_CONSOLE_FIREBASE_PROJECT_ID?.trim() || undefined,
    adminConsoleFirebaseStorageBucket: process.env.ADMIN_CONSOLE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    adminConsoleFirebaseMessagingSenderId: process.env.ADMIN_CONSOLE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    adminConsoleFirebaseAppId: process.env.ADMIN_CONSOLE_FIREBASE_APP_ID?.trim() || undefined,
    adminConsoleFirebaseMeasurementId: process.env.ADMIN_CONSOLE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
    adminConsoleFirebaseAuthEmulatorUrl: process.env.ADMIN_CONSOLE_FIREBASE_AUTH_EMULATOR_URL?.trim() || undefined,
    adminConsoleEnabled: process.env.ADMIN_CONSOLE_ENABLED === 'true',
    enableApolloSandbox: process.env.ENABLE_APOLLO_SANDBOX === 'true',
    enableSchemaRefresh: process.env.ENABLE_SCHEMA_REFRESH !== 'false',
    schemaRefreshIntervalSeconds:
      Number.isFinite(refreshIntervalSeconds) && refreshIntervalSeconds > 0
        ? refreshIntervalSeconds
        : 60,
    enableCloudRunIamAuth: process.env.ENABLE_CLOUD_RUN_IAM_AUTH === 'true'
  };
}

/**
 * Validate required configuration
 */
export function validateConfig(config: GatewayConfig): void {
  const errors: string[] = [];

  if (config.discoveryMode === 'cloudrun' && !config.gcpProjectId) {
    errors.push('GCP_PROJECT_ID or FIREBASE_PROJECT_ID must be set when using cloudrun discovery mode');
  }

  if (config.discoveryMode === 'file' && !config.discoveryFilePath) {
    errors.push('DISCOVERY_FILE_PATH must be set when using file discovery mode');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
