import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductFactory } from '../interfaces/product-factory.interface';

@Injectable()
export class PesticideProductFactory implements ProductFactory {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    // Tạo product với các thuộc tính đặc biệt cho thuốc trừ sâu
    const product = new Product();
    Object.assign(product, dto);

    // Gán loại sản phẩm là thuốc trừ sâu (giả sử type 4 là thuốc trừ sâu)
    product.productType = 4;

    // Xử lý các thuộc tính đặc biệt cho thuốc trừ sâu nếu có
    if (dto.productAttributes) {
      // Có thể thêm xử lý đặc biệt cho thuộc tính của thuốc trừ sâu ở đây
      product.productAttributes = dto.productAttributes;
    }

    return this.productRepository.save(product);
  }
}
