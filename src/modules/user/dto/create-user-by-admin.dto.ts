import { IsNotEmpty, IsOptional, IsString, IsNumber, MinLength, MaxLength } from 'class-validator';

/**
 * DTO cho việc tạo tài khoản bởi Admin/Super Admin
 */
export class CreateUserByAdminDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  account!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password!: string;

  @IsNotEmpty()
  @IsNumber()
  role_id!: number;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;
}
