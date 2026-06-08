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

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextValue = argv[i + 1];

    if (arg === 'run') {
      continue;
    }

    if (arg === '-d' || arg === '--discovery') {
      options.discoveryMode = readRequiredValue('--discovery', nextValue);
      i += 1;
      continue;
    }

    if (arg === '-f' || arg === '--file' || arg === '--discovery-file-path') {
      options.discoveryFilePath = readRequiredValue('--file', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--host' || arg === '--file-default-host' || arg === '--discovery-file-default-host') {
      options.discoveryFileDefaultHost = readRequiredValue('--host', nextValue);
      i += 1;
      continue;
    }

    if (arg === '-p' || arg === '--port') {
      options.port = readRequiredValue('--port', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--firebase-project-id') {
      options.firebaseProjectId = readRequiredValue('--firebase-project-id', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--firebase-service-account-key') {
      options.firebaseServiceAccountKey = readRequiredValue('--firebase-service-account-key', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--gcp-project-id') {
      options.gcpProjectId = readRequiredValue('--gcp-project-id', nextValue);
      i += 1;
      continue;
    }

    if (arg === '-r' || arg === '--region' || arg === '--gcp-region') {
      options.gcpRegion = readRequiredValue('--region', nextValue);
      i += 1;
      continue;
    }

    if (arg === '-s' || arg === '--socket' || arg === '--docker-socket-path') {
      options.dockerSocketPath = readRequiredValue('--socket', nextValue);
      i += 1;
      continue;
    }

    if (arg === '-g' || arg === '--graph' || arg === '--graph-name') {
      options.graphName = readRequiredValue('--graph', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--graph-label-key') {
      options.graphLabelKey = readRequiredValue('--graph-label-key', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--admin-console') {
      const parsedValue = readOptionalBooleanValue('--admin-console', nextValue);
      options.adminConsoleEnabled = parsedValue.value;
      if (parsedValue.consumedNextValue) {
        i += 1;
      }
      continue;
    }

    if (arg === '--no-admin-console') {
      options.adminConsoleEnabled = false;
      continue;
    }

    if (arg === '--apollo-sandbox') {
      const parsedValue = readOptionalBooleanValue('--apollo-sandbox', nextValue);
      options.enableApolloSandbox = parsedValue.value;
      if (parsedValue.consumedNextValue) {
        i += 1;
      }
      continue;
    }

    if (arg === '--no-apollo-sandbox') {
      options.enableApolloSandbox = false;
      continue;
    }

    if (arg === '--cloud-run-iam-auth') {
      const parsedValue = readOptionalBooleanValue('--cloud-run-iam-auth', nextValue);
      options.enableCloudRunIamAuth = parsedValue.value;
      if (parsedValue.consumedNextValue) {
        i += 1;
      }
      continue;
    }

    if (arg === '--no-cloud-run-iam-auth') {
      options.enableCloudRunIamAuth = false;
      continue;
    }

    if (arg === '--super-admin-id') {
      options.superAdminId = readRequiredValue('--super-admin-id', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--credentials' || arg === '--google-application-credentials') {
      options.googleApplicationCredentials = readRequiredValue('--credentials', nextValue);
      i += 1;
      continue;
    }

    if (arg === '--token-expires-in-days') {
      options.tokenExpiresInDays = readRequiredValue('--token-expires-in-days', nextValue);
      i += 1;
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


