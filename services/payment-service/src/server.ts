import { app } from './app';
import { createLogger } from '@nginz/logger';
import { registerService } from '@nginz/middleware';
import { startPaymentWorker } from './services/paymentWorker';

const logger = createLogger('payment-service');

const port = Number(process.env.SERVICE_PORT || process.env.PORT || 3005);
const instanceId = process.env.INSTANCE_ID || `payment-service-${port}`;
const host = process.env.SERVICE_HOST || process.env.HOST || instanceId;

const server = app.listen(port, async () => {
  logger.info(`[Payment Service] Running instance ${instanceId} on port ${port}`);
  await registerService({
    serviceName: 'payment-service',
    instanceId,
    host,
    port,
    server,
  });

  // Start RabbitMQ background worker for async payments
  startPaymentWorker();
});
