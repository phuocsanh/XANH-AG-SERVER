import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductMixture } from '../../entities/product-mixtures.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductMixtureDto } from './dto/create-product-mixture.dto';
import { ProductMixtureService } from './product-mixture.service';

describe('ProductMixtureService transaction safety', () => {
  const createContext = () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        name: 'Thành phẩm phối trộn',
        components: [],
      }),
      save: jest.fn(),
    };
    let queryRunner: any;
    queryRunner = {
      manager,
      isTransactionActive: false,
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockImplementation(async () => {
        queryRunner.isTransactionActive = true;
      }),
      commitTransaction: jest.fn().mockImplementation(async () => {
        queryRunner.isTransactionActive = false;
      }),
      rollbackTransaction: jest.fn().mockImplementation(async () => {
        queryRunner.isTransactionActive = false;
      }),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const inventoryService = {
      processStockOut: jest.fn().mockResolvedValue({
        totalCostValue: 200,
        averageCostUsed: 50,
      }),
      processStockIn: jest.fn().mockResolvedValue({}),
    };
    const mixtureRepository = { find: jest.fn(), findOne: jest.fn() };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const service = new ProductMixtureService(
      mixtureRepository as unknown as Repository<ProductMixture>,
      inventoryService as unknown as InventoryService,
      dataSource as unknown as DataSource,
    );
    const dto: CreateProductMixtureDto = {
      productId: 20,
      quantity: 2,
      items: [{ productId: 7, quantity: 4 }],
    };

    return { service, dto, queryRunner, manager, inventoryService };
  };

  it('rolls back consumed ingredients when finished-goods stock-in fails', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    const stockInError = new Error('stock-in failed');
    inventoryService.processStockIn.mockRejectedValue(stockInError);

    await expect(service.createMixture(dto, 3)).rejects.toBe(stockInError);

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockIn).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockOut.mock.calls[0]?.[6]).toBe(
      queryRunner,
    );
    expect(inventoryService.processStockIn.mock.calls[0]?.[7]).toBe(
      queryRunner,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back both stock effects when mixture record persistence fails', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    const saveError = new Error('mixture persistence failed');
    manager.save.mockRejectedValue(saveError);

    await expect(service.createMixture(dto, 3)).rejects.toBe(saveError);

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockIn).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockOut.mock.calls[0]?.[6]).toBe(
      queryRunner,
    );
    expect(inventoryService.processStockIn.mock.calls[0]?.[7]).toBe(
      queryRunner,
    );
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back stock and the mixture header when saving mixture items fails', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    const itemsError = new Error('mixture items persistence failed');
    manager.save
      .mockResolvedValueOnce({ id: 40 })
      .mockRejectedValueOnce(itemsError);

    await expect(service.createMixture(dto, 3)).rejects.toBe(itemsError);

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockIn).toHaveBeenCalledTimes(1);
    expect(inventoryService.processStockOut.mock.calls[0]?.[6]).toBe(
      queryRunner,
    );
    expect(inventoryService.processStockIn.mock.calls[0]?.[7]).toBe(
      queryRunner,
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it.each(['connect', 'startTransaction'] as const)(
    'releases the query runner when %s fails before the mixture starts',
    async (stage) => {
      const { service, dto, queryRunner, inventoryService } = createContext();
      const error = new Error(`${stage} failed`);
      queryRunner[stage].mockRejectedValueOnce(error);

      await expect(service.createMixture(dto, 3)).rejects.toBe(error);

      expect(inventoryService.processStockOut).not.toHaveBeenCalled();
      expect(inventoryService.processStockIn).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    },
  );

  it('does not consume ingredients when the finished product does not exist', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    manager.findOne.mockResolvedValueOnce(null);

    await expect(service.createMixture(dto, 3)).rejects.toThrow(
      'Không tìm thấy sản phẩm thành phẩm.',
    );

    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(inventoryService.processStockIn).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('does not change stock when no recipe or ingredient override is provided', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    dto.items = [];
    manager.findOne.mockResolvedValueOnce({
      id: 20,
      name: 'Thành phẩm phối trộn',
      components: [],
    });

    await expect(service.createMixture(dto, 3)).rejects.toThrow(
      'Sản phẩm này chưa được khai báo công thức phối trộn.',
    );

    expect(inventoryService.processStockOut).not.toHaveBeenCalled();
    expect(inventoryService.processStockIn).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('exports the exact source ingredient quantity on every mixture run', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    dto.items = [{ productId: 7, quantity: 250 }];
    manager.save.mockResolvedValue({ id: 40 });

    for (let run = 0; run < 4; run += 1) {
      await service.createMixture(dto, 3);
    }

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(4);
    for (let run = 1; run <= 4; run += 1) {
      expect(inventoryService.processStockOut).toHaveBeenNthCalledWith(
        run,
        7,
        250,
        'MIXTURE_OUT',
        3,
        undefined,
        'Xuất nguyên liệu cho lệnh phối trộn sản phẩm Thành phẩm phối trộn',
        queryRunner,
      );
    }
    expect(inventoryService.processStockIn).toHaveBeenCalledTimes(4);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(4);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('scales the recipe quantity before exporting source stock for each run', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    dto.items = [];
    manager.findOne.mockResolvedValue({
      id: 20,
      name: 'Thành phẩm phối trộn',
      components: [{ componentProductId: 7, quantity: 125 }],
    });
    manager.save.mockResolvedValue({ id: 40 });

    for (let run = 1; run <= 4; run += 1) {
      await service.createMixture(dto, 3);

      expect(inventoryService.processStockOut).toHaveBeenNthCalledWith(
        run,
        7,
        250,
        'MIXTURE_OUT',
        3,
        undefined,
        'Xuất nguyên liệu cho lệnh phối trộn sản phẩm Thành phẩm phối trộn',
        queryRunner,
      );
    }

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(4);
    expect(inventoryService.processStockIn).toHaveBeenCalledTimes(4);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(4);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('does not transfer source ingredient tax stock into the finished mixture', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    dto.items = [{ productId: 7, quantity: 250 }];
    inventoryService.processStockOut.mockResolvedValue({
      totalCostValue: 200,
      averageCostUsed: 50,
      taxableQuantity: 250,
    });
    manager.save.mockResolvedValue({ id: 40 });

    await service.createMixture(dto, 3);

    expect(inventoryService.processStockOut).toHaveBeenCalledWith(
      7,
      250,
      'MIXTURE_OUT',
      3,
      undefined,
      'Xuất nguyên liệu cho lệnh phối trộn sản phẩm Thành phẩm phối trộn',
      queryRunner,
    );
    expect(inventoryService.processStockIn).toHaveBeenCalledWith(
      20,
      2,
      100,
      3,
      undefined,
      expect.stringMatching(/^MIXTURE_/),
      undefined,
      queryRunner,
    );
    expect(inventoryService.processStockIn.mock.calls[0]).toHaveLength(8);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('rolls back earlier ingredient stock-outs when a later ingredient is unavailable', async () => {
    const { service, dto, queryRunner, manager, inventoryService } =
      createContext();
    dto.items = [
      { productId: 7, quantity: 250 },
      { productId: 8, quantity: 100 },
    ];
    const stockOutError = new Error('ingredient 8 has insufficient stock');
    inventoryService.processStockOut
      .mockResolvedValueOnce({ totalCostValue: 200, averageCostUsed: 50 })
      .mockRejectedValueOnce(stockOutError);

    await expect(service.createMixture(dto, 3)).rejects.toBe(stockOutError);

    expect(inventoryService.processStockOut).toHaveBeenCalledTimes(2);
    expect(inventoryService.processStockOut).toHaveBeenNthCalledWith(
      1,
      7,
      250,
      'MIXTURE_OUT',
      3,
      undefined,
      'Xuất nguyên liệu cho lệnh phối trộn sản phẩm Thành phẩm phối trộn',
      queryRunner,
    );
    expect(inventoryService.processStockOut).toHaveBeenNthCalledWith(
      2,
      8,
      100,
      'MIXTURE_OUT',
      3,
      undefined,
      'Xuất nguyên liệu cho lệnh phối trộn sản phẩm Thành phẩm phối trộn',
      queryRunner,
    );
    expect(inventoryService.processStockIn).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});

describe('CreateProductMixtureDto quantity validation', () => {
  it.each([0, -0.01])('rejects finished quantity %s below the minimum', async (quantity) => {
    const dto = plainToInstance(CreateProductMixtureDto, {
      productId: 20,
      quantity,
      items: [{ productId: 7, quantity: 1 }],
    });

    const errors = await validate(dto);
    const quantityError = errors.find((error) => error.property === 'quantity');
    expect(quantityError?.constraints).toHaveProperty('min');
  });

  it('rejects ingredient quantity below the minimum', async () => {
    const dto = plainToInstance(CreateProductMixtureDto, {
      productId: 20,
      quantity: 1,
      items: [{ productId: 7, quantity: 0.00001 }],
    });

    const errors = await validate(dto);
    const nestedItemErrors = errors.find((error) => error.property === 'items')
      ?.children?.flatMap((item) => item.children ?? []) ?? [];
    const ingredientQuantityError = nestedItemErrors.find(
      (error) => error.property === 'quantity',
    );
    expect(ingredientQuantityError?.constraints).toHaveProperty('min');
  });

  it('accepts exact minimum finished and ingredient quantities', async () => {
    const dto = plainToInstance(CreateProductMixtureDto, {
      productId: 20,
      quantity: 0.01,
      items: [{ productId: 7, quantity: 0.0001 }],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
