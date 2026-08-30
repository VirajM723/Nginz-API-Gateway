import crypto from 'node:crypto';
import { config } from '@nginz/config';
import { UserRepository } from '../repositories/userRepository';

type JwtPayload = { sub: string; email: string; role: string; iat: number; exp: number };

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

const signToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + 24 * 60 * 60 };
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(data).digest();
  return `${data}.${base64url(signature)}`;
};

const verifyToken = (token: string): JwtPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT token');
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error('Invalid JWT signature');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtPayload;
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired');
  return decoded;
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  return `scrypt$${salt}$${derived.toString('hex')}`;
};

const comparePassword = async (password: string, encoded: string): Promise<boolean> => {
  const [scheme, salt, expectedHex] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
};

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = signToken({ sub: user.id, email: user.email, role: 'user' });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async validateToken(token: string): Promise<any> {
    try {
      return verifyToken(token);
    } catch (error: any) {
      const err: any = new Error('Invalid or expired JWT token');
      err.statusCode = 401;
      throw err;
    }
  }

  async register(email: string, password: string): Promise<{ id: string; email: string }> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      const err: any = new Error('User with this email already exists');
      err.statusCode = 400;
      throw err;
    }

    const hash = await hashPassword(password);

    const user = await this.userRepo.createUser(email, hash);
    return { id: user.id, email: user.email };
  }
}
