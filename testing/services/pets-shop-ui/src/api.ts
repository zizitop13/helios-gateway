import type { DashboardData, Order, UpdateOrderInput } from './types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000';
const GRAPHQL_ENDPOINT = `${GATEWAY_URL}/graphql`;
const CSRF_ENDPOINT = `${GATEWAY_URL}/csrfToken`;
const SESSION_LOGIN_ENDPOINT = `${GATEWAY_URL}/sessionLogin`;
const SESSION_LOGOUT_ENDPOINT = `${GATEWAY_URL}/sessionLogout`;
const CSRF_HEADER = 'x-csrf-token';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface DashboardPermissions {
  canViewPets: boolean;
  canViewOrders: boolean;
  canViewCustomers: boolean;
  canViewCustomerEmail: boolean;
}

let cachedCsrfToken: string | null = null;

async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedCsrfToken) {
    return cachedCsrfToken;
  }

  const response = await fetch(CSRF_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Unable to obtain CSRF token (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as { csrfToken?: unknown };
  if (typeof payload.csrfToken !== 'string' || !payload.csrfToken) {
    throw new Error('Gateway did not return a CSRF token');
  }

  cachedCsrfToken = payload.csrfToken;
  return payload.csrfToken;
}

export async function syncGatewaySession(idToken: string): Promise<void> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(SESSION_LOGIN_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(`Session login failed with HTTP ${response.status}`);
  }
}

export async function clearGatewaySession(): Promise<void> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(SESSION_LOGOUT_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Session logout failed with HTTP ${response.status}`);
  }
}

function buildDashboardQuery(permissions: DashboardPermissions): string {
  const selections: string[] = [];

  if (permissions.canViewPets) {
    selections.push(`
      pets {
        id
        name
        species
        status
      }
    `);
  }

  if (permissions.canViewOrders) {
    selections.push(`
      orders {
        id
        status
        total
        pet {
          id
          name
          species
          status
        }
        customer {
          id
          name
          tier
        }
      }
    `);
  }

  if (permissions.canViewCustomers) {
    selections.push(`
      customers {
        id
        name
        ${permissions.canViewCustomerEmail ? 'email' : ''}
        tier
      }
    `);
  }

  if (selections.length === 0) {
    selections.push('__typename');
  }

  return `
    query PetsShopDashboard {
      ${selections.join('\n')}
    }
  `;
}

async function executeGraphQL<TData, TVariables = Record<string, unknown>>(
  query: string,
  variables?: TVariables
): Promise<TData> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload: GraphQLResponse<TData> = await response.json();

  if (!response.ok) {
    const message = payload.errors?.[0]?.message ?? `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('No data returned from gateway');
  }

  return payload.data;
}

export async function fetchDashboardData(
  permissions: DashboardPermissions
): Promise<DashboardData> {
  const query = buildDashboardQuery(permissions);
  const data = await executeGraphQL<Partial<DashboardData>>(query);

  return {
    pets: data.pets ?? [],
    orders: data.orders ?? [],
    customers: data.customers ?? [],
  };
}

const UPDATE_ORDER_MUTATION = `
  mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) {
    updateOrder(id: $id, input: $input) {
      id
      status
      total
      pet {
        id
        name
        species
        status
      }
      customer {
        id
        name
        tier
      }
    }
  }
`;

interface UpdateOrderMutationData {
  updateOrder: Order;
}

interface UpdateOrderMutationVariables {
  id: string;
  input: UpdateOrderInput;
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput
): Promise<Order> {
  const data = await executeGraphQL<UpdateOrderMutationData, UpdateOrderMutationVariables>(
    UPDATE_ORDER_MUTATION,
    { id, input }
  );
  return data.updateOrder;
}
