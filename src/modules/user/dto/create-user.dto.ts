import { IsString, IsNumber, IsOptional, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  userAccount: string;

  @IsString()
  userPassword: string;

  @IsString()
  userSalt: string;

  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @IsOptional()
  @IsNumber()
  userState?: number;
}