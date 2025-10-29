import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseException } from '../exceptions/database.exception';
import { DuplicateRecordException } from '../exceptions/duplicate-record.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { ResourceNotFoundException } from '../exceptions/not-found.exception';
import { BusinessLogicException } from '../exceptions/business-logic.exception';
// import { ThrottlerException } from '@nestjs/throttler';

/**
 * Filter xử lý các exception HTTP trong ứng dụng
 * Bắt tất cả HttpException và các exception khác, trả về response có format nhất quán theo RFC 7807
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Xử lý các custom exception
      if (exception instanceof DuplicateRecordException) {
        errorResponse = {
          type: 'https://example.com/probs/duplicate-record',
          title: 'Duplicate Record',
          status: status,
          detail: exception.message || 'Bản ghi đã tồn tại',
          field: (exception as any).field,
        };
      } else if (exception instanceof DatabaseException) {
        errorResponse = {
          type: 'https://example.com/probs/database-error',
          title: 'Database Error',
          status: status,
          detail: exception.message || 'Lỗi cơ sở dữ liệu',
          details: (exception as any).details,
        };
      } else if (exception instanceof ValidationException) {
        // Chuyển đổi details thành format thống nhất
        let details = [];
        if ((exception as any).details) {
          details = (exception as any).details.map((detail: any) => {
            if (typeof detail === 'string') {
              return { message: detail };
            }
            return detail;
          });
        }

        errorResponse = {
          type: 'https://example.com/probs/validation-error',
          title: 'Validation Error',
          status: status,
          detail: exception.message || 'Dữ liệu đầu vào không hợp lệ',
          details: details,
        };
      } else if (exception instanceof ResourceNotFoundException) {
        errorResponse = {
          type: 'https://example.com/probs/resource-not-found',
          title: 'Resource Not Found',
          status: status,
          detail: exception.message || 'Không tìm thấy tài nguyên',
          resource: (exception as any).resource,
        };
      } else if (exception instanceof BusinessLogicException) {
        errorResponse = {
          type: 'https://example.com/probs/business-logic-error',
          title: 'Business Logic Error',
          status: status,
          detail: exception.message || 'Lỗi logic nghiệp vụ',
          code: (exception as any).code,
        };
      } else if (exception instanceof ConflictException) {
        errorResponse = {
          type: 'https://example.com/probs/conflict',
          title: 'Conflict',
          status: status,
          detail: exception.message || 'Dữ liệu đã tồn tại',
        };
      } else if (exception instanceof NotFoundException) {
        errorResponse = {
          type: 'https://example.com/probs/not-found',
          title: 'Not Found',
          status: status,
          detail: exception.message || 'Không tìm thấy tài nguyên',
        };
      }
      // Xử lý validation errors từ class-validator
      else if (exception instanceof BadRequestException) {
        const responseObj = exceptionResponse as any;
        let details: Array<{ field?: string; message: string }> = [];

        if (responseObj.message && Array.isArray(responseObj.message)) {
          // Chuyển đổi mảng message thành format thống nhất với field extraction
          details = responseObj.message.map((msg: string) => {
            // Trích xuất field name từ message nếu có dạng "fieldName must be..."
            const fieldMatch = msg.match(
              /^([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s/,
            );
            return {
              field: fieldMatch ? fieldMatch[1] : undefined,
              message: msg,
            };
          });
        } else if (typeof responseObj.message === 'string') {
          details = [{ message: responseObj.message }];
        }

        errorResponse = {
          type: 'https://example.com/probs/validation-error',
          title: 'Validation Error',
          status: status,
          detail: 'Dữ liệu đầu vào không hợp lệ',
          details: details,
        };
      } else {
        // Xử lý các HttpException khác
        let message = 'Lỗi không xác định';
        let code: string | undefined;

        if (typeof exceptionResponse === 'string') {
          message = exceptionResponse;
        } else if (typeof exceptionResponse === 'object') {
          const responseObj = exceptionResponse as any;
          message = responseObj.message || message;
          code = responseObj.error;
        }

        errorResponse = {
          type: 'https://example.com/probs/http-error',
          title: 'HTTP Error',
          status: status,
          detail: message,
          ...(code ? { code } : {}),
        };
      }
    } else {
      // Xử lý các exception không phải HttpException
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        type: 'https://example.com/probs/internal-server-error',
        title: 'Internal Server Error',
        status: status,
        detail: 'Đã xảy ra lỗi không mong muốn',
      };

      // Log lỗi chi tiết cho developer
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Log request info cho debugging (chỉ log lỗi 5xx)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        JSON.stringify(errorResponse),
      );
    }

    response.status(status).json(errorResponse);
  }
}
