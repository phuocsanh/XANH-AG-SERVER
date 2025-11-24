import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSeasonDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsInt()
  year!: number;

  @IsOptional()
  @IsDateString()
  start_date?: Date;

  @IsOptional()
  @IsDateString()
  end_date?: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
