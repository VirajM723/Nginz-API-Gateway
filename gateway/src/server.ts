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
    try {
      const redis = getRedisClient();
      await redis.ping();
      logger.info('Connected to Redis Cloud successfully');
    } catch (err: any) {
      logger.warn('Redis connection failed on startup. Continuing in fallback mode:', { error: err.message });
    }

    // Initialize RabbitMQ Connection
    try {
      await connectRabbitMQ();
      logger.info('Connected to CloudAMQP RabbitMQ successfully');
    } catch (err: any) {
      logger.warn('RabbitMQ connection failed on startup. Running in degraded messaging mode:', { error: err.message });
    }

    // Test PostgreSQL Connection
    try {
      const client = await pgPool.connect();
      logger.info('Connected to Aiven PostgreSQL successfully');
      client.release();
    } catch (err: any) {
      logger.warn('PostgreSQL connection failed on startup. Running in degraded database mode:', { error: err.message });
    }

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
