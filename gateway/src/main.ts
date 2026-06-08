import { ApolloCloudGateway } from './gateway';

export async function startGateway(): Promise<void> {
  try {
    const gateway = new ApolloCloudGateway();
    await gateway.start();
  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startGateway().then(() => console.log('Gateway has started'));
}
