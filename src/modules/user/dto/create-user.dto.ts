import { IsString, IsOptional, IsEmail } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo người dùng mới
 * Chứa các trường cần thiết để tạo một người dùng
 */
export class CreateUserDto {
  /** Tên tài khoản người dùng (bắt buộc) */
  @IsString()
  userAccount!: string;

  /** Mật khẩu người dùng (bắt buộc) */
  @IsString()
  userPassword!: string;

  /** Salt dùng để hash mật khẩu (tùy chọn - sẽ được tạo tự động) */
  @IsOptional()
  @IsString()
  userSalt?: string;

  /** Email người dùng (tùy chọn) */
  @IsOptional()
  @IsEmail()
  userEmail?: string;
}
