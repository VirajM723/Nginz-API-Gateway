import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface RequestWithId extends Request {
  requestId?: string;
}

export const requestIdMiddleware = (req: RequestWithId, res: Response, next: NextFunction): void => {
  const existingId = req.headers[REQUEST_ID_HEADER] as string;
  const requestId = existingId || uuidv4();
  
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  
  next();
};
