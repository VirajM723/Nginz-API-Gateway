import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import { getRedisClient } from '@nginz/redis';
import { RequestWithId } from '@nginz/tracing';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

export const getProducts = async (req: RequestWithId, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const products = result.rows;

    // Cache products in Redis for Phase 8 degradation
    try {
      const redis = getRedisClient();
      await redis.set('cache:products', JSON.stringify(products), 'EX', 3600);
    } catch {
      // Redis caching fails silently if connection issue
    }

    res.json({
      success: true,
      data: products,
      instance: process.env.INSTANCE_ID || 'product-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};

export const getProductById = async (req: RequestWithId, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: true, message: 'Product not found', requestId: req.requestId });
      return;
    }
    res.json({
      success: true,
      data: result.rows[0],
      instance: process.env.INSTANCE_ID || 'product-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};

export const createProduct = async (req: RequestWithId, res: Response): Promise<void> => {
  const { name, description, price, stock } = req.body;
  if (!name || price === undefined) {
    res.status(400).json({ error: true, message: 'name and price are required', requestId: req.requestId });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || '', price, stock || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      instance: process.env.INSTANCE_ID || 'product-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};
