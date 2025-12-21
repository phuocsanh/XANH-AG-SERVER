import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType, ScheduleStatus } from '../../entities/farming-schedule.entity';

export class CreateFarmingScheduleDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  rice_crop_id!: number;

  @ApiPropertyOptional({ enum: ActivityType })
  @IsOptional()
  @IsEnum(ActivityType)
  activity_type?: ActivityType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  activity_name!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  scheduled_date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduled_time?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  product_ids?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimated_quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimated_cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weather_dependent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminder_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completed_date?: string;
}

export class UpdateFarmingScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activity_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduled_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduled_time?: string;

  @ApiPropertyOptional({ enum: ScheduleStatus })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completed_date?: string;

  @ApiPropertyOptional({ enum: ActivityType })
  @IsOptional()
  @IsEnum(ActivityType)
  activity_type?: ActivityType;
}
