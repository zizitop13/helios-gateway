import { UserContext } from '../types';

/**
 * Interface for authentication manager implementations.
 */
export interface IAuthManager {
  /**
   * Initialize underlying auth provider.
   */
  initialize(): void;

  /**
   * Verify a token and return user context.
   */
  verifyToken(token: string): Promise<UserContext | null>;

  /**
   * Create a provider-backed session cookie from a verified sign-in token.
   */
  createSessionCookie(idToken: string, expiresIn: number): Promise<string>;

  /**
   * Verify a provider-backed session cookie and return user context.
   */
  verifySessionCookie(sessionCookie: string): Promise<UserContext | null>;

  /**
   * Assign roles to a user identified by uid or email.
   */
  assignRolesToUser(
    uid: string | undefined,
    email: string | undefined,
    roles: string[]
  ): Promise<{
    uid: string;
    email?: string;
    roles: string[];
  } | null>;

  /**
   * Extract token from Authorization header.
   */
  extractTokenFromHeader(authHeader?: string): string | null;
}
