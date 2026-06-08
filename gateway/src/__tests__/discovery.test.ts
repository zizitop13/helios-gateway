import { DockerDiscovery, FileDiscovery } from '../discovery';
import { ServiceDiscoveryManager } from '../discovery';
import { IDiscoveryProvider } from '../discovery';
import Docker from 'dockerode';
import { readFile } from 'fs/promises';

// Mock dockerode
jest.mock('dockerode');
// Mock Google Cloud Run client
jest.mock('@google-cloud/run');
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('Discovery Providers', () => {
  describe('DockerDiscovery', () => {
    let dockerDiscovery: DockerDiscovery;
    let mockDocker: Docker;

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Create instance
      dockerDiscovery = new DockerDiscovery('/var/run/docker.sock');
      
      // Get the mock instance
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const DockerConstructor = require('dockerode');
      mockDocker = DockerConstructor.mock.instances[0];
    });

    it('should create an instance with default socket path', () => {
      const discovery = new DockerDiscovery();
      expect(discovery).toBeInstanceOf(DockerDiscovery);
    });

    it('should create an instance with custom socket path', () => {
      const discovery = new DockerDiscovery('/custom/path/docker.sock');
      expect(discovery).toBeInstanceOf(DockerDiscovery);
    });

    it('should discover containers with subgraph labels', async () => {
      // Mock container list
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/my-subgraph'],
          Labels: {
            'subgraph': 'true',
            'subgraph.name': 'users-service',
            'com.docker.compose.service': 'users'
          },
          Ports: [{ PrivatePort: 4001, PublicPort: 4001, Type: 'tcp' }]
        },
        {
          Id: 'container2',
          Names: ['/another-service'],
          Labels: {
            'subgraph': 'true',
            'subgraph.name': 'products-service',
            'com.docker.compose.service': 'products'
          },
          Ports: [{ PrivatePort: 4002, PublicPort: 4002, Type: 'tcp' }]
        },
        {
          Id: 'container3',
          Names: ['/non-subgraph'],
          Labels: {},
          Ports: []
        }
      ];

      // Mock container inspect data
      const mockInspectData = {
        NetworkSettings: {
          Networks: {
            'bridge': {
              IPAddress: '172.17.0.2'
            }
          }
        }
      };

      mockDocker.listContainers = jest.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue(mockInspectData)
      });

      const services = await dockerDiscovery.discoverServices();

      expect(services).toHaveLength(2);
      expect(services[0].name).toBe('users-service');
      expect(services[0].url).toContain('/graphql');
      expect(services[1].name).toBe('products-service');
      expect(services[1].url).toContain('/graphql');
    });

    it('should skip containers without subgraph.name label', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/invalid-subgraph'],
          Labels: {
            'subgraph': 'true'
            // Missing subgraph.name
          },
          Ports: []
        }
      ];

      mockDocker.listContainers = jest.fn().mockResolvedValue(mockContainers);

      const services = await dockerDiscovery.discoverServices();

      expect(services).toHaveLength(0);
    });

    it('should handle containers with docker-compose service names', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/compose-service'],
          Labels: {
            'subgraph': 'true',
            'subgraph.name': 'my-service',
            'com.docker.compose.service': 'my-service-name'
          },
          Ports: [{ PrivatePort: 4000 }]
        }
      ];

      const mockInspectData = {
        NetworkSettings: {
          Networks: {
            'compose_network': {
              IPAddress: '172.18.0.2'
            }
          }
        }
      };

      mockDocker.listContainers = jest.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue(mockInspectData)
      });

      const services = await dockerDiscovery.discoverServices();

      expect(services).toHaveLength(1);
      expect(services[0].url).toBe('http://my-service-name:4000/graphql');
    });

    it('should handle errors during discovery', async () => {
      mockDocker.listContainers = jest.fn().mockRejectedValue(new Error('Docker connection failed'));

      await expect(dockerDiscovery.discoverServices()).rejects.toThrow('Docker connection failed');
    });
  });

  describe('ServiceDiscoveryManager', () => {
    let mockProvider: IDiscoveryProvider;
    let manager: ServiceDiscoveryManager;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockProvider = {
        discoverServices: jest.fn().mockResolvedValue([
          { name: 'service1', url: 'http://service1/graphql', labels: {} },
          { name: 'service2', url: 'http://service2/graphql', labels: {} }
        ])
      };

      manager = new ServiceDiscoveryManager(mockProvider);
    });

    it('should create an instance', () => {
      expect(manager).toBeInstanceOf(ServiceDiscoveryManager);
    });

    it('should discover services using provider', async () => {
      const services = await manager.discoverServices();

      expect(mockProvider.discoverServices).toHaveBeenCalled();
      expect(services).toHaveLength(2);
      expect(services[0].name).toBe('service1');
    });

    it('should handle discovery errors and return empty array', async () => {
      mockProvider.discoverServices = jest.fn().mockRejectedValue(new Error('Discovery failed'));

      const services = await manager.discoverServices();
      
      // Should return empty array on error when no previous services exist
      expect(services).toHaveLength(0);
    });

    it('should get last discovered services', async () => {
      await manager.discoverServices();
      const services = manager.getDiscoveredServices();
      
      expect(services).toHaveLength(2);
    });
  });

  describe('FileDiscovery', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should discover subgraphs from YAML file using subgraph and graph fields', async () => {
      const discovery = new FileDiscovery('/tmp/subgraphs.yaml');
      const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

      readFileMock.mockResolvedValue(`services:
  - subgraph:
      name: users
      port: 4001
  - subgraph:
      name: orders
      port: "4002"
    graph: pet-shop
`);

      const services = await discovery.discoverServices();

      expect(services).toHaveLength(2);
      expect(services[0]).toMatchObject({
        name: 'users',
        url: 'http://users:4001/graphql',
      });
      expect(services[1]).toMatchObject({
        name: 'orders',
        url: 'http://orders:4002/graphql',
      });
      expect(services[1].labels.graph).toBe('pet-shop');
    });

    it('should filter services by graph name when graph scope is configured', async () => {
      const discovery = new FileDiscovery('/tmp/subgraphs.yaml', 'pet-shop');
      const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

      readFileMock.mockResolvedValue(`services:
  - subgraph:
      name: users
      port: 4001
  - subgraph:
      name: orders
      port: 4002
    graph: pet-shop
`);

      const services = await discovery.discoverServices();

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('orders');
    });

    it('should parse graph-scoped mapping structures', async () => {
      const discovery = new FileDiscovery('/tmp/subgraphs.yaml', 'pet-shop');
      const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

      readFileMock.mockResolvedValue(`services:
  pet-shop:
    - subgraph:
        name: users
        port: 4001
  ecommerce:
    subgraph:
      name: products
      port: 4003
`);

      const services = await discovery.discoverServices();

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('users');
      expect(services[0].labels.graph).toBe('pet-shop');
    });

    it('should include subgraphs defined in optional top-level graph section', async () => {
      const discovery = new FileDiscovery('/tmp/subgraphs.yaml');
      const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

      readFileMock.mockResolvedValue(`services:
  - subgraph:
      name: users
      port: 4001
graph:
  - subgraph:
      name: reviews
      port: 4004
    graph: pet-shop
`);

      const services = await discovery.discoverServices();

      expect(services).toHaveLength(2);
      expect(services.map((service) => service.name)).toEqual(['users', 'reviews']);
      expect(services[1].labels.graph).toBe('pet-shop');
    });

    it('should build URLs with configured default host override', async () => {
      const discovery = new FileDiscovery('/tmp/subgraphs.yaml', undefined, 'graph', 'localhost');
      const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

      readFileMock.mockResolvedValue(`services:
  - subgraph:
      name: pets-service
      port: 5001
`);

      const services = await discovery.discoverServices();

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('pets-service');
      expect(services[0].url).toBe('http://localhost:5001/graphql');
    });
  });
});
