import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const COOKIE_NAME = 'celebraitions_session';

export function authSecret(): string {
  return process.env.JWT_SECRET ?? 'local-development-secret-change-me';
}

export function readSession(request: Request): string | undefined {
  const header = request.headers.cookie ?? '';
  const value = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return value?.slice(COOKIE_NAME.length + 1);
}

export function setSession(response: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, authSecret(), { expiresIn: '7d' });
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
}

export function clearSession(response: Response): void {
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
  const token = readSession(request);
  if (!token) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    return;
  }

  try {
    const payload = jwt.verify(token, authSecret());
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid session');
    request.userId = payload.sub;
    next();
  } catch {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
  }
}
