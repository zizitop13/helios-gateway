import { api } from './api';
import type {
  AssignRolesRequest, AssignRolesResponse, AvailableRolesResponse,
  DirectoryUser, ListUsersQuery, ListUsersResponse, UserRolesResponse,
} from './types';

// Keep the page independent of the transport. Gateway mode reuses the existing
// role assignment API; the two missing reads are specified in openapi.yaml.
export interface UsersApi {
  getUsers: (token: string, query?: ListUsersQuery) => Promise<ListUsersResponse>;
  getUserRoles: (token: string, uid: string) => Promise<UserRolesResponse>;
  getAvailableRoles: (token: string) => Promise<AvailableRolesResponse>;
  assignUserRoles: (token: string, body: AssignRolesRequest) => Promise<AssignRolesResponse>;
}

export const usersPreview = import.meta.env.VITE_USERS_API_MODE !== 'gateway';

const sampleUsers: DirectoryUser[] = [
  { uid: 'preview-alice', email: 'alice@example.test', displayName: 'Alice Morgan', provider: 'firebase', disabled: false },
  { uid: 'preview-bob', email: 'bob@example.test', displayName: 'Bob Chen', provider: 'firebase', disabled: false },
  { uid: 'preview-carol', email: 'carol@example.test', displayName: 'Carol Rivera', provider: 'firebase', disabled: true },
  { uid: 'preview-dana', email: 'dana@example.test', displayName: 'Dana Singh', provider: 'firebase', disabled: false },
  { uid: 'preview-eli', email: 'eli@example.test', displayName: 'Eli Martin', provider: 'firebase', disabled: false },
  { uid: 'preview-frank', email: 'frank@example.test', displayName: 'Frank Wilson', provider: 'firebase', disabled: false },
  { uid: 'preview-no-email', displayName: 'Phone user', provider: 'firebase', disabled: false },
];

const sampleRoles = new Map<string, string[]>([
  ['preview-alice', ['viewer']], ['preview-bob', ['staff', 'support']],
  ['preview-carol', ['viewer']], ['preview-dana', ['admin', 'finance']],
]);

function findSampleUser(uid?: string, email?: string): DirectoryUser {
  const user = sampleUsers.find(user => uid ? user.uid === uid : user.email === email);
  if (!user) throw new Error('User not found');
  return user;
}

// Entirely in memory: preview assignments never call Firebase or the gateway.
// A reload resets the samples. No fallback hides errors in gateway mode.
const mockUsersApi: UsersApi = {
  async getUsers(_token, query = {}) {
    const search = query.search?.trim().toLowerCase() || '';
    const users = sampleUsers.filter(user =>
      [user.email, user.displayName, user.uid].some(value => value?.toLowerCase().includes(search))
    );
    const start = Number(query.pageToken || 0);
    const end = start + (query.pageSize ?? 50);
    return { users: users.slice(start, end), nextPageToken: end < users.length ? String(end) : undefined };
  },
  async getUserRoles(_token, uid) {
    const user = findSampleUser(uid);
    return { uid, email: user.email, roles: [...(sampleRoles.get(uid) || [])] };
  },
  async getAvailableRoles() {
    return { roles: ['admin', 'finance', 'staff', 'support', 'viewer'] };
  },
  async assignUserRoles(_token, body) {
    const user = findSampleUser(body.uid, body.email);
    const roles = [...new Set(body.roles.map(role => role.trim()).filter(Boolean))];
    sampleRoles.set(user.uid, roles);
    return {
      status: 'ok', assigned: { uid: user.uid, email: user.email, roles: [...roles] },
      note: 'Preview changes apply only to these sample users and reset when the page is reloaded.',
    };
  },
};

export const usersApi: UsersApi = usersPreview ? mockUsersApi : api;
