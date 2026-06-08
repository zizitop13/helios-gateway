import { applyCliOptionsToEnv, parseCliArgs } from '../cli';

describe('CLI', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses run flags for file discovery', () => {
    const options = parseCliArgs([
      'run',
      '-d',
      'file',
      '--discovery-file-path',
      './subgraphs.local.yaml',
      '--file-default-host',
      'localhost',
      '--port',
      '4100',
      '--firebase-project-id',
      'firebase-project',
      '--firebase-service-account-key',
      './service-account.json',
      '--gcp-project-id',
      'gcp-project',
      '--region',
      'europe-west3',
      '--graph',
      'pet-shop',
      '--graph-label-key',
      'apollo-graph',
      '--admin-console',
      '--apollo-sandbox',
      '--cloud-run-iam-auth',
      '--super-admin-id',
      'admin@example.com',
      '--credentials',
      './adc.json',
      '--token-expires-in-days',
      '10',
    ]);

    expect(options).toEqual({
      discoveryMode: 'file',
      discoveryFilePath: './subgraphs.local.yaml',
      discoveryFileDefaultHost: 'localhost',
      port: '4100',
      firebaseProjectId: 'firebase-project',
      firebaseServiceAccountKey: './service-account.json',
      gcpProjectId: 'gcp-project',
      gcpRegion: 'europe-west3',
      graphName: 'pet-shop',
      graphLabelKey: 'apollo-graph',
      adminConsoleEnabled: true,
      enableApolloSandbox: true,
      enableCloudRunIamAuth: true,
      superAdminId: 'admin@example.com',
      googleApplicationCredentials: './adc.json',
      tokenExpiresInDays: '10',
    });
  });

  it('parses docker and boolean disable flags', () => {
    const options = parseCliArgs([
      'run',
      '--discovery',
      'docker',
      '--socket',
      '/var/run/custom.sock',
      '--no-admin-console',
      '--no-apollo-sandbox',
      '--cloud-run-iam-auth',
      'false',
    ]);

    expect(options).toEqual({
      discoveryMode: 'docker',
      dockerSocketPath: '/var/run/custom.sock',
      adminConsoleEnabled: false,
      enableApolloSandbox: false,
      enableCloudRunIamAuth: false,
    });
  });

  it('throws for unknown arguments', () => {
    expect(() => parseCliArgs(['run', '--unknown'])).toThrow('Unknown argument: --unknown');
  });

  it('throws for missing required values', () => {
    expect(() => parseCliArgs(['run', '--gcp-project-id'])).toThrow('Missing value for --gcp-project-id');
  });

  it('throws for invalid boolean values', () => {
    expect(() => parseCliArgs(['run', '--admin-console', 'maybe'])).toThrow(
      'Invalid value for --admin-console: maybe. Expected true or false.'
    );
  });

  it('applies parsed options to process environment', () => {
    applyCliOptionsToEnv({
      discoveryMode: 'file',
      discoveryFilePath: './services.yaml',
      discoveryFileDefaultHost: '127.0.0.1',
      port: '4500',
      firebaseProjectId: 'firebase-project',
      firebaseServiceAccountKey: './service-account.json',
      gcpProjectId: 'gcp-project',
      gcpRegion: 'europe-west3',
      dockerSocketPath: '/var/run/custom.sock',
      graphName: 'pet-shop',
      graphLabelKey: 'apollo-graph',
      adminConsoleEnabled: true,
      enableApolloSandbox: true,
      enableCloudRunIamAuth: false,
      superAdminId: 'admin@example.com',
      googleApplicationCredentials: './adc.json',
      tokenExpiresInDays: '10',
    });

    expect(process.env.DISCOVERY_MODE).toBe('file');
    expect(process.env.DISCOVERY_FILE_PATH).toBe('./services.yaml');
    expect(process.env.DISCOVERY_FILE_DEFAULT_HOST).toBe('127.0.0.1');
    expect(process.env.PORT).toBe('4500');
    expect(process.env.FIREBASE_PROJECT_ID).toBe('firebase-project');
    expect(process.env.FIREBASE_SERVICE_ACCOUNT_KEY).toBe('./service-account.json');
    expect(process.env.GCP_PROJECT_ID).toBe('gcp-project');
    expect(process.env.GCP_REGION).toBe('europe-west3');
    expect(process.env.DOCKER_SOCKET_PATH).toBe('/var/run/custom.sock');
    expect(process.env.GRAPH_NAME).toBe('pet-shop');
    expect(process.env.GRAPH_LABEL_KEY).toBe('apollo-graph');
    expect(process.env.ADMIN_CONSOLE_ENABLED).toBe('true');
    expect(process.env.ENABLE_APOLLO_SANDBOX).toBe('true');
    expect(process.env.ENABLE_CLOUD_RUN_IAM_AUTH).toBe('false');
    expect(process.env.SUPER_ADMIN_ID).toBe('admin@example.com');
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe('./adc.json');
    expect(process.env.TOKEN_EXPIRES_IN_DAYS).toBe('10');
  });
});
