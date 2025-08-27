import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loggingMiddleware } from './common/middleware/logging.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Hàm khởi tạo ứng dụng NestJS
 * Cấu hình các thành phần cần thiết và khởi động server
 */
async function bootstrap() {
  // Tạo ứng dụng NestJS từ AppModule
  const app = await NestFactory.create(AppModule);

  // Bật CORS để cho phép các domain khác truy cập API
  app.enableCors();

  // Đăng ký global validation pipe để tự động xác thực dữ liệu đầu vào
  app.useGlobalPipes(new ValidationPipe());

  // Sử dụng middleware để ghi log các request
  app.use(loggingMiddleware);

  // Đăng ký global exception filter để xử lý các exception
  app.useGlobalFilters(new HttpExceptionFilter());

  // Đăng ký global interceptor để ghi log thời gian xử lý
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Cấu hình Swagger để tạo tài liệu API
  const config = new DocumentBuilder()
    .setTitle('GN API') // Tiêu đề API
    .setDescription('API documentation for GN application') // Mô tả API
    .setVersion('1.0') // Phiên bản API
    .addBearerAuth() // Thêm xác thực Bearer token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Lấy port từ biến môi trường hoặc mặc định là 3000
  const port = process.env.PORT || 3000;

  // Khởi động server và lắng nghe trên port đã cấu hình
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}

// Gọi hàm bootstrap để khởi động ứng dụng
bootstrap();
