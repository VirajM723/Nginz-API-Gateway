import { app } from './app';
import { createLogger } from '@nginz/logger';
import { registerService } from '@nginz/middleware';

const logger = createLogger('order-service');

const port = Number(process.env.SERVICE_PORT || process.env.PORT || 3004);
const instanceId = process.env.INSTANCE_ID || `order-service-${port}`;
const host = process.env.SERVICE_HOST || process.env.HOST || instanceId;

const server = app.listen(port, async () => {
  logger.info(`[Order Service] Running instance ${instanceId} on port ${port}`);
  await registerService({
    serviceName: 'order-service',
    instanceId,
    host,
    port,
    server,
  });
});
