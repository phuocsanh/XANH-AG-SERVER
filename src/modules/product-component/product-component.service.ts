import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { ProductComponent } from '../../entities/product-components.entity';
import { CreateProductComponentDto } from '../product/dto/create-product-component.dto';

@Injectable()
export class ProductComponentService {
  constructor(
    @InjectRepository(ProductComponent)
    private componentRepository: Repository<ProductComponent>,
  ) {}

  /**
   * Lưu tất cả thành phần cho một sản phẩm (Dùng khi tạo/cập nhật sản phẩm)
   */
  async saveAllForProduct(
    productId: number,
    components: CreateProductComponentDto[],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner ? queryRunner.manager.getRepository(ProductComponent) : this.componentRepository;

    // Xóa các thành phần cũ (nếu có)
    await repo.delete({ productId });

    // Thêm các thành phần mới
    if (components && components.length > 0) {
      const entities = components.map((c) => {
        const entity = new ProductComponent();
        entity.productId = productId;
        entity.componentProductId = c.componentProductId;
        entity.quantity = c.quantity;
        if (c.unitId) entity.unitId = c.unitId;
        return entity;
      });
      await repo.save(entities);
    }
  }

  /**
   * Lấy danh sách thành phần của một sản phẩm
   */
  async findByProductId(productId: number): Promise<ProductComponent[]> {
    return this.componentRepository.find({
      where: { productId },
      relations: ['componentProduct', 'unit'],
    });
  }
}
