import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

export interface LogMeta {
  requestId?: string;
  service?: string;
  route?: string;
  latency?: number;
  statusCode?: number;
  [key: string]: any;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

export const createLogger = (serviceName: string) => {
  const logDir = path.join(process.cwd(), 'logs');

  const fileTransport = new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: `${serviceName}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  });

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
            const reqIdStr = requestId ? ` [${requestId}]` : '';
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${service}] ${level}:${reqIdStr} ${message}${metaStr}`;
          })
        ),
      }),
      fileTransport,
    ],
  });

  return logger;
};
