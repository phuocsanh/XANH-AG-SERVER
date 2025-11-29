import { IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO cho việc duyệt tài khoản
 */
export class ApproveUserDto {
  @IsNotEmpty()
  @IsNumber()
  user_id!: number;
}
