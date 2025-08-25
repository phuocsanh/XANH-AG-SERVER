import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Get()
  findAll() {
    return this.productService.findAll();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.productService.searchProducts(query);
  }

  @Get('type/:productType')
  findByType(@Param('productType') productType: number) {
    return this.productService.findByType(productType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }

  // Product Type endpoints
  @Get('type')
  findAllProductTypes() {
    return this.productService.findAllProductTypes();
  }

  @Get('type/:id')
  findOneProductType(@Param('id') id: string) {
    return this.productService.findOneProductType(+id);
  }

  @Post('type')
  createProductType(@Body() createProductTypeDto: any) {
    return this.productService.createProductType(createProductTypeDto);
  }

  @Patch('type/:id')
  updateProductType(
    @Param('id') id: string,
    @Body() updateProductTypeDto: any,
  ) {
    return this.productService.updateProductType(+id, updateProductTypeDto);
  }

  @Delete('type/:id')
  removeProductType(@Param('id') id: string) {
    return this.productService.removeProductType(+id);
  }

  // Product Subtype endpoints
  @Get('subtype')
  findAllProductSubtypes() {
    return this.productService.findAllProductSubtypes();
  }

  @Get('subtype/:id')
  findOneProductSubtype(@Param('id') id: string) {
    return this.productService.findOneProductSubtype(+id);
  }

  @Get('type/:id/subtypes')
  findProductSubtypesByType(@Param('id') id: string) {
    return this.productService.findProductSubtypesByType(+id);
  }

  @Post('subtype')
  createProductSubtype(@Body() createProductSubtypeDto: any) {
    return this.productService.createProductSubtype(createProductSubtypeDto);
  }

  @Patch('subtype/:id')
  updateProductSubtype(
    @Param('id') id: string,
    @Body() updateProductSubtypeDto: any,
  ) {
    return this.productService.updateProductSubtype(
      +id,
      updateProductSubtypeDto,
    );
  }

  @Delete('subtype/:id')
  removeProductSubtype(@Param('id') id: string) {
    return this.productService.removeProductSubtype(+id);
  }

  // Product Subtype Relation endpoints
  @Get(':id/subtypes')
  getProductSubtypeRelations(@Param('id') id: string) {
    return this.productService.getProductSubtypeRelations(+id);
  }

  @Post(':id/subtype/:subtypeId')
  addProductSubtypeRelation(
    @Param('id') id: string,
    @Param('subtypeId') subtypeId: string,
  ) {
    return this.productService.addProductSubtypeRelation(+id, +subtypeId);
  }

  @Delete(':id/subtype/:subtypeId')
  removeProductSubtypeRelation(
    @Param('id') id: string,
    @Param('subtypeId') subtypeId: string,
  ) {
    return this.productService.removeProductSubtypeRelation(+id, +subtypeId);
  }

  @Delete(':id/subtypes')
  removeAllProductSubtypeRelations(@Param('id') id: string) {
    return this.productService.removeAllProductSubtypeRelations(+id);
  }
}
