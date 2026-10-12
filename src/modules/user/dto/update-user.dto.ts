import { IsString, MaxLength, IsOptional, IsNumber } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsString()
  @MaxLength(255)
  fcm_token?: string;

  @IsOptional()
  @IsNumber()
  role_id?: number;
}