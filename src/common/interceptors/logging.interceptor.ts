import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Interceptor để log các request và response
 * Ghi lại thời gian xử lý và thông tin cơ bản của request
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const now = Date.now();

    // Log thông tin request
    this.logger.log(
      `${method} ${url} - ${ip} - ${userAgent} - Request started`,
    );

    return next.handle().pipe(
      tap(() => {
        // Log thời gian xử lý khi request hoàn thành
        const responseTime = Date.now() - now;
        this.logger.log(
          `${method} ${url} - ${ip} - ${userAgent} - Completed in ${responseTime}ms`,
        );
      }),
    );
  }
}