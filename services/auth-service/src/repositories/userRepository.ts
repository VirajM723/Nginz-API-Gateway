import { Pool } from 'pg';
import { config } from '@nginz/config';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
export const pgPool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const res = await pgPool.query('SELECT * FROM users WHERE email = $1;', [email]);
    return res.rows[0] || null;
  }

  async findById(id: string): Promise<User | null> {
    const res = await pgPool.query('SELECT * FROM users WHERE id = $1;', [id]);
    return res.rows[0] || null;
  }

  async createUser(email: string, passwordHash: string): Promise<User> {
    const res = await pgPool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *;',
      [email, passwordHash]
    );
    return res.rows[0];
  }
}
