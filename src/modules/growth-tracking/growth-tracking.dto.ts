import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { GrowthStage } from '../../entities/rice-crop.entity';
import { HealthStatus, SeverityLevel } from '../../entities/growth-tracking.entity';

export class CreateGrowthTrackingDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  rice_crop_id!: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  tracking_date!: string;

  @ApiProperty({ enum: GrowthStage })
  @IsNotEmpty()
  @IsEnum(GrowthStage)
  growth_stage!: GrowthStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plant_height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tiller_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leaf_color?: string;

  @ApiProperty({ enum: HealthStatus })
  @IsNotEmpty()
  @IsEnum(HealthStatus)
  health_status!: HealthStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pest_disease_detected?: string;

  @ApiPropertyOptional({ enum: SeverityLevel })
  @IsOptional()
  @IsEnum(SeverityLevel)
  severity?: SeverityLevel;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  photo_urls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGrowthTrackingDto {
  @ApiPropertyOptional({ enum: GrowthStage })
  @IsOptional()
  @IsEnum(GrowthStage)
  growth_stage?: GrowthStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  plant_height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tiller_count?: number;

  @ApiPropertyOptional({ enum: HealthStatus })
  @IsOptional()
  @IsEnum(HealthStatus)
  health_status?: HealthStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
