import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loggingMiddleware } from './common/middleware/logging.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/**
 * Hàm khởi tạo ứng dụng NestJS
 * Cấu hình các thành phần cần thiết và khởi động server
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Tạo ứng dụng NestJS từ AppModule
  const app = await NestFactory.create(AppModule);

  // Cấu hình Helmet để bảo mật HTTP headers (chỉ trong production)
  if (process.env.NODE_ENV === 'production') {
    const helmet = await import('helmet');
    app.use(helmet.default({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          scriptSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Tắt để tương thích với Swagger
    }));
    logger.log('✅ Helmet security headers enabled');
  }

  // Cấu hình CORS nghiêm ngặt hơn
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const corsOptions = {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true, // Cho phép gửi cookies
    optionsSuccessStatus: 200, // Tương thích với IE11
  };

  // Xử lý trường hợp cho phép tất cả các nguồn (*)
  if (corsOrigin === '*') {
    app.enableCors({
      ...corsOptions,
      origin: true, // Cho phép tất cả các nguồn
    });
    logger.warn('⚠️  CORS: Allowing all origins (development mode)');
  } else {
    app.enableCors({
      ...corsOptions,
      origin: corsOrigin.split(','), // Hỗ trợ nhiều domain cụ thể
    });
    logger.log(`✅ CORS: Restricted to ${corsOrigin}`);
  }

  // Đăng ký global validation pipe để tự động xác thực dữ liệu đầu vào
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Tự động chuyển đổi dữ liệu theo DTO
      whitelist: true, // Loại bỏ các thuộc tính không có trong DTO
      forbidNonWhitelisted: false, // Allow properties not defined in DTO for testing
      transformOptions: {
        enableImplicitConversion: false, // Tắt tự động convert kiểu dữ liệu
      },
      validationError: {
        target: false, // Không trả về target object trong error
        value: false, // Không trả về giá trị trong error (bảo mật)
      },
      exceptionFactory: (errors) => {
        // Custom error factory để format lỗi validation
        return new ValidationPipe().createExceptionFactory()(errors);
      },
    }),
  );

  // Sử dụng middleware để ghi log các request
  app.use(loggingMiddleware);

  // Đăng ký global exception filter để xử lý các exception
  app.useGlobalFilters(new HttpExceptionFilter());

  // Đăng ký global interceptor để ghi log thời gian xử lý
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Đăng ký global interceptor để chuẩn hóa response
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Cấu hình Swagger để tạo tài liệu API
  const config = new DocumentBuilder()
    .setTitle('GN API') // Tiêu đề API
    .setDescription('API documentation for GN application') // Mô tả API
    .setVersion('1.0') // Phiên bản API
    .addBearerAuth() // Thêm xác thực Bearer token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Lấy port từ biến môi trường hoặc mặc định là 3003
  const port = process.env.PORT || 3003;

  // Khởi động server và lắng nghe trên port đã cấu hình
  await app.listen(port, '0.0.0.0');
  
  const url = await app.getUrl();
  logger.log(`🚀 Application is running on: ${url}`);
  logger.log(`📚 API Documentation: ${url}/api`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

// Gọi hàm bootstrap để khởi động ứng dụng
bootstrap();
