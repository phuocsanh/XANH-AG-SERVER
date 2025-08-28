import { Request, Response, NextFunction } from 'express';

/**
 * Middleware ghi log các request HTTP
 * Ghi lại thông tin về method, URL và thời gian xử lý
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const { method, originalUrl } = req;
  const startTime = Date.now();

  // Ghi log khi request bắt đầu
  console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} - START`);

  // Lắng nghe sự kiện finish để ghi log khi response hoàn tất
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms`);
  });

  next();
}