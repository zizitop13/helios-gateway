import { Request } from 'express';

export function extractCookieValue(cookieHeader: string | undefined, name: string): string | null {
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

  return cookie.substring(name.length + 1);
}

export function extractCsrfHeader(req: Request, headerName: string): string | null {
  const csrfHeader = req.headers[headerName];
  if (Array.isArray(csrfHeader)) {
    return csrfHeader[0] || null;
  }
  return typeof csrfHeader === 'string' ? csrfHeader : null;
}

export function validateCsrfHeaderToken(
  req: Request,
  csrfCookieName: string,
  csrfHeaderName: string
): boolean {
  const csrfCookie = extractCookieValue(req.headers.cookie, csrfCookieName);
  const csrfToken = extractCsrfHeader(req, csrfHeaderName);
  return Boolean(csrfCookie && csrfToken && csrfCookie === csrfToken);
}
