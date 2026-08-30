import { app } from './app';
import { createLogger } from '@nginz/logger';
import { registerService } from '@nginz/middleware';

const logger = createLogger('user-service');

const port = Number(process.env.SERVICE_PORT || process.env.PORT || 3002);
const instanceId = process.env.INSTANCE_ID || `user-service-${port}`;
const host = process.env.SERVICE_HOST || process.env.HOST || instanceId;

const server = app.listen(port, async () => {
  logger.info(`[User Service] Running instance ${instanceId} on port ${port}`);
  await registerService({
    serviceName: 'user-service',
    instanceId,
    host,
    port,
    server,
  });
});
