import { Router, CookieOptions } from 'express';
import { randomBytes } from 'crypto';

interface BaseRoutesOptions {
  csrfCookieName: string;
  buildCookieOptions: (httpOnly: boolean) => CookieOptions;
  buildAdminConsoleFirebaseConfig: () => Record<string, string>;
}

export function createBaseRouter({
  csrfCookieName,
  buildCookieOptions,
  buildAdminConsoleFirebaseConfig,
}: BaseRoutesOptions): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/admin/config/firebase', (_req, res) => {
    res.json(buildAdminConsoleFirebaseConfig());
  });

  router.get('/csrfToken', (_req, res) => {
    const csrfToken = randomBytes(32).toString('hex');
    res.cookie(csrfCookieName, csrfToken, buildCookieOptions(false));
    res.json({ csrfToken });
  });

  return router;
}
