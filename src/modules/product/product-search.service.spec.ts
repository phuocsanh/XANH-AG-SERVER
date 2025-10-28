import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { Product } from '../../entities/products.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductFactoryRegistry } from './factories/product-factory.registry';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchProductDto } from './dto/search-product.dto';
// import { FilterConditionDto } from './dto/filter-condition.dto';  // Comment out unused import

describe('ProductService - Search', () => {
  let service: ProductService;
  let repository: Repository<Product>;

  const mockProductRepository = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    })),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
  };

  const mockProductFactoryRegistry = {};
  const mockFileTrackingService = {
    batchRemoveEntityFileReferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: ProductFactoryRegistry,
          useValue: mockProductFactoryRegistry,
        },
        {
          provide: FileTrackingService,
          useValue: mockFileTrackingService,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    repository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchProductsAdvanced', () => {
    it('should build query with basic filters', async () => {
      const searchDto: SearchProductDto = {
        filters: [
          {
            field: 'productName',
            operator: 'like',
            value: 'test',
          },
        ],
      };

      await service.searchProductsAdvanced(searchDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('product');
      // Kiểm tra các điều kiện truy vấn được gọi
      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should build query with multiple filters and AND operator', async () => {
      const searchDto: SearchProductDto = {
        filters: [
          {
            field: 'productName',
            operator: 'like',
            value: 'test',
          },
          {
            field: 'productPrice',
            operator: 'gte',
            value: 100,
          },
        ],
        operator: 'AND',
      };

      await service.searchProductsAdvanced(searchDto);

      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should build query with multiple filters and OR operator', async () => {
      const searchDto: SearchProductDto = {
        filters: [
          {
            field: 'productName',
            operator: 'like',
            value: 'test',
          },
          {
            field: 'productPrice',
            operator: 'gte',
            value: 100,
          },
        ],
        operator: 'OR',
      };

      await service.searchProductsAdvanced(searchDto);

      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should handle different operators correctly', async () => {
      const operators = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike'];

      for (const operator of operators) {
        const searchDto: SearchProductDto = {
          filters: [
            {
              field: 'productName',
              operator: operator as any,
              value: 'test',
            },
          ],
        };

        await service.searchProductsAdvanced(searchDto);
      }

      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should handle IN and NOTIN operators with array values', async () => {
      const searchDto: SearchProductDto = {
        filters: [
          {
            field: 'productType',
            operator: 'in',
            value: [1, 2, 3],
          },
          {
            field: 'status',
            operator: 'notin',
            value: [BaseStatus.ARCHIVED],
          },
        ],
      };

      await service.searchProductsAdvanced(searchDto);

      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should handle ISNULL and ISNOTNULL operators', async () => {
      const searchDto: SearchProductDto = {
        filters: [
          {
            field: 'deletedAt',
            operator: 'isnull',
          },
          {
            field: 'productDescription',
            operator: 'isnotnull',
          },
        ],
      };

      await service.searchProductsAdvanced(searchDto);

      const queryBuilder = mockProductRepository.createQueryBuilder();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });
});
