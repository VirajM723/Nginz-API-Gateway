import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RequestWithId } from '@nginz/tracing';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: any, req: RequestWithId, res: Response, _next: NextFunction): void => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] [${req.requestId || 'no-id'}] ${statusCode} - ${message}`, err.stack);

  res.status(statusCode).json({
    error: true,
    message,
    statusCode,
    requestId: req.requestId,
  });
};

export * from './registration';
export * from './chaos';


