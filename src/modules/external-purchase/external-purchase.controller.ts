import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExternalPurchaseService } from './external-purchase.service';
import { CreateExternalPurchaseDto, UpdateExternalPurchaseDto } from './dto/external-purchase.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('External Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('external-purchases')
export class ExternalPurchaseController {
  constructor(private readonly service: ExternalPurchaseService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo hóa đơn mua ngoài' })
  create(
    @Body() dto: CreateExternalPurchaseDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.service.create(dto, userId);
  }

  @Get('rice-crop/:riceCropId')
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn theo Ruộng lúa' })
  findByRiceCrop(@Param('riceCropId', ParseIntPipe) riceCropId: number) {
    return this.service.findByRiceCrop(riceCropId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hóa đơn' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hóa đơn' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExternalPurchaseDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa hóa đơn' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.service.remove(id, userId);
  }
}
