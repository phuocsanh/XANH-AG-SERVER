import { Request, Response, NextFunction } from 'express';

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(`Request... ${req.method} ${req.url}`);
  next();
}
