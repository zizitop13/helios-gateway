import { GoogleAuth } from 'google-auth-library';

/**
 * Utility for managing Cloud Run IAM authentication
 */
export class CloudRunAuthManager {
  private googleAuth: GoogleAuth;
  private tokenCache: Map<string, { token: string; expiry: number }> = new Map();

  constructor() {
    this.googleAuth = new GoogleAuth();
  }

  /**
   * Get an identity token for the target audience
   */
  async getIdentityToken(targetUrl: string): Promise<string> {
    const audience = this.extractAudience(targetUrl);
    
    const cached = this.tokenCache.get(audience);
    if (cached && cached.expiry > Date.now() + 60000) {
      return cached.token;
    }

    const client = await this.googleAuth.getIdTokenClient(audience);
    const headers = await client.getRequestHeaders();
    
    let authHeader: string | undefined;
    if (typeof headers.get === 'function') {
      authHeader = headers.get('Authorization') || headers.get('authorization') || undefined;
    } else if (typeof headers === 'object' && headers !== null) {
      const rawHeaders = headers as unknown as Record<string, string>;
      authHeader = rawHeaders['Authorization'] || rawHeaders['authorization'];
    }
    
    const token = authHeader?.replace(/^Bearer\s+/i, '') || '';
    if (!token) {
      throw new Error(`Unable to obtain Cloud Run identity token for audience ${audience}`);
    }

    this.tokenCache.set(audience, {
      token,
      expiry: Date.now() + (50 * 60 * 1000)
    });

    return token;
  }

  /**
   * Extract the audience from a full URL
   */
  private extractAudience(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      return url;
    }
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }
}
