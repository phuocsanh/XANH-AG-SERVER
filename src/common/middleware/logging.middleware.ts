import { Request, Response, NextFunction } from 'express';

/**
 * Middleware ghi log các request đến server
 * @param req - Request object
 * @param res - Response object
 * @param next - Hàm tiếp tục xử lý request
 */
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Ghi log thông tin request bao gồm method và URL
  console.log(`Request... ${req.method} ${req.url}`);

  // Gọi next() để tiếp tục xử lý request
  next();
}
