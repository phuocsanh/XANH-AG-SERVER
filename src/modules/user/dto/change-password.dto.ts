import { IsString, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  /** Mật khẩu cũ của người dùng (bắt buộc) */
  @IsString()
  @IsNotEmpty()
  old_password!: string;

  /** Mật khẩu mới của người dùng (bắt buộc) */
  @IsString()
  @IsNotEmpty()
  new_password!: string;
}
