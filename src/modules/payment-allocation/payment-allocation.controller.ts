import { Controller, Get, Post, Body } from '@nestjs/common';
import { PaymentAllocationService } from './payment-allocation.service';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { SearchPaymentAllocationDto } from './dto/search-payment-allocation.dto';

@Controller('payment-allocations')
export class PaymentAllocationController {
  constructor(private readonly allocationService: PaymentAllocationService) {}

  @Post()
  create(@Body() createDto: CreatePaymentAllocationDto) {
    return this.allocationService.create(createDto);
  }

  @Get()
  findAll() {
    return this.allocationService.findAll();
  }

  @Post('search')
  search(@Body() searchDto: SearchPaymentAllocationDto) {
    return this.allocationService.search(searchDto);
  }
}
