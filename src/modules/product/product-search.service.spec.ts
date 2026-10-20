import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseStatus } from '../../entities/base-status.enum';
import { Product } from '../../entities/products.entity';
import { PromotionCampaignProduct } from '../../entities/promotion-campaign-product.entity';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { OperatingCostService } from '../operating-cost/operating-cost.service';
import { ProductComponentService } from '../product-component/product-component.service';
import { ProductUnitConversionService } from '../product-unit-conversion/product-unit-conversion.service';
import { ProductService } from './product.service';
import { SearchProductDto } from './dto/search-product.dto';

describe('ProductService - Search', () => {
  let service: ProductService;
  let repository: Repository<Product>;

  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const productRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
        {
          provide: getRepositoryToken(PromotionCampaignProduct),
          useValue: {},
        },
        { provide: FileTrackingService, useValue: {} },
        { provide: OperatingCostService, useValue: {} },
        { provide: ProductUnitConversionService, useValue: {} },
        { provide: ProductComponentService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    repository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('applies pagination, joins, default active status, and soft-delete filter', async () => {
    await service.searchProductsAdvanced({ page: 2, limit: 5 });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('product');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(4);
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'product.status = :activeStatus',
      { activeStatus: BaseStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'product.deleted_at IS NULL',
    );
    expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
  });

  it('applies the DTO name as a fuzzy filter', async () => {
    const searchDto: SearchProductDto = { name: 'lúa 3' };

    await service.searchProductsAdvanced(searchDto);

    expect(queryBuilder.setParameter).toHaveBeenCalledWith(
      'filter_name',
      '%lúa 3%',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('product.name'),
    );
  });

  it('includes the web display name in global product search', async () => {
    await service.searchProductsAdvanced({ keyword: 'GENOL 1.2SL' });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('product.web_name'),
    );
  });

  it('applies product ids as an IN filter and product type separately', async () => {
    const searchDto: SearchProductDto = { ids: [1, 2], type_id: 4 };

    await service.searchProductsAdvanced(searchDto);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'product.id IN (:...ids)',
      { ids: [1, 2] },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'product.type = :typeId',
      { typeId: 4 },
    );
  });

  it('filters out zero-stock products only when requested', async () => {
    await service.searchProductsAdvanced({ in_stock_only: true });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'COALESCE(product.quantity, 0) > 0',
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'product.in_stock_only = :in_stock_only',
      expect.anything(),
    );

    jest.clearAllMocks();
    await service.searchProductsAdvanced({});

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'COALESCE(product.quantity, 0) > 0',
    );
  });

  it('applies status as an exact enum filter without adding the default status', async () => {
    await service.searchProductsAdvanced({ status: BaseStatus.ARCHIVED });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'product.status::text = :status',
      { status: BaseStatus.ARCHIVED },
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'product.status = :activeStatus',
      { activeStatus: BaseStatus.ACTIVE },
    );
  });
});
