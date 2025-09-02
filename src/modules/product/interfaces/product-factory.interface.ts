import { Product } from '../../../entities/products.entity';
import { CreateProductDto } from '../dto/create-product.dto';

export interface ProductFactory {
  createProduct(dto: CreateProductDto): Promise<Product>;
}
