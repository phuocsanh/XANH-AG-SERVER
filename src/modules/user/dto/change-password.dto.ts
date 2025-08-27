import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để thay đổi mật khẩu người dùng
 * Chứa mật khẩu cũ và mật khẩu mới
 */
export class ChangePasswordDto {
  /** Mật khẩu cũ của người dùng (bắt buộc) */
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  /** Mật khẩu mới của người dùng (bắt buộc) */
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}