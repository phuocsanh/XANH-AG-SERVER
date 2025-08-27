import { Injectable } from '@nestjs/common';
import { ProductFactory } from '../interfaces/product-factory.interface';
import { FertilizerProductFactory } from './fertilizer-product.factory';
import { PesticideProductFactory } from './pesticide-product.factory';

@Injectable()
export class ProductFactoryRegistry {
  private factories: Map<number, ProductFactory> = new Map();

  constructor(
    private readonly fertilizerFactory: FertilizerProductFactory,
    private readonly pesticideFactory: PesticideProductFactory,
  ) {
    // Đăng ký các factory với product type tương ứng
    // Type 3: Phân bón
    this.factories.set(3, this.fertilizerFactory);
    // Type 4: Thuốc trừ sâu
    this.factories.set(4, this.pesticideFactory);
  }

  getFactory(productType: number): ProductFactory | undefined {
    return this.factories.get(productType);
  }

  hasFactory(productType: number): boolean {
    return this.factories.has(productType);
  }
}
