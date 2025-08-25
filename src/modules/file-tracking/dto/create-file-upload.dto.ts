import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsDate } from 'class-validator';

export class CreateFileUploadDto {
  @IsString()
  publicId: string;

  @IsString()
  fileUrl: string;

  @IsString()
  fileName: string;

  @IsString()
  fileType: string;

  @IsNumber()
  fileSize: number;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  referenceCount?: number;

  @IsOptional()
  @IsBoolean()
  isTemporary?: boolean;

  @IsOptional()
  @IsBoolean()
  isOrphaned?: boolean;

  @IsOptional()
  @IsNumber()
  uploadedByUserId?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsDate()
  markedForDeletionAt?: Date;

  @IsOptional()
  @IsDate()
  deletedAt?: Date;
}