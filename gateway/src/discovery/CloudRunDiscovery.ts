import {ServicesClient} from '@google-cloud/run';
import {SubgraphService} from '../types';
import {IDiscoveryProvider} from './IDiscoveryProvider';

/**
 * Cloud Run Service Discovery Provider
 * Auto-discovers subgraph services with label subgraph="true"
 */
export class CloudRunDiscovery implements IDiscoveryProvider {
    private client: ServicesClient;
    private projectId: string;
    private region: string;
    private graphName?: string;
    private graphLabelKey: string;

    constructor(
        projectId: string,
        region: string = 'us-central1',
        graphName?: string,
        graphLabelKey: string = 'graph'
    ) {
        this.projectId = projectId;
        this.region = region;
        this.graphName = graphName;
        this.graphLabelKey = graphLabelKey;
        this.client = new ServicesClient();
    }

    /**
     * Discover Cloud Run services with subgraph="true" label
     */
    async discoverServices(): Promise<SubgraphService[]> {
        try {
            const parent = `projects/${this.projectId}/locations/${this.region}`;
            const [services] = await this.client.listServices({
                parent,
            });

            console.log(`Discovered ${services.map(value => `${value.name} (${
                Object.entries(value.labels ?? {})
                    .map(([k, v]) => `${k}=${v}`)
            })`)} services from Cloud Run for parent ${parent}`);

            const subgraphServices: SubgraphService[] = [];

            for (const service of services) {
                if (!service.name) continue;

                const labels = (service as any).labels || {};

                const matchesGraphScope =
                    !this.graphName || labels[this.graphLabelKey] === this.graphName;

                if (labels.subgraph === 'true' && matchesGraphScope) {
                    const url = service.urls?.[0];

                    if (url) {
                        const serviceName = this.extractServiceName(service.name);
                        const subgraphName =
                            labels.subgraphName ||
                            labels.subgraph_name ||
                            labels['subgraph-name'] ||
                            serviceName;
                        subgraphServices.push({
                            name: subgraphName,
                            url: `${url}/graphql`,
                            labels
                        });
                    }
                }
            }

            console.log(`Discovered ${subgraphServices.length} subgraph services from Cloud Run`);
            return subgraphServices;
        } catch (error: any) {
            const message =
                (error && (error.message || error.details)) ||
                'Unknown error during Cloud Run service discovery';
            console.warn(
                'Warning: failed to discover Cloud Run services. Gateway will start without subgraphs. Details:',
                message
            );
            return [];
        }
    }

    /**
     * Extract service name from full Cloud Run service resource name
     */
    private extractServiceName(fullName: string): string {
        const parts = fullName.split('/');
        return parts[parts.length - 1];
    }
}
