#!/usr/bin/env node

import { startGateway } from './app/bootstrap/startGateway';

type CliOptions = {
  discoveryMode?: string;
  discoveryFilePath?: string;
  discoveryFileDefaultHost?: string;
  port?: string;
  firebaseProjectId?: string;
  firebaseServiceAccountKey?: string;
  gcpProjectId?: string;
  gcpRegion?: string;
  dockerSocketPath?: string;
  graphName?: string;
  graphLabelKey?: string;
  adminConsoleEnabled?: boolean;
  enableApolloSandbox?: boolean;
  enableCloudRunIamAuth?: boolean;
  superAdminId?: string;
  googleApplicationCredentials?: string;
  tokenExpiresInDays?: string;
};

function readRequiredValue(flag: string, nextValue: string | undefined): string {
  if (!nextValue || nextValue.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return nextValue;
}

function parseBooleanValue(flag: string, rawValue: string): boolean {
  const normalizedValue = rawValue.toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Invalid value for ${flag}: ${rawValue}. Expected true or false.`);
}

function readOptionalBooleanValue(
  flag: string,
  nextValue: string | undefined
): { value: boolean; consumedNextValue: boolean } {
  if (!nextValue || nextValue.startsWith('-')) {
    return { value: true, consumedNextValue: false };
  }

  return {
    value: parseBooleanValue(flag, nextValue),
    consumedNextValue: true,
  };
}

type BooleanOption = 'adminConsoleEnabled' | 'enableApolloSandbox' | 'enableCloudRunIamAuth';
type StringOption = Exclude<keyof CliOptions, BooleanOption>;

const valueOptions: Array<[StringOption, string, ...string[]]> = [
  ['discoveryMode', '--discovery', '-d'],
  ['discoveryFilePath', '--file', '-f', '--discovery-file-path'],
  ['discoveryFileDefaultHost', '--host', '--file-default-host', '--discovery-file-default-host'],
  ['port', '--port', '-p'],
  ['firebaseProjectId', '--firebase-project-id'],
  ['firebaseServiceAccountKey', '--firebase-service-account-key'],
  ['gcpProjectId', '--gcp-project-id'],
  ['gcpRegion', '--region', '-r', '--gcp-region'],
  ['dockerSocketPath', '--socket', '-s', '--docker-socket-path'],
  ['graphName', '--graph', '-g', '--graph-name'],
  ['graphLabelKey', '--graph-label-key'],
  ['superAdminId', '--super-admin-id'],
  ['googleApplicationCredentials', '--credentials', '--google-application-credentials'],
  ['tokenExpiresInDays', '--token-expires-in-days'],
];
const valueFlags = new Map(valueOptions.flatMap(([key, canonical, ...aliases]) =>
  [canonical, ...aliases].map(flag => [flag, { key, canonical }] as const)
));
const booleanFlags = new Map<string, BooleanOption>([
  ['--admin-console', 'adminConsoleEnabled'],
  ['--apollo-sandbox', 'enableApolloSandbox'],
  ['--cloud-run-iam-auth', 'enableCloudRunIamAuth'],
]);

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === 'run') continue;

    const valueOption = valueFlags.get(arg);
    if (valueOption) {
      options[valueOption.key] = readRequiredValue(valueOption.canonical, argv[i + 1]);
      i += 1;
      continue;
    }
    const booleanKey = booleanFlags.get(arg);
    if (booleanKey) {
      const parsedValue = readOptionalBooleanValue(arg, argv[i + 1]);
      options[booleanKey] = parsedValue.value;
      if (parsedValue.consumedNextValue) i += 1;
      continue;
    }
    const negativeKey = arg.startsWith('--no-') ? booleanFlags.get(`--${arg.slice(5)}`) : undefined;
    if (negativeKey) {
      options[negativeKey] = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function applyCliOptionsToEnv(options: CliOptions): void {
  if (options.discoveryMode) {
    process.env.DISCOVERY_MODE = options.discoveryMode;
  }
  if (options.discoveryFilePath) {
    process.env.DISCOVERY_FILE_PATH = options.discoveryFilePath;
  }
  if (options.discoveryFileDefaultHost) {
    process.env.DISCOVERY_FILE_DEFAULT_HOST = options.discoveryFileDefaultHost;
  }
  if (options.port) {
    process.env.PORT = options.port;
  }
  if (options.firebaseProjectId) {
    process.env.FIREBASE_PROJECT_ID = options.firebaseProjectId;
  }
  if (options.firebaseServiceAccountKey) {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = options.firebaseServiceAccountKey;
  }
  if (options.gcpProjectId) {
    process.env.GCP_PROJECT_ID = options.gcpProjectId;
  }
  if (options.gcpRegion) {
    process.env.GCP_REGION = options.gcpRegion;
  }
  if (options.dockerSocketPath) {
    process.env.DOCKER_SOCKET_PATH = options.dockerSocketPath;
  }
  if (options.graphName) {
    process.env.GRAPH_NAME = options.graphName;
  }
  if (options.graphLabelKey) {
    process.env.GRAPH_LABEL_KEY = options.graphLabelKey;
  }
  if (options.adminConsoleEnabled !== undefined) {
    process.env.ADMIN_CONSOLE_ENABLED = String(options.adminConsoleEnabled);
  }
  if (options.enableApolloSandbox !== undefined) {
    process.env.ENABLE_APOLLO_SANDBOX = String(options.enableApolloSandbox);
  }
  if (options.enableCloudRunIamAuth !== undefined) {
    process.env.ENABLE_CLOUD_RUN_IAM_AUTH = String(options.enableCloudRunIamAuth);
  }
  if (options.superAdminId) {
    process.env.SUPER_ADMIN_ID = options.superAdminId;
  }
  if (options.googleApplicationCredentials) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = options.googleApplicationCredentials;
  }
  if (options.tokenExpiresInDays) {
    process.env.TOKEN_EXPIRES_IN_DAYS = options.tokenExpiresInDays;
  }
}

function printUsage(): void {
  console.log('Usage: apollo-gateway run [options]');
  console.log('Options:');
  console.log('  -d, --discovery <mode>                        Discovery mode (cloudrun, docker, file)');
  console.log('  -f, --file, --discovery-file-path <path>     File discovery config path for file mode');
  console.log('      --host, --file-default-host <host>       Default host for file discovery URLs');
  console.log('  -p, --port <port>                            Gateway port');
  console.log('      --firebase-project-id <id>               Firebase project id');
  console.log('      --firebase-service-account-key <path>    Firebase service account key path');
  console.log('      --gcp-project-id <id>                    GCP project id for Cloud Run discovery');
  console.log('  -r, --region, --gcp-region <region>          GCP region for Cloud Run discovery');
  console.log('  -s, --socket, --docker-socket-path <path>    Docker socket path for docker discovery');
  console.log('  -g, --graph, --graph-name <name>             Graph name used for discovery filtering');
  console.log('      --graph-label-key <key>                  Graph label key used for discovery filtering');
  console.log('      --admin-console [true|false]             Enable or disable the admin console');
  console.log('      --no-admin-console                       Disable the admin console');
  console.log('      --apollo-sandbox [true|false]            Enable embedded Apollo Sandbox at /graphql');
  console.log('      --no-apollo-sandbox                      Disable embedded Apollo Sandbox');
  console.log('      --cloud-run-iam-auth [true|false]        Enable or disable Cloud Run IAM auth');
  console.log('      --no-cloud-run-iam-auth                  Disable Cloud Run IAM auth');
  console.log('      --super-admin-id <value>                 UID or email that bypasses admin role checks');
  console.log('      --credentials <path>                     Path for GOOGLE_APPLICATION_CREDENTIALS');
  console.log('      --token-expires-in-days <days>           Session cookie lifetime in days');
  console.log('  --help                                       Show help');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (args[0] !== 'run') {
    console.error('First argument must be "run".');
    printUsage();
    process.exit(1);
  }

  try {
    const options = parseCliArgs(args);
    applyCliOptionsToEnv(options);
    await startGateway();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


