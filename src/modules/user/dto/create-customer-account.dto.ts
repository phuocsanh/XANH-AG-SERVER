import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO để tạo tài khoản đăng nhập cho khách hàng
 */
export class CreateCustomerAccountDto {
  @ApiProperty({ 
    description: 'ID của khách hàng cần tạo tài khoản', 
    example: 1 
  })
  @IsNumber({}, { message: 'ID khách hàng phải là số' })
  customer_id!: number;
}
