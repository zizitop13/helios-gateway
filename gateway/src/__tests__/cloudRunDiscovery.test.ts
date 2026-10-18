import { CloudRunDiscovery } from '../discovery';

const mockListServices = jest.fn();
jest.mock('@google-cloud/run', () => ({ ServicesClient: jest.fn(() => ({ listServices: mockListServices })) }));

describe('Cloud Run discovery', () => {
  beforeEach(() => { mockListServices.mockReset(); });

  it('filters services by labels, graph, name and URL, preserving the configured subgraph name', async () => {
    mockListServices.mockResolvedValue([[
      { name: 'projects/p/locations/r/services/pets', urls: ['https://pets.example'], labels: { subgraph: 'true', scope: 'shop', subgraphName: 'pets-graph' } },
      { name: 'projects/p/locations/r/services/other', urls: ['https://other.example'], labels: { subgraph: 'true', scope: 'other' } },
      { name: 'not-subgraph', urls: ['https://ui.example'], labels: { subgraph: 'false', scope: 'shop' } },
      { name: 'missing-url', labels: { subgraph: 'true', scope: 'shop' } },
      { urls: ['https://no-name.example'], labels: { subgraph: 'true', scope: 'shop' } },
      { name: 'no-labels', urls: ['https://none.example'] },
    ]]);
    const result = await new CloudRunDiscovery('p', 'r', 'shop', 'scope').discoverServices();
    expect(mockListServices).toHaveBeenCalledWith({ parent: 'projects/p/locations/r' });
    expect(result).toEqual([{ name: 'pets-graph', url: 'https://pets.example/graphql', labels: { subgraph: 'true', scope: 'shop', subgraphName: 'pets-graph' } }]);
  });

  it.each([
    [{ subgraph_name: 'snake' }, 'snake'],
    [{ 'subgraph-name': 'hyphen' }, 'hyphen'],
    [{}, 'fallback'],
  ])('supports the naming convention %j', async (labels, expected) => {
    mockListServices.mockResolvedValue([[{ name: 'projects/p/locations/r/services/fallback', urls: ['https://service.example', 'https://ignored.example'], labels: { subgraph: 'true', ...labels } }]]);
    expect(await new CloudRunDiscovery('p').discoverServices()).toEqual([{ name: expected, url: 'https://service.example/graphql', labels: { subgraph: 'true', ...labels } }]);
    expect(mockListServices).toHaveBeenCalledWith({ parent: 'projects/p/locations/us-central1' });
  });

  it.each([new Error('API unavailable'), { details: 'permission denied' }, null])('handles discovery failure %j without crashing startup', async error => {
    mockListServices.mockRejectedValue(error);
    expect(await new CloudRunDiscovery('p').discoverServices()).toEqual([]);
  });
});
