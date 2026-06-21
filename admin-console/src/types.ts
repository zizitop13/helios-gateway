export interface UserInfo {
  uid: string;
  email?: string;
  roles: string[];
  tokenExpiration?: string;
}

export interface Subgraph {
  name: string;
  url: string;
  status: string;
  labels: Record<string, string>;
}

export interface SubgraphStreamItem extends Subgraph {
  health: SubgraphHealth;
}

export interface SubgraphsResponse {
  subgraphs: Subgraph[];
}

export interface SubgraphHealth {
  name: string;
  url: string;
  healthy: boolean;
  error?: string;
}

export interface SubgraphsHealthResponse {
  status: 'healthy' | 'unhealthy';
  subgraphs: SubgraphHealth[];
}

export interface GatewayStatus {
  uptime: number;
  discoveryMode: string;
  lastSchemaReloadTime?: string;
  servicesCount: number;
  graphName?: string;
  graphLabelKey?: string;
}

export interface AssignRolesRequest {
  uid?: string;
  email?: string;
  roles: string[];
}

export interface AssignRolesResponse {
  status: string;
  assigned: {
    uid: string;
    email?: string;
    roles: string[];
  };
  assignedBy?: string;
  note?: string;
}

export interface AvailableRolesResponse {
  roles: string[];
}

export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  authEmulatorUrl?: string;
}
