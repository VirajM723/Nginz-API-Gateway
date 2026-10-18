import { consumeFromQueue } from '@nginz/rabbitmq';
import { createLogger } from '@nginz/logger';
import { Pool } from 'pg';
import { config } from '@nginz/config';

const logger = createLogger('payment-worker');

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

// Idle clients emit 'error' when Postgres drops connections; without a listener the process exits
pool.on('error', (err) => {
  console.error('[Postgres] Idle client error:', err.message);
});

export const startPaymentWorker = async (): Promise<void> => {
  try {
    await consumeFromQueue('payments.process', async (msg) => {
      logger.info(`[Payment Worker] Processing async payment job ${msg.jobId ?? ''} for Order ID: ${msg.orderId}`);
      // Orders are keyed by UUID; jobs for other references are acknowledged without an order update
      const orderId = String(msg.orderId ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        logger.warn(`[Payment Worker] Job ${msg.jobId ?? ''} has no order UUID (${msg.orderId}); recorded without order update`);
        return;
      }
      try {
        const result = await pool.query("UPDATE orders SET status = 'PAID' WHERE id = $1", [orderId]);
        logger.info(`[Payment Worker] Successfully processed payment for Order ID: ${orderId} (${result.rowCount} row updated)`);
      } catch (err: any) {
        logger.error(`[Payment Worker] Failed payment for Order ID: ${msg.orderId}`, { error: err.message });
        throw err; // Trigger RabbitMQ retry / dead-lettering
      }
    });
    logger.info('[Payment Worker] Listening for async payment jobs on queue payments.process');
  } catch (err: any) {
    logger.error('Failed to initialize payment RabbitMQ worker', { error: err.message });
  }
};
