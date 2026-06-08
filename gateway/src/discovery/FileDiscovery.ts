import { readFile } from 'fs/promises';
import { parse } from 'yaml';
import { SubgraphService } from '../types';
import { IDiscoveryProvider } from './IDiscoveryProvider';

type RawDiscoveryFile = {
  services?: unknown;
  graph?: unknown;
};

type ParsedEntry = {
  name: string;
  port: number;
  graph?: string;
};

export class FileDiscovery implements IDiscoveryProvider {
  private filePath: string;
  private graphName?: string;
  private graphLabelKey: string;
  private defaultHost?: string;

  constructor(
    filePath: string,
    graphName?: string,
    graphLabelKey: string = 'graph',
    defaultHost?: string
  ) {
    this.filePath = filePath;
    this.graphName = graphName;
    this.graphLabelKey = graphLabelKey;
    this.defaultHost = defaultHost?.trim() || undefined;
  }

  async discoverServices(): Promise<SubgraphService[]> {
    const fileContent = await readFile(this.filePath, 'utf8');
    const parsed = parse(fileContent) as RawDiscoveryFile;
    const entries = [...this.extractEntries(parsed?.services), ...this.extractEntries(parsed?.graph)];

    const filteredEntries = this.graphName
      ? entries.filter((entry) => entry.graph === this.graphName)
      : entries;

    const services = filteredEntries.map((entry) => {
      const labels: Record<string, string> = {
        subgraph: 'true',
        subgraph_name: entry.name,
        subgraph_port: String(entry.port),
      };

      if (entry.graph) {
        labels[this.graphLabelKey] = entry.graph;
      }

      return {
        name: entry.name,
        url: `http://${this.defaultHost || entry.name}:${entry.port}/graphql`,
        labels,
      };
    });

    console.log(`Discovered ${services.length} subgraph services from file ${this.filePath}`);
    return services;
  }

  private extractEntries(rawServices: unknown): ParsedEntry[] {
    if (!rawServices) {
      return [];
    }

    if (Array.isArray(rawServices)) {
      return rawServices.flatMap((entry) => this.parseEntry(entry));
    }

    if (typeof rawServices !== 'object') {
      return [];
    }

    const servicesRecord = rawServices as Record<string, unknown>;

    if ('subgraph' in servicesRecord || 'name' in servicesRecord || 'port' in servicesRecord) {
      return this.parseEntry(servicesRecord);
    }

    const parsedEntries: ParsedEntry[] = [];
    for (const [graph, value] of Object.entries(servicesRecord)) {
      if (Array.isArray(value)) {
        parsedEntries.push(...value.flatMap((entry) => this.parseEntry(entry, graph)));
        continue;
      }

      parsedEntries.push(...this.parseEntry(value, graph));
    }

    return parsedEntries;
  }

  private parseEntry(rawEntry: unknown, implicitGraph?: string): ParsedEntry[] {
    if (!rawEntry || typeof rawEntry !== 'object') {
      return [];
    }

    const entryRecord = rawEntry as Record<string, unknown>;

    const subgraphNode =
      'subgraph' in entryRecord && entryRecord.subgraph && typeof entryRecord.subgraph === 'object'
        ? (entryRecord.subgraph as Record<string, unknown>)
        : entryRecord;

    const name = this.normalizeString(subgraphNode.name);
    const port = this.normalizePort(subgraphNode.port);
    const explicitGraph = this.normalizeString(entryRecord.graph);
    const graph = explicitGraph || implicitGraph;

    if (!name || !port) {
      return [];
    }

    return [{ name, port, graph }];
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizePort(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535) {
      return value;
    }

    if (typeof value === 'string') {
      const parsedPort = Number.parseInt(value.trim(), 10);
      if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        return parsedPort;
      }
    }

    return undefined;
  }
}

