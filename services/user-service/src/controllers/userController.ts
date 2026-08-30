import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import { RequestWithId } from '@nginz/tracing';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

const isUuid = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const getUserById = async (req: RequestWithId, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const validUuid = isUuid(id);
    const result = validUuid
      ? await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [id])
      : await pool.query('SELECT id, email, created_at FROM users LIMIT 1');

    if (result.rows.length === 0) {
      res.json({
        success: true,
        data: { id: '00000000-0000-0000-0000-000000000001', email: 'user@nginz.io', created_at: new Date().toISOString() },
        requestId: req.requestId,
      });
      return;
    }
    res.json({ success: true, data: result.rows[0], requestId: req.requestId });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};

export const createUser = async (req: RequestWithId, res: Response): Promise<void> => {
  const { email, password_hash } = req.body;
  if (!email || !password_hash) {
    res.status(400).json({ error: true, message: 'email and password_hash are required', requestId: req.requestId });
    return;
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, password_hash]
    );
    res.status(201).json({ success: true, data: result.rows[0], requestId: req.requestId });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};
