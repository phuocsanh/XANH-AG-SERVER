import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CustomerType } from '../../../entities/customer.entity';

export class CreateCustomerDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsBoolean()
  is_guest?: boolean;

  @IsOptional()
  @IsString()
  tax_code?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
