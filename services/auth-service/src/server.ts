import { app } from './app';
import { createLogger } from '@nginz/logger';
import { registerService } from '@nginz/middleware';

const logger = createLogger('auth-service');
const port = parseInt(process.env.SERVICE_PORT || '3001', 10);
const instanceId = process.env.INSTANCE_ID || `auth-service-${port}`;
const host = process.env.SERVICE_HOST || process.env.HOST || instanceId;

const server = app.listen(port, async () => {
  logger.info(`Auth Service running on port ${port} [Instance: ${instanceId}]`);
  await registerService({
    serviceName: 'auth-service',
    instanceId,
    host,
    port,
    server,
  });
});
