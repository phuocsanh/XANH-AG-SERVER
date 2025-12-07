import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PaymentAllocationService } from './payment-allocation.service';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { SearchPaymentAllocationDto } from './dto/search-payment-allocation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('payment-allocations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentAllocationController {
  constructor(private readonly allocationService: PaymentAllocationService) {}

  @Post()
  @RequirePermissions('SALES_MANAGE')
  create(@Body() createDto: CreatePaymentAllocationDto) {
    return this.allocationService.create(createDto);
  }

  @Post('search')
  @RequirePermissions('SALES_VIEW')
  search(@Body() searchDto: SearchPaymentAllocationDto) {
    return this.allocationService.search(searchDto);
  }
}
