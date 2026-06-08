import { Router, CookieOptions } from 'express';
import { IAuthManager } from '../auth';
import { validateCsrfHeaderToken } from './cookies';

interface SessionRoutesOptions {
  authCookieName: string;
  csrfCookieName: string;
  csrfHeaderName: string;
  sessionCookieMaxAgeMs: number;
  authManager: IAuthManager;
  buildCookieOptions: (httpOnly: boolean) => CookieOptions;
}

export function createSessionRouter({
  authCookieName,
  csrfCookieName,
  csrfHeaderName,
  sessionCookieMaxAgeMs,
  authManager,
  buildCookieOptions,
}: SessionRoutesOptions): Router {
  const router = Router();

  router.post('/sessionLogin', async (req, res) => {
    if (!validateCsrfHeaderToken(req, csrfCookieName, csrfHeaderName)) {
      res.status(403).json({ error: 'Forbidden', message: 'Invalid CSRF token' });
      return;
    }

    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken) {
      res.status(400).json({ error: 'Bad Request', message: 'idToken is required' });
      return;
    }

    const verifiedUser = await authManager.verifyToken(idToken);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
      return;
    }

    try {
      const sessionCookie = await authManager.createSessionCookie(idToken, sessionCookieMaxAgeMs);
      res.cookie(authCookieName, sessionCookie, buildCookieOptions(true));
      res.json({ status: 'success', expiresIn: sessionCookieMaxAgeMs });
    } catch (error) {
      console.error('Failed to create Firebase session cookie:', error);
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });

  router.post('/sessionLogout', (req, res) => {
    if (!validateCsrfHeaderToken(req, csrfCookieName, csrfHeaderName)) {
      res.status(403).json({ error: 'Forbidden', message: 'Invalid CSRF token' });
      return;
    }

    res.clearCookie(authCookieName, buildCookieOptions(true));
    res.json({ status: 'success' });
  });

  return router;
}
