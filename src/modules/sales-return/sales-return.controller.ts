import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SalesReturnService } from './sales-return.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('sales-returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @Post()
  @RequirePermissions('SALES_MANAGE')
  create(@Body() createDto: CreateSalesReturnDto) {
    return this.salesReturnService.create(createDto);
  }

  @Post('search')
  @RequirePermissions('SALES_VIEW')
  search(@Body() searchDto: SearchSalesReturnDto) {
    return this.salesReturnService.search(searchDto);
  }
}
