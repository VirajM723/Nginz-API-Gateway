import { Response } from 'express';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import { RequestWithId } from '@nginz/tracing';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

export const processPayment = async (req: RequestWithId, res: Response): Promise<void> => {
  const { orderId, amount } = req.body;
  if (!amount) {
    res.status(400).json({ error: true, message: 'amount is required', requestId: req.requestId });
    return;
  }

  try {
    const isNum = !isNaN(Number(orderId));
    if (isNum && orderId) {
      await pool.query("UPDATE orders SET status = 'PAID' WHERE id = $1", [Number(orderId)]);
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      orderId: orderId || 1,
      status: 'PAID',
      instance: process.env.INSTANCE_ID || 'payment-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};
