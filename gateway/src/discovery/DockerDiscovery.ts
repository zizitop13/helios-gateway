import Docker from 'dockerode';
import { SubgraphService } from '../types';
import { IDiscoveryProvider } from './IDiscoveryProvider';

const DEFAULT_GRAPHQL_PORT = '4000';

/**
 * Docker Service Discovery Provider
 * Auto-discovers subgraph services from Docker containers with label subgraph="true"
 */
export class DockerDiscovery implements IDiscoveryProvider {
  private docker: Docker;
  private graphName?: string;
  private graphLabelKey: string;

  constructor(
    socketPath: string = '/var/run/docker.sock',
    graphName?: string,
    graphLabelKey: string = 'graph'
  ) {
    this.docker = new Docker({ socketPath });
    this.graphName = graphName;
    this.graphLabelKey = graphLabelKey;
  }

  /**
   * Discover Docker containers with subgraph="true" label
   */
  async discoverServices(): Promise<SubgraphService[]> {
    try {
      const containers = await this.docker.listContainers({
        filters: {
          status: ['running'],
        },
      });

      const subgraphServices: SubgraphService[] = [];

      for (const containerInfo of containers) {
        const labels = containerInfo.Labels || {};
        
        const matchesGraphScope = !this.graphName || labels[this.graphLabelKey] === this.graphName;

        if (labels.subgraph === 'true' && matchesGraphScope) {
          const subgraphName = labels['subgraph.name'] || labels['subgraph_name'];
          
          if (!subgraphName) {
            console.warn(`Container ${containerInfo.Names[0]} has subgraph=true but no subgraph.name label`);
            continue;
          }

          const container = this.docker.getContainer(containerInfo.Id);
          const inspectData = await container.inspect();
          
          const url = this.constructServiceUrl(inspectData, containerInfo);
          
          if (url) {
            subgraphServices.push({
              name: subgraphName,
              url: `${url}/graphql`,
              labels: this.convertLabelsToRecord(labels),
            });
          } else {
            console.warn(`Container ${containerInfo.Names[0]} (${subgraphName}) has no accessible port`);
          }
        }
      }

      console.log(`Discovered ${subgraphServices.length} subgraph services from Docker`);
      return subgraphServices;
    } catch (error) {
      console.error('Error discovering Docker services:', error);
      throw error;
    }
  }

  /**
   * Construct service URL from container inspection data
   */
  private constructServiceUrl(inspectData: Docker.ContainerInspectInfo, containerInfo: Docker.ContainerInfo): string | null {
    const networks = inspectData.NetworkSettings?.Networks;
    
    if (!networks) {
      return null;
    }

    const networkNames = Object.keys(networks);
    if (networkNames.length === 0) {
      return null;
    }

    const network = networks[networkNames[0]];
    const ipAddress = network.IPAddress;

    const portLabel = containerInfo.Labels?.['subgraph.port'] || containerInfo.Labels?.['subgraph_port'];
    let port = portLabel;

    if (!port && containerInfo.Ports && containerInfo.Ports.length > 0) {
      port = containerInfo.Ports[0].PrivatePort?.toString();
    }

    if (!port) {
      port = DEFAULT_GRAPHQL_PORT;
    }

    const serviceName = containerInfo.Labels?.['com.docker.compose.service'];
    if (serviceName) {
      return `http://${serviceName}:${port}`;
    }

    if (ipAddress) {
      return `http://${ipAddress}:${port}`;
    }

    return null;
  }

  /**
   * Convert Docker labels object to a record
   */
  private convertLabelsToRecord(labels: { [key: string]: string }): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      record[key] = value;
    }
    return record;
  }
}
