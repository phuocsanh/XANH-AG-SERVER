import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateProductDto {
  @IsString()
  productName: string;

  @IsString()
  productPrice: string;

  @IsOptional()
  @IsNumber()
  productStatus?: number;

  @IsString()
  productThumb: string;

  @IsOptional()
  @IsArray()
  productPictures?: string[];

  @IsOptional()
  @IsArray()
  productVideos?: string[];

  @IsOptional()
  @IsString()
  productDescription?: string;

  @IsOptional()
  @IsNumber()
  productQuantity?: number;

  @IsNumber()
  productType: number;

  @IsOptional()
  @IsArray()
  subProductType?: number[];

  @IsOptional()
  @IsString()
  discount?: string;

  @IsString()
  productDiscountedPrice: string;

  @IsOptional()
  @IsNumber()
  productSelled?: number;

  @IsOptional()
  productAttributes?: any;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsString()
  averageCostPrice: string;

  @IsString()
  profitMarginPercent: string;
}