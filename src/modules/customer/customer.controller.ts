import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @RequirePermissions('SALES_MANAGE')
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Post('search')
  @RequirePermissions('SALES_VIEW')
  search(@Body() searchDto: SearchCustomerDto) {
    return this.customerService.searchCustomers(searchDto);
  }

  @Post('debtors')
  @RequirePermissions('SALES_VIEW')
  getDebtors(@Body() searchDto: SearchCustomerDto) {
    return this.customerService.getCustomersWithDebt(searchDto);
  }



  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(+id);
  }

  @Get(':id/debt-summary')
  @RequirePermissions('SALES_VIEW')
  getDebtSummary(@Param('id') id: string) {
    return this.customerService.getCustomerDebtSummary(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(+id, updateCustomerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.remove(+id);
  }
}
