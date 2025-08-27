import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor ghi log thời gian xử lý của các request
 * Đo thời gian từ khi bắt đầu xử lý đến khi hoàn thành
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /**
   * Phương thức intercept để xử lý request/response
   * @param context - ExecutionContext chứa thông tin về execution context
   * @param next - CallHandler để tiếp tục xử lý request
   * @returns Observable chứa kết quả xử lý
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Ghi log khi bắt đầu xử lý request
    console.log('Before...');

    // Lấy thời điểm bắt đầu xử lý
    const now = Date.now();

    // Tiếp tục xử lý request và đo thời gian hoàn thành
    return next.handle().pipe(
      // Ghi log thời gian xử lý khi hoàn thành
      tap(() => console.log(`After... ${Date.now() - now}ms`)),
    );
  }
}
