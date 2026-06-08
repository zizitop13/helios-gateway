import { SubgraphService } from '../types';
import { IDiscoveryProvider } from './IDiscoveryProvider';

/**
 * Service Discovery Manager
 * Discovers services once at startup
 */
export class ServiceDiscoveryManager {
  private provider: IDiscoveryProvider;
  private lastDiscoveredServices: SubgraphService[] = [];

  constructor(provider: IDiscoveryProvider) {
    this.provider = provider;
  }

  /**
   * Discover services using the configured provider
   */
  async discoverServices(): Promise<SubgraphService[]> {
    try {
      const services = await this.provider.discoverServices();
      this.lastDiscoveredServices = services;
      return services;
    } catch (error) {
      console.error('Error discovering services:', error);
      if (this.lastDiscoveredServices.length === 0) {
        console.warn(
          'Service discovery failed and there are no previously discovered services; continuing with an empty service list.'
        );
      } else {
        console.warn(
          'Service discovery failed; continuing to use last known set of services.'
        );
      }
      return this.lastDiscoveredServices;
    }
  }

  /**
   * Get currently discovered services
   */
  getDiscoveredServices(): SubgraphService[] {
    return this.lastDiscoveredServices;
  }
}
