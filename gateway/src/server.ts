import { app, pgPool } from './app';
import { config } from '@nginz/config';
import { createLogger } from '@nginz/logger';
import { getRedisClient, closeRedis } from '@nginz/redis';
import { connectRabbitMQ, closeRabbitMQ } from '@nginz/rabbitmq';

const logger = createLogger('gateway-server');

const startServer = async () => {
  try {
    logger.info('Initializing NginZ API Gateway Infrastructure Connections...');

    // Initialize Redis Connection
    const redis = getRedisClient();
    await redis.ping();
    logger.info('Connected to Redis Cloud successfully');

    // Initialize RabbitMQ Connection
    await connectRabbitMQ();
    logger.info('Connected to CloudAMQP RabbitMQ successfully');

    // Test PostgreSQL Connection
    const client = await pgPool.connect();
    logger.info('Connected to Aiven PostgreSQL successfully');
    client.release();

    const server = app.listen(config.port, () => {
      logger.info(`NginZ API Gateway running on port ${config.port} [ENV: ${config.nodeEnv}]`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await pgPool.end();
        await closeRedis();
        await closeRabbitMQ();
        logger.info('Infrastructure connections closed cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start Gateway server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();
