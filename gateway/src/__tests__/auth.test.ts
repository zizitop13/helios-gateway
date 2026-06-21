import { FirebaseAuthManager } from '../auth';

const mockVerifyIdToken = jest.fn();
const mockCreateSessionCookie = jest.fn();
const mockVerifySessionCookie = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
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
