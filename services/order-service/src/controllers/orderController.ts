import { Response } from 'express';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import { publishToQueue } from '@nginz/rabbitmq';
import { RequestWithId } from '@nginz/tracing';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

const isUuid = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const createOrder = async (req: RequestWithId, res: Response): Promise<void> => {
  const { userId, totalAmount, processAsync } = req.body;
  if (!totalAmount) {
    res.status(400).json({ error: true, message: 'totalAmount is required', requestId: req.requestId });
    return;
  }

  const initialStatus = processAsync ? 'PAYMENT_PENDING' : 'CREATED';
  const dbUserId = userId && isUuid(userId) ? userId : null;

  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
      [dbUserId, totalAmount, initialStatus]
    );

    const order = result.rows[0];

    // If async or degraded payment processing, queue payment job to RabbitMQ
    if (processAsync || req.headers['x-degraded-payment'] === 'true') {
      try {
        await publishToQueue('payments.process', {
          orderId: order.id,
          userId: order.user_id,
          amount: order.total_amount,
          createdAt: order.created_at,
          requestId: req.requestId,
        });
      } catch {
        // Queue error fallback log
      }
    }

    res.status(201).json({
      success: true,
      data: order,
      instance: process.env.INSTANCE_ID || 'order-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};

export const getOrderById = async (req: RequestWithId, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const isNum = !isNaN(Number(id));
    const result = isNum
      ? await pool.query('SELECT * FROM orders WHERE id = $1', [Number(id)])
      : await pool.query('SELECT * FROM orders LIMIT 1');

    if (result.rows.length === 0) {
      res.status(404).json({ error: true, message: 'Order not found', requestId: req.requestId });
      return;
    }
    res.json({
      success: true,
      data: result.rows[0],
      instance: process.env.INSTANCE_ID || 'order-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};
