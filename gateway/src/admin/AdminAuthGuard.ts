import { Request, Response, NextFunction } from 'express';
import { IAuthManager } from '../auth';

/**
 * Admin Authentication Guard
 * Restricts access to admin routes to authenticated users with 'admin' role
 */
export class AdminAuthGuard {
  private static readonly AUTH_TOKEN_COOKIE = 'apollo_playground_token';

  constructor(private authManager: IAuthManager) {}

  /**
   * Express middleware to verify admin access
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const authHeader = req.headers.authorization;
        const sessionCookie = this.extractCookieValue(
          req.headers.cookie,
          AdminAuthGuard.AUTH_TOKEN_COOKIE
        );

        if (!authHeader && !sessionCookie) {
          res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
          return;
        }

        const token = this.authManager.extractTokenFromHeader(authHeader);
        let user = token ? await this.authManager.verifyToken(token) : null;
        if (!user && sessionCookie) {
          user = await this.authManager.verifySessionCookie(sessionCookie);
        }

        if (!user) {
          res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
          return;
        }

        const superAdminId = process.env.SUPER_ADMIN_ID;
        const isSuperAdmin = !!superAdminId && (user.uid === superAdminId || user.email === superAdminId);

        if (!isSuperAdmin && !user.roles.includes('admin')) {
          res.status(403).json({
            error: 'Forbidden', 
            message: 'Admin role required to access this resource' 
          });
          return;
        }

        (req as any).user = user;
        next();
      } catch (error) {
        console.error('Admin auth guard error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  private extractCookieValue(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookie = cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${name}=`));

    if (!cookie) {
      return null;
    }

    const rawValue = cookie.substring(name.length + 1);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
}
