import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware để log các HTTP request
 * Ghi lại thông tin cơ bản của mỗi request đến server
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    // Log thông tin request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Lắng nghe sự kiện finish để log response
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      
      this.logger.log(
        `${method} ${originalUrl} - ${statusCode} - ${responseTime}ms`,
      );
    });

    next();
  }
}

/**
 * Function middleware để sử dụng trong main.ts
 * @param req Request object
 * @param res Response object  
 * @param next NextFunction
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const logger = new Logger('HTTP');
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('User-Agent') || '';
  const startTime = Date.now();

  logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

  res.on('finish', () => {
    const { statusCode } = res;
    const responseTime = Date.now() - startTime;
    logger.log(`${method} ${originalUrl} - ${statusCode} - ${responseTime}ms`);
  });

  next();
}