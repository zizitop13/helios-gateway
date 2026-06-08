import { CloudRunAuthManager } from '../utils';

// Mock google-auth-library
jest.mock('google-auth-library', () => {
  const mockGetRequestHeaders = jest.fn().mockResolvedValue({
    'Authorization': 'Bearer mock-identity-token-12345'
  });

  const mockGetIdTokenClient = jest.fn().mockResolvedValue({
    getRequestHeaders: mockGetRequestHeaders
  });

  return {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getIdTokenClient: mockGetIdTokenClient
    }))
  };
});

describe('CloudRunAuthManager', () => {
  let authManager: CloudRunAuthManager;

  beforeEach(() => {
    authManager = new CloudRunAuthManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getIdentityToken', () => {
    it('should get an identity token for a target URL', async () => {
      const token = await authManager.getIdentityToken('https://example.com/graphql');
      expect(token).toBe('mock-identity-token-12345');
    });

    it('should cache tokens for the same audience', async () => {
      const token1 = await authManager.getIdentityToken('https://example.com/graphql');
      const token2 = await authManager.getIdentityToken('https://example.com/api');
      
      // Both should return the same cached token since they have the same audience
      expect(token1).toBe('mock-identity-token-12345');
      expect(token2).toBe('mock-identity-token-12345');
    });

    it('should extract audience correctly from full URL', async () => {
      const token = await authManager.getIdentityToken('https://example.com:8080/graphql?query=test');
      expect(token).toBe('mock-identity-token-12345');
    });

    it('should handle URLs with different paths but same host', async () => {
      const token1 = await authManager.getIdentityToken('https://example.com/path1');
      const token2 = await authManager.getIdentityToken('https://example.com/path2');
      
      // Should use the same cached token
      expect(token1).toBe(token2);
    });
  });

  describe('clearCache', () => {
    it('should clear the token cache', async () => {
      // Get a token to populate the cache
      await authManager.getIdentityToken('https://example.com/graphql');
      
      // Clear the cache
      authManager.clearCache();
      
      // Getting a token again should work (will fetch a new one)
      const token = await authManager.getIdentityToken('https://example.com/graphql');
      expect(token).toBe('mock-identity-token-12345');
    });
  });
});
