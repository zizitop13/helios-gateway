import { ApolloCloudGateway } from '../gateway';
import { SubgraphService } from '../types';

const SSDL_A = `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  type Query {
    productA: String
  }
`;

const SSDL_B = `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

  extend type Query {
    productB: String
  }
`;

const SUBGRAPH_A: SubgraphService = {
  name: 'subgraph-a',
  url: 'http://subgraph-a/graphql',
  labels: {},
};

const SUBGRAPH_B: SubgraphService = {
  name: 'subgraph-b',
  url: 'http://subgraph-b/graphql',
  labels: {},
};

function createGateway(overrides: Partial<ConstructorParameters<typeof ApolloCloudGateway>[0]> = {}) {
  return new ApolloCloudGateway({
    discoveryMode: 'docker',
    adminConsoleEnabled: false,
    enableApolloSandbox: false,
    enableSchemaRefresh: true,
    schemaRefreshIntervalSeconds: 1,
    enableCloudRunIamAuth: false,
    ...overrides,
  });
}

describe('Schema refresh', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not start periodic refresh when refresh is disabled', () => {
    const gateway = createGateway({ enableSchemaRefresh: false });
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    (gateway as any).startSchemaRefreshLoop();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('excludes one subgraph on startup when introspection fails for that subgraph', async () => {
    const gateway = createGateway();

    global.fetch = jest.fn(async (url) => {
      if (url === SUBGRAPH_B.url) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { _service: { sdl: SSDL_A } } }),
      } as any;
    }) as any;

    const result = await (gateway as any).composeDiscoveredServices([SUBGRAPH_A, SUBGRAPH_B]);

    expect(result.supergraphSdl).toBeDefined();
    expect(result.includedSubgraphs.map((service: SubgraphService) => service.name)).toEqual(['subgraph-a']);
    expect(result.excludedSubgraphs).toHaveLength(1);
    expect(result.excludedSubgraphs[0].service.name).toBe('subgraph-b');
  });

  it('excludes a subgraph when introspection hangs', async () => {
    jest.useFakeTimers();
    const gateway = createGateway();

    global.fetch = jest.fn((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    }) as any;

    const resultPromise = (gateway as any).composeDiscoveredServices([SUBGRAPH_B]);
    await Promise.resolve();
    jest.advanceTimersByTime(5000);

    const result = await resultPromise;

    expect(result.supergraphSdl).toBeUndefined();
    expect(result.includedSubgraphs).toEqual([]);
    expect(result.excludedSubgraphs).toHaveLength(1);
    expect(result.excludedSubgraphs[0].service.name).toBe('subgraph-b');
    expect(result.excludedSubgraphs[0].reason).toContain('timed out');
  });

  it('refreshes schema while excluding a failing subgraph', async () => {
    const gateway = createGateway();
    const updateMock = jest.fn();
    const loadRbacMock = jest.spyOn(gateway as any, 'loadRbacPoliciesFromSubgraphs').mockResolvedValue(undefined);

    (gateway as any).supergraphUpdate = updateMock;
    (gateway as any).discoveryManager = {
      discoverServices: jest.fn().mockResolvedValue([SUBGRAPH_A, SUBGRAPH_B]),
    };

    global.fetch = jest.fn(async (url) => {
      if (url === SUBGRAPH_B.url) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { _service: { sdl: SSDL_A } } }),
      } as any;
    }) as any;

    await (gateway as any).refreshSchema();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(loadRbacMock).toHaveBeenCalledWith([SUBGRAPH_A]);
    expect((gateway as any).activeSubgraphs).toEqual([SUBGRAPH_A]);
  });

  it('keeps the previous schema when refresh fails completely', async () => {
    const gateway = createGateway();
    const updateMock = jest.fn();
    const loadRbacMock = jest.spyOn(gateway as any, 'loadRbacPoliciesFromSubgraphs').mockResolvedValue(undefined);

    (gateway as any).supergraphUpdate = updateMock;
    (gateway as any).activeSubgraphs = [SUBGRAPH_A];
    (gateway as any).discoveryManager = {
      discoverServices: jest.fn().mockResolvedValue([SUBGRAPH_B]),
    };

    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as any;
    }) as any;

    await (gateway as any).refreshSchema();

    expect(updateMock).not.toHaveBeenCalled();
    expect(loadRbacMock).not.toHaveBeenCalled();
    expect((gateway as any).activeSubgraphs).toEqual([SUBGRAPH_A]);
  });

  it('adds a recovered subgraph back on the next successful refresh', async () => {
    const gateway = createGateway();
    const updateMock = jest.fn();
    const loadRbacMock = jest.spyOn(gateway as any, 'loadRbacPoliciesFromSubgraphs').mockResolvedValue(undefined);

    (gateway as any).supergraphUpdate = updateMock;
    (gateway as any).activeSubgraphs = [SUBGRAPH_A];
    (gateway as any).discoveryManager = {
      discoverServices: jest.fn().mockResolvedValue([SUBGRAPH_A, SUBGRAPH_B]),
    };

    let subgraphBHealthy = false;

    global.fetch = jest.fn(async (url) => {
      if (url === SUBGRAPH_B.url && !subgraphBHealthy) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
        } as any;
      }

      const sdl = url === SUBGRAPH_B.url ? SSDL_B : SSDL_A;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { _service: { sdl } } }),
      } as any;
    }) as any;

    await (gateway as any).refreshSchema();
    expect((gateway as any).activeSubgraphs.map((service: SubgraphService) => service.name)).toEqual([
      'subgraph-a',
    ]);

    subgraphBHealthy = true;
    await (gateway as any).refreshSchema();

    expect((gateway as any).activeSubgraphs.map((service: SubgraphService) => service.name)).toEqual([
      'subgraph-a',
      'subgraph-b',
    ]);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(loadRbacMock).toHaveBeenLastCalledWith([SUBGRAPH_A, SUBGRAPH_B]);
  });
});

