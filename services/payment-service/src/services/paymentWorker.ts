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

export const startPaymentWorker = async (): Promise<void> => {
  try {
    await consumeFromQueue('payments.process', async (msg) => {
      logger.info(`[Payment Worker] Processing async payment job for Order ID: ${msg.orderId}`);
      try {
        await pool.query("UPDATE orders SET status = 'PAID' WHERE id = $1", [msg.orderId]);
        logger.info(`[Payment Worker] Successfully processed payment for Order ID: ${msg.orderId}`);
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
