import type {
  AssignRolesRequest,
  AssignRolesResponse,
  AvailableRolesResponse,
  FirebaseWebConfig,
  GatewayStatus,
  SubgraphHealth,
  SubgraphStreamItem,
  SubgraphsHealthResponse,
  SubgraphsResponse,
  UserInfo,
} from './types';

const API_BASE = '/admin/api';

export interface ApiError {
  error: string;
  message?: string;
}

interface CsrfTokenResponse {
  csrfToken: string;
}

interface SessionLoginResponse {
  status: 'success';
  expiresIn: number;
}

interface StreamSubgraphsOptions {
  signal?: AbortSignal;
  onSubgraph: (subgraph: SubgraphStreamItem) => void;
  onStart?: (payload: { total: number }) => void;
}

async function fetchWithAuth<T>(
  url: string,
  token: string,
  options?: { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const timeoutRef =
    typeof timeoutMs === 'number'
      ? setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : undefined;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && typeof timeoutMs === 'number') {
      throw new Error(`Health check timeout after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
  }
}

async function postWithAuth<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

async function streamWithAuth(
  url: string,
  token: string,
  options: StreamSubgraphsOptions
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Streaming response is not available');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchEvent = (rawEvent: string) => {
    const lines = rawEvent.split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    const payload = JSON.parse(dataLines.join('\n'));

    if (eventName === 'start') {
      options.onStart?.(payload);
    } else if (eventName === 'subgraph') {
      options.onSubgraph(payload);
    } else if (eventName === 'error') {
      throw new Error(payload.message || 'Streaming request failed');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';

    for (const event of events) {
      if (event.trim()) {
        dispatchEvent(event);
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    dispatchEvent(buffer);
  }
}

export const api = {
  getFirebaseConfig: async (): Promise<FirebaseWebConfig> => {
    const response = await fetch('/admin/config/firebase', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },
  getMe: (token: string) => fetchWithAuth<UserInfo>(`${API_BASE}/me`, token),
  getSubgraphs: (token: string) => fetchWithAuth<SubgraphsResponse>(`${API_BASE}/subgraphs`, token),
  streamSubgraphs: (token: string, options: StreamSubgraphsOptions) =>
    streamWithAuth(`${API_BASE}/subgraphs/stream`, token, options),
  getStatus: (token: string) => fetchWithAuth<GatewayStatus>(`${API_BASE}/status`, token),
  getSubgraphsHealth: (token: string) => fetchWithAuth<SubgraphsHealthResponse>(`${API_BASE}/subgraphs/health`, token),
  getSubgraphHealth: (token: string, name: string, timeoutMs?: number) =>
    fetchWithAuth<SubgraphHealth>(`${API_BASE}/subgraphs/${encodeURIComponent(name)}/health`, token, {
      timeoutMs,
    }),
  assignUserRoles: (token: string, body: AssignRolesRequest) =>
    postWithAuth<AssignRolesResponse>(`${API_BASE}/users/roles`, token, body),
  getAvailableRoles: (token: string) =>
    fetchWithAuth<AvailableRolesResponse>(`${API_BASE}/roles`, token),
  getCsrfToken: async (): Promise<CsrfTokenResponse> => {
    const response = await fetch('/csrfToken', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  },
  createSession: async (idToken: string): Promise<SessionLoginResponse> => {
    const { csrfToken } = await api.getCsrfToken();
    const response = await fetch('/sessionLogin', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  },
};
