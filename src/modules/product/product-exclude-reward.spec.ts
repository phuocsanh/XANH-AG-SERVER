import { validate } from 'class-validator';
import { Product } from '../../entities/products.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

/** Tạo ProductService với repository giả để kiểm tra lưu cờ không tính tích lũy. */
function createFixture() {
  const currentProduct = Object.assign(new Product(), {
    id: 17,
    name: 'Phân thử nghiệm',
    trade_name: 'Phân thử nghiệm',
    costing_method: 'fixed',
    cost_price: '100',
    credit_price: '120',
  });
  const repository = {
    save: jest.fn(async (product: Product) =>
      Object.assign(product, { id: 17 }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const service = Object.assign(Object.create(ProductService.prototype), {
    productRepository: repository,
    checkDuplicateName: jest.fn().mockResolvedValue(undefined),
    validateCostingConfig: jest.fn(),
    markImagesAsUsed: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(currentProduct),
    handleImageUpdate: jest.fn().mockResolvedValue(undefined),
  }) as ProductService;

  return { service, repository, currentProduct };
}

describe('ProductService lưu cờ không tính quà tích lũy', () => {
  it.each([true, false])(
    'DTO chấp nhận giá trị boolean %s',
    async (exclude) => {
      const dto = Object.assign(new CreateProductDto(), {
        exclude_from_reward: exclude,
      });

      const errors = await validate(dto, { skipMissingProperties: true });

      expect(
        errors.some((error) => error.property === 'exclude_from_reward'),
      ).toBe(false);
    },
  );

  it('DTO từ chối chuỗi thay cho boolean', async () => {
    const dto = Object.assign(new CreateProductDto(), {
      exclude_from_reward: 'true',
    });

    const errors = await validate(dto, { skipMissingProperties: true });

    expect(
      errors.find((error) => error.property === 'exclude_from_reward')
        ?.constraints,
    ).toHaveProperty('isBoolean');
  });

  it('giữ cờ khi tạo sản phẩm', async () => {
    const fixture = createFixture();
    const dto = {
      name: 'Phân thử nghiệm',
      trade_name: 'Phân thử nghiệm',
      exclude_from_reward: true,
    } as CreateProductDto;

    await fixture.service.create(dto);

    expect(fixture.repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ exclude_from_reward: true }),
    );
  });

  it('giữ cờ khi tạo sản phẩm qua nhánh giá bán đề xuất', async () => {
    const fixture = createFixture();
    const dto = Object.assign(new CreateProductDto(), {
      name: 'Phân thử nghiệm',
      trade_name: 'Phân thử nghiệm',
      suggested_price: '150',
      exclude_from_reward: true,
    });

    await fixture.service.createWithSuggestedPrice(dto);

    expect(fixture.repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        exclude_from_reward: true,
        suggested_price: '150',
        price: '150',
      }),
    );
  });

  it.each([true, false])(
    'lưu trạng thái %s khi cập nhật sản phẩm',
    async (exclude) => {
      const fixture = createFixture();
      const dto: UpdateProductDto = { exclude_from_reward: exclude };

      await fixture.service.update(17, dto);

      expect(fixture.repository.update).toHaveBeenCalledWith(
        17,
        expect.objectContaining({ exclude_from_reward: exclude }),
      );
    },
  );

  it('controller giữ cờ khi đi qua bộ lọc payload lúc tạo và cập nhật', async () => {
    const service = {
      create: jest.fn(async (dto: CreateProductDto) => dto as Product),
      createWithSuggestedPrice: jest.fn(
        async (dto: CreateProductDto) => dto as Product,
      ),
      update: jest.fn(async (_id: number, dto: UpdateProductDto) =>
        dto as Product,
      ),
    };
    const controller = new ProductController(service as unknown as ProductService);

    await controller.create({
      name: 'Phân thử nghiệm',
      trade_name: 'Phân thử nghiệm',
      exclude_from_reward: true,
    } as CreateProductDto);
    await controller.createWithSuggestedPrice({
      name: 'Phân giá đề xuất',
      trade_name: 'Phân giá đề xuất',
      exclude_from_reward: true,
    } as CreateProductDto);
    await controller.update(17, { exclude_from_reward: false });

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ exclude_from_reward: true }),
    );
    expect(service.createWithSuggestedPrice).toHaveBeenCalledWith(
      expect.objectContaining({ exclude_from_reward: true }),
    );
    expect(service.update).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ exclude_from_reward: false }),
    );
  });
});
