import { FirebaseAuthManager } from '../auth';

const mockVerifyIdToken = jest.fn();
const mockCreateSessionCookie = jest.fn();
const mockVerifySessionCookie = jest.fn();
const mockGetUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockSetCustomUserClaims = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
    getUser: mockGetUser,
    getUserByEmail: mockGetUserByEmail,
    setCustomUserClaims: mockSetCustomUserClaims,
  })),
  credential: {
    cert: jest.fn(),
  },
}));

describe('FirebaseAuthManager', () => {
  let authManager: FirebaseAuthManager;
  const jwtToken = 'header.payload.signature';

  beforeEach(() => {
    authManager = new FirebaseAuthManager();
    (authManager as any).initialized = true;
    mockVerifyIdToken.mockReset();
    mockCreateSessionCookie.mockReset();
    mockVerifySessionCookie.mockReset();
    mockGetUser.mockReset();
    mockGetUserByEmail.mockReset();
    mockSetCustomUserClaims.mockReset();
  });

  it.each([
    [{ roles: ['admin', 'staff'], role: 'admin', custom_claims: { roles: ['support'] } }, ['admin', 'staff', 'support']],
    [{ customAttributes: '{"roles":["viewer",12,"viewer"]}' }, ['viewer']],
    [{ custom_attributes: { roles: ['staff', null] } }, ['staff']],
    [{ customAttributes: 'malformed-json' }, []],
    [{ roles: 'admin', role: 12, custom_claims: { roles: 'staff' } }, []],
    [{ customAttributes: '{"roles":"admin"}' }, []],
    [{}, []],
  ])('extracts and deduplicates roles from claims %j', (claims, expected) => {
    expect(authManager.extractRolesFromClaims(claims)).toEqual(expected);
  });

  it('rejects invalid ID tokens and revoked session cookies', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    mockVerifySessionCookie.mockRejectedValue(new Error('Revoked cookie'));
    expect(await authManager.verifyToken('invalid')).toBeNull();
    expect(await authManager.verifySessionCookie('revoked')).toBeNull();
  });

  it('resolves users by UID or email and handles missing users', async () => {
    mockGetUser.mockResolvedValue({ uid: 'id' });
    mockGetUserByEmail.mockResolvedValue({ uid: 'email-user' });
    expect(await authManager.getUserByIdentifier('id', 'ignored@example.test')).toEqual({ uid: 'id' });
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(await authManager.getUserByIdentifier(undefined, 'user@example.test')).toEqual({ uid: 'email-user' });
    expect(mockGetUserByEmail).toHaveBeenCalledWith('user@example.test');
    expect(await authManager.getUserByIdentifier()).toBeNull();
    mockGetUser.mockRejectedValue(new Error('User not found'));
    expect(await authManager.getUserByIdentifier('missing')).toBeNull();
  });

  it('replaces role claims while preserving unrelated claims', async () => {
    mockGetUser.mockResolvedValue({ uid: 'id', email: 'user@example.test', customClaims: { role: 'legacy', roles: ['old'], custom_claims: { roles: ['old'] }, tenant: 'shop' } });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    expect(await authManager.assignRolesToUser('id', undefined, ['viewer'])).toEqual({ uid: 'id', email: 'user@example.test', roles: ['viewer'] });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('id', { tenant: 'shop', roles: ['viewer'] });
  });

  it('does not assign roles to missing users and handles claim-update failure', async () => {
    mockGetUser.mockResolvedValueOnce(null).mockResolvedValue({ uid: 'id' });
    expect(await authManager.assignRolesToUser('missing', undefined, [])).toBeNull();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    mockSetCustomUserClaims.mockRejectedValue(new Error('Update failed'));
    expect(await authManager.assignRolesToUser('id', undefined, [])).toBeNull();
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer format', () => {
      const header = `Bearer ${jwtToken}`;
      const token = authManager.extractTokenFromHeader(header);
      expect(token).toBe(jwtToken);
    });

    it('should return raw token if not in Bearer format', () => {
      const header = jwtToken;
      const token = authManager.extractTokenFromHeader(header);
      expect(token).toBe(jwtToken);
    });

    it('should return null for undefined header', () => {
      const token = authManager.extractTokenFromHeader(undefined);
      expect(token).toBe(null);
    });

    it('should return null for empty header', () => {
      const token = authManager.extractTokenFromHeader('');
      expect(token).toBe(null);
    });

    it('should handle Bearer with multiple spaces', () => {
      const header = `Bearer  ${jwtToken}`;
      const token = authManager.extractTokenFromHeader(header);
      expect(token).toBe(jwtToken);
    });

    it('should ignore malformed bearer placeholders', () => {
      expect(authManager.extractTokenFromHeader('Bearer null')).toBe(null);
      expect(authManager.extractTokenFromHeader('Bearer undefined')).toBe(null);
      expect(authManager.extractTokenFromHeader('Bearer not-a-jwt')).toBe(null);
    });
  });

  describe('session cookies', () => {
    it('creates a Firebase session cookie from an ID token', async () => {
      mockCreateSessionCookie.mockResolvedValue('firebase-session-cookie');

      const sessionCookie = await authManager.createSessionCookie('incoming-id-token', 3000);

      expect(mockCreateSessionCookie).toHaveBeenCalledWith('incoming-id-token', {
        expiresIn: 3000,
      });
      expect(sessionCookie).toBe('firebase-session-cookie');
    });

    it('verifies Firebase session cookies with revocation checking', async () => {
      mockVerifySessionCookie.mockResolvedValue({
        uid: 'user-1',
        email: 'admin@example.com',
        roles: ['admin'],
      });

      const user = await authManager.verifySessionCookie('firebase-session-cookie');

      expect(mockVerifySessionCookie).toHaveBeenCalledWith('firebase-session-cookie', true);
      expect(user).toEqual({
        uid: 'user-1',
        email: 'admin@example.com',
        roles: ['admin'],
        claims: {
          uid: 'user-1',
          email: 'admin@example.com',
          roles: ['admin'],
        },
      });
    });

    it('uses ID token verification for bearer tokens', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-2',
        email: 'viewer@example.com',
        roles: ['viewer'],
      });

      const user = await authManager.verifyToken('raw-id-token');

      expect(mockVerifyIdToken).toHaveBeenCalledWith('raw-id-token');
      expect(user?.uid).toBe('user-2');
      expect(user?.roles).toEqual(['viewer']);
    });
  });
});
