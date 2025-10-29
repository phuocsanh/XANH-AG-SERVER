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
 * Bắt tất cả HttpException và các exception khác, trả về response có format nhất quán
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

      // Xử lý ConflictException
      if (exception instanceof ConflictException) {
        errorResponse = {
          error: 'Conflict',
          message: exception.message || 'Dữ liệu đã tồn tại',
        };
      }
      // Xử lý NotFoundException
      else if (exception instanceof NotFoundException) {
        errorResponse = {
          error: 'Not Found',
          message: exception.message || 'Không tìm thấy tài nguyên',
        };
      }
      // Xử lý các custom exception
      else if (exception instanceof DuplicateRecordException) {
        errorResponse = {
          error: 'Duplicate Record',
          message: exception.message || 'Bản ghi đã tồn tại',
          field: (exception as any).field,
        };
      } else if (exception instanceof DatabaseException) {
        errorResponse = {
          error: 'Database Error',
          message: exception.message || 'Lỗi cơ sở dữ liệu',
          details: (exception as any).details,
        };
      } else if (exception instanceof ValidationException) {
        errorResponse = {
          error: 'Validation Error',
          message: exception.message || 'Dữ liệu đầu vào không hợp lệ',
          details: (exception as any).details,
        };
      } else if (exception instanceof ResourceNotFoundException) {
        errorResponse = {
          error: 'Resource Not Found',
          message: exception.message || 'Không tìm thấy tài nguyên',
          resource: (exception as any).resource,
        };
      } else if (exception instanceof BusinessLogicException) {
        errorResponse = {
          error: 'Business Logic Error',
          message: exception.message || 'Lỗi logic nghiệp vụ',
          code: (exception as any).code,
        };
      }
      // Xử lý validation errors từ class-validator
      else if (
        exception instanceof BadRequestException &&
        typeof exceptionResponse === 'object'
      ) {
        const responseObj = exceptionResponse as any;
        if (Array.isArray(responseObj.message)) {
          errorResponse = {
            error: 'Validation Failed',
            message: 'Dữ liệu đầu vào không hợp lệ',
            details: responseObj.message,
          };
        } else {
          errorResponse =
            typeof exceptionResponse === 'string'
              ? { message: exceptionResponse }
              : exceptionResponse;
        }
      } else {
        errorResponse =
          typeof exceptionResponse === 'string'
            ? { message: exceptionResponse }
            : exceptionResponse;
      }
      // } else if (exception instanceof ThrottlerException) {
      //   status = HttpStatus.TOO_MANY_REQUESTS;
      //   errorResponse = {
      //     error: 'Too Many Requests',
      //     message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      //   };
    } else {
      // Xử lý các exception không phải HttpException
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: 'Internal Server Error',
        message: 'Đã xảy ra lỗi không mong muốn',
      };

      // Log lỗi chi tiết cho developer
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Tạo response với format chuẩn
    const errorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...errorResponse,
    };

    // Log request info cho debugging (chỉ log lỗi 5xx)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}`,
        JSON.stringify(errorResponseBody),
      );
    }

    response.status(status).json(errorResponseBody);
  }
}
