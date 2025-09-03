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

/**
 * Controller xử lý các request liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, loại sản phẩm, loại phụ sản phẩm và mối quan hệ giữa chúng
 */
@Controller('products')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductController {
  /**
   * Constructor injection ProductService
   * @param productService - Service xử lý logic nghiệp vụ sản phẩm
   */
  constructor(private readonly productService: ProductService) {}

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  /**
   * Endpoint test để kiểm tra chuyển đổi ngày tháng
   * @param testData - Dữ liệu test chứa ngày tháng
   * @returns Thông tin về việc chuyển đổi ngày tháng
   */
  @Post('test-date')
  testDate(@Body() testData: any) {
    console.log('Test Date DTO:', testData);
    console.log('myDate type:', typeof testData.myDate);
    console.log('myDate instanceof Date:', testData.myDate instanceof Date);
    return { success: true, data: testData };
  }

  /**
   * Lấy danh sách tất cả sản phẩm
   * @returns Danh sách sản phẩm
   */
  @Get()
  findAll() {
    return this.productService.findAll();
  }

  /**
   * Tìm kiếm sản phẩm theo từ khóa
   * @param query - Từ khóa tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  @Get('search')
  search(@Query('q') query: string) {
    return this.productService.searchProducts(query);
  }

  // Product Type endpoints
  /**
   * Lấy danh sách tất cả loại sản phẩm
   * @returns Danh sách loại sản phẩm
   */
  @Get('type')
  findAllProductTypes() {
    return this.productService.findAllProductTypes();
  }

  /**
   * Lấy thông tin chi tiết một loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm
   */
  @Get('type/:id')
  findOneProductType(@Param('id') id: string) {
    return this.productService.findOneProductType(+id);
  }

  /**
   * Tìm sản phẩm theo loại sản phẩm
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  @Get('type/:productType/products')
  findByType(@Param('productType') productType: number) {
    return this.productService.findByType(productType);
  }

  /**
   * Lấy thông tin chi tiết một sản phẩm theo ID
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  /**
   * Cập nhật thông tin sản phẩm
   * @param id - ID của sản phẩm cần cập nhật
   * @param updateProductDto - Dữ liệu cập nhật sản phẩm
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }

  /**
   * Xóa sản phẩm theo ID
   * @param id - ID của sản phẩm cần xóa
   * @returns Kết quả xóa sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }

  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  @Post('type')
  createProductType(@Body() createProductTypeDto: any) {
    return this.productService.createProductType(createProductTypeDto);
  }

  /**
   * Cập nhật thông tin loại sản phẩm
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  @Patch('type/:id')
  updateProductType(
    @Param('id') id: string,
    @Body() updateProductTypeDto: any,
  ) {
    return this.productService.updateProductType(+id, updateProductTypeDto);
  }

  /**
   * Xóa loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần xóa
   * @returns Kết quả xóa loại sản phẩm
   */
  @Delete('type/:id')
  removeProductType(@Param('id') id: string) {
    return this.productService.removeProductType(+id);
  }

  // Product Subtype endpoints
  /**
   * Lấy danh sách tất cả loại phụ sản phẩm
   * @returns Danh sách loại phụ sản phẩm
   */
  @Get('subtype')
  findAllProductSubtypes() {
    return this.productService.findAllProductSubtypes();
  }

  /**
   * Lấy thông tin chi tiết một loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @returns Thông tin loại phụ sản phẩm
   */
  @Get('subtype/:id')
  findOneProductSubtype(@Param('id') id: string) {
    return this.productService.findOneProductSubtype(+id);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm
   * @param id - ID của loại sản phẩm
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  @Get('type/:id/subtypes')
  findProductSubtypesByType(@Param('id') id: string) {
    return this.productService.findProductSubtypesByType(+id);
  }

  /**
   * Tạo loại phụ sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm mới
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  @Post('subtype')
  createProductSubtype(@Body() createProductSubtypeDto: any) {
    return this.productService.createProductSubtype(createProductSubtypeDto);
  }

  /**
   * Cập nhật thông tin loại phụ sản phẩm
   * @param id - ID của loại phụ sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã cập nhật
   */
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

  /**
   * Xóa loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần xóa
   * @returns Kết quả xóa loại phụ sản phẩm
   */
  @Delete('subtype/:id')
  removeProductSubtype(@Param('id') id: string) {
    return this.productService.removeProductSubtype(+id);
  }

  // Product Subtype Relation endpoints
  /**
   * Lấy danh sách mối quan hệ loại phụ sản phẩm của một sản phẩm
   * @param id - ID của sản phẩm
   * @returns Danh sách mối quan hệ loại phụ sản phẩm
   */
  @Get(':id/subtypes')
  getProductSubtypeRelations(@Param('id') id: string) {
    return this.productService.getProductSubtypeRelations(+id);
  }

  /**
   * Thêm mối quan hệ loại phụ sản phẩm cho sản phẩm
   * @param id - ID của sản phẩm
   * @param subtypeId - ID của loại phụ sản phẩm
   * @returns Kết quả thêm mối quan hệ
   */
  @Post(':id/subtype/:subtypeId')
  addProductSubtypeRelation(
    @Param('id') id: string,
    @Param('subtypeId') subtypeId: string,
  ) {
    return this.productService.addProductSubtypeRelation(+id, +subtypeId);
  }

  /**
   * Xóa mối quan hệ loại phụ sản phẩm của sản phẩm
   * @param id - ID của sản phẩm
   * @param subtypeId - ID của loại phụ sản phẩm
   * @returns Kết quả xóa mối quan hệ
   */
  @Delete(':id/subtype/:subtypeId')
  removeProductSubtypeRelation(
    @Param('id') id: string,
    @Param('subtypeId') subtypeId: string,
  ) {
    return this.productService.removeProductSubtypeRelation(+id, +subtypeId);
  }

  /**
   * Xóa tất cả mối quan hệ loại phụ sản phẩm của sản phẩm
   * @param id - ID của sản phẩm
   * @returns Kết quả xóa tất cả mối quan hệ
   */
  @Delete(':id/subtypes')
  removeAllProductSubtypeRelations(@Param('id') id: string) {
    return this.productService.removeAllProductSubtypeRelations(+id);
  }
}
