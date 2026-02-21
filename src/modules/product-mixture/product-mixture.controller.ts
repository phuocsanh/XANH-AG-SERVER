import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProductMixtureService } from './product-mixture.service';
import { CreateProductMixtureDto } from './dto/create-product-mixture.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('product-mixtures')
@UseGuards(JwtAuthGuard)
export class ProductMixtureController {
  constructor(private readonly mixtureService: ProductMixtureService) {}

  @Post()
  async create(@Body() createDto: CreateProductMixtureDto, @Request() req: any) {
    const userId = req.user.id;
    return this.mixtureService.createMixture(createDto, userId);
  }

  @Get()
  async findAll() {
    return this.mixtureService.findAllMixtures();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.mixtureService.findOneMixture(+id);
  }
}
