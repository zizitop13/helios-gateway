import { SubgraphService } from '../types';

/**
 * Interface for service discovery providers
 * Implementations discover subgraph services from different environments
 */
export interface IDiscoveryProvider {
  /**
   * Discover available subgraph services
   * @returns Promise resolving to array of discovered services
   */
  discoverServices(): Promise<SubgraphService[]>;
}
