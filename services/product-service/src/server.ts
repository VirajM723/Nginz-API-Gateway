import { app } from './app';
import { createLogger } from '@nginz/logger';
import { registerService } from '@nginz/middleware';

const logger = createLogger('product-service');

const port = Number(process.env.SERVICE_PORT || process.env.PORT || 3003);
const instanceId = process.env.INSTANCE_ID || `product-service-${port}`;
const host = process.env.SERVICE_HOST || process.env.HOST || instanceId;

const server = app.listen(port, async () => {
  logger.info(`[Product Service] Running instance ${instanceId} on port ${port}`);
  await registerService({
    serviceName: 'product-service',
    instanceId,
    host,
    port,
    server,
  });
});
