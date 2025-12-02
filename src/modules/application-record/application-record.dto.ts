import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType } from '../../entities/farming-schedule.entity';
import { ApplicationProduct } from '../../entities/application-record.entity';

export class CreateApplicationRecordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  rice_crop_id!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  farming_schedule_id?: number;

  @ApiProperty({ enum: ActivityType })
  @IsNotEmpty()
  @IsEnum(ActivityType)
  activity_type!: ActivityType;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  application_date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  application_time?: string;

  @ApiProperty({ type: 'array' })
  @IsNotEmpty()
  @IsArray()
  products!: ApplicationProduct[];

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  total_cost!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weather_condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  effectiveness?: number;
}

export class UpdateApplicationRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  application_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  total_cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  effectiveness?: number;
}
