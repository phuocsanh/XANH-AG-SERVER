import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductMixture } from '../../entities/product-mixtures.entity';
import { ProductMixtureItem } from '../../entities/product-mixture-items.entity';
import { Product } from '../../entities/products.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductMixtureDto } from './dto/create-product-mixture.dto';

@Injectable()
export class ProductMixtureService {
  private readonly logger = new Logger(ProductMixtureService.name);

  constructor(
    @InjectRepository(ProductMixture)
    private mixtureRepository: Repository<ProductMixture>,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
  ) {}

  /**
   * Tạo phiếu phối trộn sản phẩm
   * Thực hiện trừ kho nguyên liệu và cộng kho thành phẩm
   */
  async createMixture(createDto: CreateProductMixtureDto, userId: number): Promise<ProductMixture> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { productId, quantity, notes, items: overrideItems } = createDto;

      // 1. Kiểm tra sản phẩm mục tiêu
      const productD = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
        relations: ['components'],
      });

      if (!productD) {
        throw new BadRequestException('Không tìm thấy sản phẩm thành phẩm.');
      }

      // 2. Xác định danh sách nguyên liệu và số lượng cần dùng
      let ingredientsToUse: { productId: number; quantity: number }[] = [];

      if (overrideItems && overrideItems.length > 0) {
        // Sử dụng danh sách truyền lên (nếu có ghi đè)
        ingredientsToUse = overrideItems;
      } else {
        // Sử dụng công thức định mức mặc định
        if (!productD.components || productD.components.length === 0) {
          throw new BadRequestException('Sản phẩm này chưa được khai báo công thức phối trộn.');
        }
        ingredientsToUse = productD.components.map((c) => ({
          productId: c.componentProductId,
          quantity: c.quantity * quantity, // Số lượng 1 đơn vị * tổng số lượng sản xuất
        }));
      }

      // 3. Thực hiện xuất kho nguyên liệu (Stock Out)
      let totalMaterialCost = 0;
      const mixtureItems: ProductMixtureItem[] = [];

      for (const ingredient of ingredientsToUse) {
        const stockOutResult = await this.inventoryService.processStockOut(
          ingredient.productId,
          ingredient.quantity,
          'MIXTURE_OUT',
          userId,
          undefined, // referenceId sẽ cập nhật sau
          `Xuất nguyên liệu cho lệnh phối trộn sản phẩm ${productD.name}`,
          queryRunner,
        );

        totalMaterialCost += stockOutResult.totalCostValue;

        // Lưu thông tin item cho phiếu
        const mixtureItem = new ProductMixtureItem();
        mixtureItem.productId = ingredient.productId;
        mixtureItem.quantity = ingredient.quantity;
        mixtureItem.unitCost = stockOutResult.averageCostUsed;
        mixtureItem.totalCost = stockOutResult.totalCostValue;
        mixtureItems.push(mixtureItem);
      }

      // 4. Thực hiện nhập kho thành phẩm (Stock In)
      const unitCostForD = totalMaterialCost / quantity;
      
      await this.inventoryService.processStockIn(
        productId,
        quantity,
        unitCostForD,
        userId,
        undefined, // receiptItemId
        `MIXTURE_${Date.now()}`, // batch code
        undefined, // expiryDate
        queryRunner,
      );

      // 5. Lưu phiếu phối trộn
      const mixture = new ProductMixture();
      mixture.code = `MX${Date.now()}`;
      mixture.productId = productId;
      mixture.quantity = quantity;
      mixture.totalCost = totalMaterialCost;
      if (notes) mixture.notes = notes;
      mixture.created_by = userId;
      
      const savedMixture = await queryRunner.manager.save(mixture);

      // Cập nhật reference_id cho các giao dịch kho đã thực hiện
      // Lưu ý: InventoryTransaction đã được tạo trong processStockOut/In, 
      // chúng ta có thể cần truy vấn lại để cập nhật reference_id nếu cần audit chặt chẽ.
      // Ở đây ta lưu danh sách items đã dùng
      for (const item of mixtureItems) {
        item.mixtureId = savedMixture.id;
      }
      await queryRunner.manager.save(ProductMixtureItem, mixtureItems);

      await queryRunner.commitTransaction();
      return savedMixture;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Lỗi khi thực hiện phối trộn sản phẩm:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách lịch sử phối trộn
   */
  async findAllMixtures(): Promise<ProductMixture[]> {
    return this.mixtureRepository.find({
      relations: ['product', 'creator', 'items', 'items.product'],
      order: { mixtureDate: 'DESC' },
    });
  }

  /**
   * Xem chi tiết một phiếu phối trộn
   */
  async findOneMixture(id: number): Promise<ProductMixture | null> {
    return this.mixtureRepository.findOne({
      where: { id },
      relations: ['product', 'creator', 'items', 'items.product'],
    });
  }
}
