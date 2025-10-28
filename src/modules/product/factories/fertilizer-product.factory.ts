import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../../entities/products.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductFactory } from '../interfaces/product-factory.interface';

@Injectable()
export class FertilizerProductFactory implements ProductFactory {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    // Tạo product với các thuộc tính đặc biệt cho phân bón
    const product = new Product();
    Object.assign(product, dto);

    // Gán loại sản phẩm là phân bón (giả sử type 3 là phân bón)
    product.type = 3;

    // Xử lý các thuộc tính đặc biệt cho phân bón nếu có
    if (dto.attributes) {
      // Có thể thêm xử lý đặc biệt cho thuộc tính của phân bón ở đây
      product.attributes = dto.attributes;
    }

    return this.productRepository.save(product);
  }
}
