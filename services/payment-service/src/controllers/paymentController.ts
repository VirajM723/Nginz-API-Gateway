import { Response } from 'express';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import { RequestWithId } from '@nginz/tracing';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

// Idle clients emit 'error' when Postgres drops connections; without a listener the process exits
pool.on('error', (err) => {
  console.error('[Postgres] Idle client error:', err.message);
});

export const processPayment = async (req: RequestWithId, res: Response): Promise<void> => {
  const { orderId, amount } = req.body;
  if (!amount) {
    res.status(400).json({ error: true, message: 'amount is required', requestId: req.requestId });
    return;
  }

  try {
    // Orders are keyed by UUID; other order references are treated as standalone payments
    const isOrderUuid = typeof orderId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (isOrderUuid) {
      const result = await pool.query("UPDATE orders SET status = 'PAID' WHERE id = $1", [orderId]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: true, message: 'Order not found', requestId: req.requestId });
        return;
      }
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      orderId: orderId ?? null,
      orderUpdated: isOrderUuid,
      status: 'PAID',
      instance: process.env.INSTANCE_ID || 'payment-service-1',
      requestId: req.requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message, requestId: req.requestId });
  }
};
