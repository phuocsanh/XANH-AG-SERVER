import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEnum, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryStatus } from '../enums/delivery-status.enum';

/**
 * DTO cho chi tiết sản phẩm trong phiếu giao hàng
 */
export class CreateDeliveryLogItemDto {
  /** ID item trong hóa đơn (optional - dùng khi tạo từ hóa đơn) */
  @ApiProperty({ description: 'ID item trong hóa đơn', example: 10, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'ID item hóa đơn phải là số' })
  sales_invoice_item_id?: number;

  /** ID sản phẩm (optional - dùng khi tạo độc lập) */
  @ApiProperty({ description: 'ID sản phẩm', example: 5, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'ID sản phẩm phải là số' })
  product_id?: number;

  /** Số lượng giao */
  @ApiProperty({ description: 'Số lượng giao', example: 10 })
  @IsNotEmpty({ message: 'Số lượng giao không được để trống' })
  @IsNumber({}, { message: 'Số lượng giao phải là số' })
  quantity!: number;

  /** Đơn vị */
  @ApiProperty({ description: 'Đơn vị', example: 'kg', required: false })
  @IsOptional()
  @IsString({ message: 'Đơn vị phải là chuỗi' })
  unit?: string;

  /** Ghi chú cho sản phẩm */
  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO tạo phiếu giao hàng
 */
export class CreateDeliveryLogDto {
  /** ID hóa đơn (optional - null nếu tạo độc lập) */
  @ApiProperty({ description: 'ID hóa đơn', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'ID hóa đơn phải là số' })
  invoice_id?: number;

  /** Ngày giao hàng */
  @ApiProperty({ description: 'Ngày giao hàng', example: '2024-12-25' })
  @IsNotEmpty({ message: 'Ngày giao hàng không được để trống' })
  @IsDateString({}, { message: 'Ngày giao hàng không hợp lệ' })
  delivery_date!: string;

  /** Giờ bắt đầu giao hàng */
  @ApiProperty({ description: 'Giờ bắt đầu giao hàng', example: '08:00:00', required: false })
  @IsOptional()
  @IsString({ message: 'Giờ giao hàng phải là chuỗi' })
  delivery_start_time?: string;

  /** ID mùa vụ (Dùng cho tạo độc lập) */
  @ApiProperty({ description: 'ID mùa vụ', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'ID mùa vụ phải là số' })
  season_id?: number;

  /** Địa chỉ giao hàng */
  @ApiProperty({ description: 'Địa chỉ giao hàng', required: false })
  @IsOptional()
  @IsString({ message: 'Địa chỉ giao hàng phải là chuỗi' })
  delivery_address?: string;

  /** Tên người nhận */
  @ApiProperty({ description: 'Tên người nhận', example: 'Nguyễn Văn A', required: false })
  @IsOptional()
  @IsString({ message: 'Tên người nhận phải là chuỗi' })
  receiver_name?: string;

  /** Số điện thoại người nhận */
  @ApiProperty({ description: 'Số điện thoại người nhận', example: '0987654321', required: false })
  @IsOptional()
  @IsString({ message: 'Số điện thoại người nhận phải là chuỗi' })
  receiver_phone?: string;

  /** Ghi chú giao hàng */
  @ApiProperty({ description: 'Ghi chú giao hàng', required: false })
  @IsOptional()
  @IsString({ message: 'Ghi chú giao hàng phải là chuỗi' })
  delivery_notes?: string;

  /** Tên tài xế */
  @ApiProperty({ description: 'Tên tài xế', example: 'Nguyễn Văn B', required: false })
  @IsOptional()
  @IsString({ message: 'Tên tài xế phải là chuỗi' })
  driver_name?: string;

  /** Số xe (biển số) */
  @ApiProperty({ description: 'Số xe (biển số)', example: '67A-12345', required: false })
  @IsOptional()
  @IsString({ message: 'Số xe phải là chuỗi' })
  vehicle_number?: string;

  /** Tổng chi phí */
  @ApiProperty({ description: 'Tổng chi phí giao hàng', example: 220000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  total_cost?: number;

  /** Trạng thái giao hàng */
  @ApiProperty({ 
    description: 'Trạng thái giao hàng', 
    enum: DeliveryStatus,
    example: DeliveryStatus.PENDING,
    required: false 
  })
  @IsOptional()
  @IsEnum(DeliveryStatus, { message: 'Trạng thái giao hàng không hợp lệ' })
  status?: DeliveryStatus;

  /** Danh sách sản phẩm cần giao */
  @ApiProperty({ 
    description: 'Danh sách sản phẩm cần giao', 
    type: [CreateDeliveryLogItemDto],
    required: false
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách sản phẩm phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryLogItemDto)
  items?: CreateDeliveryLogItemDto[];
}

/**
 * DTO cập nhật phiếu giao hàng
 */
export class UpdateDeliveryLogDto {
  /** Ngày giao hàng */
  @ApiProperty({ description: 'Ngày giao hàng', example: '2024-12-25', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày giao hàng không hợp lệ' })
  delivery_date?: string;

  /** Giờ bắt đầu giao hàng */
  @ApiProperty({ description: 'Giờ bắt đầu giao hàng', example: '08:00:00', required: false })
  @IsOptional()
  @IsString({ message: 'Giờ giao hàng phải là chuỗi' })
  delivery_start_time?: string;

  /** ID mùa vụ */
  @ApiProperty({ description: 'ID mùa vụ', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'ID mùa vụ phải là số' })
  season_id?: number;

  /** Khoảng cách (km) */
  @ApiProperty({ description: 'Khoảng cách (km)', example: 50, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Khoảng cách phải là số' })
  distance_km?: number;

  /** Chi phí xăng xe */
  @ApiProperty({ description: 'Chi phí xăng xe', example: 150000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Chi phí xăng xe phải là số' })
  fuel_cost?: number;

  /** Chi phí tài xế */
  @ApiProperty({ description: 'Chi phí tài xế', example: 50000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Chi phí tài xế phải là số' })
  driver_cost?: number;

  /** Chi phí khác */
  @ApiProperty({ description: 'Chi phí khác', example: 20000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Chi phí khác phải là số' })
  other_costs?: number;

  /** Tổng chi phí */
  @ApiProperty({ description: 'Tổng chi phí giao hàng', example: 220000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  total_cost?: number;

  /** Tên tài xế */
  @ApiProperty({ description: 'Tên tài xế', example: 'Nguyễn Văn B', required: false })
  @IsOptional()
  @IsString({ message: 'Tên tài xế phải là chuỗi' })
  driver_name?: string;

  /** Biển số xe */
  @ApiProperty({ description: 'Biển số xe', example: '67A-12345', required: false })
  @IsOptional()
  @IsString({ message: 'Biển số xe phải là chuỗi' })
  vehicle_plate?: string;

  /** Địa chỉ giao hàng */
  @ApiProperty({ description: 'Địa chỉ giao hàng', required: false })
  @IsOptional()
  @IsString({ message: 'Địa chỉ giao hàng phải là chuỗi' })
  delivery_address?: string;

  /** Trạng thái giao hàng */
  @ApiProperty({ 
    description: 'Trạng thái giao hàng', 
    enum: DeliveryStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(DeliveryStatus, { message: 'Trạng thái giao hàng không hợp lệ' })
  status?: DeliveryStatus;

  /** Ghi chú */
  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;

  /** Danh sách sản phẩm cần giao (cập nhật) */
  @ApiProperty({ 
    description: 'Danh sách sản phẩm cần giao', 
    type: [CreateDeliveryLogItemDto],
    required: false
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách sản phẩm phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryLogItemDto)
  items?: CreateDeliveryLogItemDto[];
}
