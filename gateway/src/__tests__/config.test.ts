import { loadConfig, validateConfig } from '../utils';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default values when env vars are not set', () => {
      delete process.env.PORT;
      delete process.env.GCP_PROJECT_ID;
      delete process.env.GCP_REGION;
      delete process.env.ENABLE_CLOUD_RUN_IAM_AUTH;
      delete process.env.ENABLE_SCHEMA_REFRESH;
      delete process.env.SCHEMA_REFRESH_INTERVAL_SECONDS;

      const config = loadConfig();

      expect(config.port).toBe(4000);
      expect(config.gcpRegion).toBe('us-central1');
      expect(config.enableApolloSandbox).toBe(false);
      expect(config.enableSchemaRefresh).toBe(true);
      expect(config.schemaRefreshIntervalSeconds).toBe(60);
      expect(config.enableCloudRunIamAuth).toBe(false);
    });

    it('should load values from environment variables', () => {
      process.env.PORT = '8080';
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.GCP_REGION = 'europe-west1';

      const config = loadConfig();

      expect(config.port).toBe(8080);
      expect(config.gcpProjectId).toBe('test-project');
      expect(config.gcpRegion).toBe('europe-west1');
    });

    it('should use FIREBASE_PROJECT_ID as fallback for GCP_PROJECT_ID', () => {
      delete process.env.GCP_PROJECT_ID;
      process.env.FIREBASE_PROJECT_ID = 'firebase-project';

      const config = loadConfig();

      expect(config.gcpProjectId).toBe('firebase-project');
    });

    it('should enable Cloud Run IAM auth when ENABLE_CLOUD_RUN_IAM_AUTH is true', () => {
      process.env.ENABLE_CLOUD_RUN_IAM_AUTH = 'true';

      const config = loadConfig();

      expect(config.enableCloudRunIamAuth).toBe(true);
    });

    it('should enable Apollo Sandbox when ENABLE_APOLLO_SANDBOX is true', () => {
      process.env.ENABLE_APOLLO_SANDBOX = 'true';

      const config = loadConfig();

      expect(config.enableApolloSandbox).toBe(true);
    });

    it('should disable Apollo Sandbox when ENABLE_APOLLO_SANDBOX is false', () => {
      process.env.ENABLE_APOLLO_SANDBOX = 'false';

      const config = loadConfig();

      expect(config.enableApolloSandbox).toBe(false);
    });

    it('should disable schema refresh when ENABLE_SCHEMA_REFRESH is false', () => {
      process.env.ENABLE_SCHEMA_REFRESH = 'false';

      const config = loadConfig();

      expect(config.enableSchemaRefresh).toBe(false);
    });

    it('should use custom schema refresh interval from env', () => {
      process.env.SCHEMA_REFRESH_INTERVAL_SECONDS = '15';

      const config = loadConfig();

      expect(config.schemaRefreshIntervalSeconds).toBe(15);
    });

    it('should disable Cloud Run IAM auth when ENABLE_CLOUD_RUN_IAM_AUTH is false', () => {
      process.env.ENABLE_CLOUD_RUN_IAM_AUTH = 'false';

      const config = loadConfig();

      expect(config.enableCloudRunIamAuth).toBe(false);
    });

    it('should disable Cloud Run IAM auth by default', () => {
      delete process.env.ENABLE_CLOUD_RUN_IAM_AUTH;

      const config = loadConfig();

      expect(config.enableCloudRunIamAuth).toBe(false);
    });

    it('should load file discovery configuration from environment variables', () => {
      process.env.DISCOVERY_MODE = 'file';
      process.env.DISCOVERY_FILE_PATH = '/etc/apollo/subgraphs.yaml';
      process.env.DISCOVERY_FILE_DEFAULT_HOST = 'localhost';

      const config = loadConfig();

      expect(config.discoveryMode).toBe('file');
      expect(config.discoveryFilePath).toBe('/etc/apollo/subgraphs.yaml');
      expect(config.discoveryFileDefaultHost).toBe('localhost');
    });

    it('should load admin console Firebase config from environment variables', () => {
      process.env.ADMIN_CONSOLE_FIREBASE_API_KEY = 'api-key';
      process.env.ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN = 'example.firebaseapp.com';
      process.env.ADMIN_CONSOLE_FIREBASE_PROJECT_ID = 'example-project';
      process.env.ADMIN_CONSOLE_FIREBASE_STORAGE_BUCKET = 'example.appspot.com';
      process.env.ADMIN_CONSOLE_FIREBASE_MESSAGING_SENDER_ID = '123456789';
      process.env.ADMIN_CONSOLE_FIREBASE_APP_ID = '1:123456789:web:abc';
      process.env.ADMIN_CONSOLE_FIREBASE_MEASUREMENT_ID = 'G-ABCDE12345';

      const config = loadConfig();

      expect(config.adminConsoleFirebaseApiKey).toBe('api-key');
      expect(config.adminConsoleFirebaseAuthDomain).toBe('example.firebaseapp.com');
      expect(config.adminConsoleFirebaseProjectId).toBe('example-project');
      expect(config.adminConsoleFirebaseStorageBucket).toBe('example.appspot.com');
      expect(config.adminConsoleFirebaseMessagingSenderId).toBe('123456789');
      expect(config.adminConsoleFirebaseAppId).toBe('1:123456789:web:abc');
      expect(config.adminConsoleFirebaseMeasurementId).toBe('G-ABCDE12345');
    });
  });

  describe('validateConfig', () => {
    it('should throw error when GCP_PROJECT_ID is missing', () => {
      const config = loadConfig();
      config.discoveryMode = 'cloudrun';
      config.gcpProjectId = undefined;

      expect(() => validateConfig(config)).toThrow('GCP_PROJECT_ID or FIREBASE_PROJECT_ID must be set');
    });

    it('should not throw when GCP_PROJECT_ID is set', () => {
      const config = loadConfig();
      config.discoveryMode = 'cloudrun';
      config.gcpProjectId = 'test-project';

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error when DISCOVERY_FILE_PATH is missing in file mode', () => {
      const config = loadConfig();
      config.discoveryMode = 'file';
      config.discoveryFilePath = undefined;

      expect(() => validateConfig(config)).toThrow('DISCOVERY_FILE_PATH must be set');
    });

    it('should not throw when DISCOVERY_FILE_PATH is set in file mode', () => {
      const config = loadConfig();
      config.discoveryMode = 'file';
      config.discoveryFilePath = '/tmp/subgraphs.yaml';

      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});
