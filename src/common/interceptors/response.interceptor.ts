import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    path: string;
    method: string;
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary?: any; // Field tùy chọn để chứa thông tin tổng hợp từ service
  [key: string]: any; // Cho phép các field bổ sung như summary, statistics, v.v.
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        // Nếu data đã có cấu trúc chuẩn thì trả về nguyên dạng
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Xử lý response có phân trang
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'total' in data
        ) {
          const pagination = {
            total: data.total,
            page: data.page,
            limit: data.limit,
            totalPages: Math.ceil(data.total / data.limit),
          };

          // Tách các field chuẩn ra và giữ lại các field bổ sung (summary, statistics, v.v.)
          const { data: responseData, total, page, limit, ...additionalFields } = data;

          return {
            success: true,
            data: responseData,
            meta: {
              timestamp: new Date().toISOString(),
              path: request.url,
              method: request.method,
            },
            pagination,
            ...additionalFields, // Spread các field bổ sung như summary, statistics, v.v.
          };
        }

        // Response thông thường
        return {
          success: true,
          data: data || null,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          },
        };
      }),
    );
  }
}
