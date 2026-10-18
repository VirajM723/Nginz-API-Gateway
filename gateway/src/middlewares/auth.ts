import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '@nginz/config';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string; role: string; iat: number; exp: number };
}

export const generateDevJwtToken = (userId: string = 'sim-user-1', email: string = 'simulator@nginz.io'): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const verifyJwt = (token: string): AuthenticatedRequest['user'] => {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Malformed token');
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error('Invalid token');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthenticatedRequest['user'];
  if (!decoded?.exp || decoded.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  return decoded;
};

export const jwtAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Middleware may be mounted at the app root, so normalise '/api/auth/login' -> '/auth/login'
  const path = req.path.replace(/^\/api(?=\/)/, '');
  const publicPath =
    path === '/health' ||
    path === '/metrics' ||
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/auth/validate' ||
    path === '/products' ||
    path.startsWith('/products/');

  if (publicPath) return next();

  // No header-based bypass: the traffic simulator authenticates with a signed JWT like any client

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: true, message: 'Authentication required', requestId: req.headers['x-request-id'] });
    return;
  }
  try {
    req.user = verifyJwt(auth.slice('Bearer '.length).trim());
    next();
  } catch {
    res.status(401).json({ error: true, message: 'Invalid or expired token', requestId: req.headers['x-request-id'] });
  }
};
