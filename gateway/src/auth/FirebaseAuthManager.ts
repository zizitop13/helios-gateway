import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { UserContext, FirebaseDecodedToken } from '../types';
import { IAuthManager } from './IAuthManager';

/**
 * Firebase Authentication Manager
 * Handles JWT verification and user context extraction
 */
export class FirebaseAuthManager implements IAuthManager {
  private initialized = false;

  constructor(
    private projectId?: string,
    private serviceAccountKey?: string
  ) {}


  /**
   * Initialize Firebase Admin SDK
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      if (this.serviceAccountKey) {
        const serviceAccountJson = readFileSync(this.serviceAccountKey, 'utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: this.projectId
        });
      } else if (this.projectId) {
        admin.initializeApp({
          projectId: this.projectId
        });
      } else {
        admin.initializeApp();
      }

      this.initialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }

  /**
   * Verify Firebase JWT token and extract user context
   * @param token - Firebase ID token from Authorization header
   * @returns UserContext with user information and roles
   */
  async verifyToken(token: string): Promise<UserContext | null> {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token) as FirebaseDecodedToken;
      return this.buildUserContext(decodedToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  async createSessionCookie(idToken: string, expiresIn: number): Promise<string> {
    if (!this.initialized) {
      this.initialize();
    }

    return admin.auth().createSessionCookie(idToken, { expiresIn });
  }

  async verifySessionCookie(sessionCookie: string): Promise<UserContext | null> {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const decodedToken = await admin.auth().verifySessionCookie(
        sessionCookie,
        true
      ) as FirebaseDecodedToken;
      return this.buildUserContext(decodedToken);
    } catch (error) {
      console.error('Session cookie verification failed:', error);
      return null;
    }
  }

  /**
   * Resolve a Firebase user by uid or email
   */
  async getUserByIdentifier(uid?: string, email?: string): Promise<admin.auth.UserRecord | null> {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (uid) {
        return await admin.auth().getUser(uid);
      }

      if (email) {
        return await admin.auth().getUserByEmail(email);
      }

      return null;
    } catch (error) {
      console.error('Failed to resolve Firebase user:', error);
      return null;
    }
  }

  /**
   * Assign roles in Firebase custom claims for a user identified by uid or email.
   * Existing custom claims are preserved except role-related keys.
   */
  async assignRolesToUser(uid: string | undefined, email: string | undefined, roles: string[]): Promise<{
    uid: string;
    email?: string;
    roles: string[];
  } | null> {
    if (!this.initialized) {
      this.initialize();
    }

    const userRecord = await this.getUserByIdentifier(uid, email);
    if (!userRecord) {
      return null;
    }

    const existingClaims = userRecord.customClaims || {};
    const nextClaims: Record<string, unknown> = { ...existingClaims };
    delete nextClaims.role;
    delete nextClaims.roles;
    delete nextClaims.custom_claims;
    nextClaims.roles = roles;

    try {
      await admin.auth().setCustomUserClaims(userRecord.uid, nextClaims);
      return {
        uid: userRecord.uid,
        email: userRecord.email || undefined,
        roles,
      };
    } catch (error) {
      console.error('Failed to assign roles to Firebase user:', error);
      return null;
    }
  }

  /**
   * Extract roles from Firebase token/custom claims payload.
   */
  extractRolesFromClaims(decodedToken: FirebaseDecodedToken | Record<string, any>): string[] {
    const roles: string[] = [];

    if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
      roles.push(...decodedToken.roles);
    }

    if (decodedToken.role && typeof decodedToken.role === 'string') {
      roles.push(decodedToken.role);
    }

    if (decodedToken.custom_claims?.roles && Array.isArray(decodedToken.custom_claims.roles)) {
      roles.push(...decodedToken.custom_claims.roles);
    }

    // Some setups store claims as a JSON string in customAttributes/custom_attributes
    const customAttributes = decodedToken.customAttributes ?? decodedToken.custom_attributes;
    if (typeof customAttributes === 'string') {
      try {
        const parsed = JSON.parse(customAttributes) as { roles?: unknown };
        if (Array.isArray(parsed.roles)) {
          roles.push(...parsed.roles.filter((role): role is string => typeof role === 'string'));
        }
      } catch {
        // Ignore malformed customAttributes payloads
      }
    } else if (
      customAttributes &&
      typeof customAttributes === 'object' &&
      Array.isArray((customAttributes as { roles?: unknown }).roles)
    ) {
      const parsedRoles = (customAttributes as { roles: unknown[] }).roles
        .filter((role): role is string => typeof role === 'string');
      roles.push(...parsedRoles);
    }

    return [...new Set(roles)];
  }

  private buildUserContext(decodedToken: FirebaseDecodedToken): UserContext {
    const roles = this.extractRolesFromClaims(decodedToken);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      roles,
      claims: decodedToken
    };
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const trimmedHeader = authHeader.trim();
    if (!trimmedHeader) {
      return null;
    }

    const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmedHeader);
    const token = (bearerMatch ? bearerMatch[1] : trimmedHeader).trim();
    if (!token || token === 'null' || token === 'undefined') {
      return null;
    }

    return token.split('.').length === 3 ? token : null;
  }
}
