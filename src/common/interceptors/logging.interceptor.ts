import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor để ghi log thời gian xử lý của các request
 * Ghi lại thời gian bắt đầu và kết thúc xử lý
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    console.log(`[INTERCEPTOR] ${method} ${url} - Processing started`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        console.log(`[INTERCEPTOR] ${method} ${url} - Processing completed in ${duration}ms`);
      }),
    );
  }
}