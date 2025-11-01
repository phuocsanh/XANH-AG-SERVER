import { DataSource, IsNull } from 'typeorm';
import { Unit } from '../../entities/unit.entity';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Seeder để thêm các đơn vị tính mặc định vào cơ sở dữ liệu
 */
export class UnitSeeder {
  /**
   * Constructor
   * @param dataSource - DataSource để thực hiện các thao tác database
   */
  constructor(private dataSource: DataSource) {}

  /**
   * Thực hiện seeding các đơn vị tính mặc định
   */
  async run(): Promise<void> {
    const unitRepository = this.dataSource.getRepository(Unit);

    // Danh sách các đơn vị tính mặc định
    const defaultUnits = [
      {
        name: 'Kilogram',
        code: 'kg',
        description: 'Đơn vị khối lượng kilogram',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Gram',
        code: 'g',
        description: 'Đơn vị khối lượng gram',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Liter',
        code: 'l',
        description: 'Đơn vị thể tích lít',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Milliliter',
        code: 'ml',
        description: 'Đơn vị thể tích mililit',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Piece',
        code: 'pc',
        description: 'Đơn vị tính theo cái',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Box',
        code: 'box',
        description: 'Đơn vị tính theo hộp',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Bag',
        code: 'bag',
        description: 'Đơn vị tính theo bao',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Bottle',
        code: 'bottle',
        description: 'Đơn vị tính theo chai',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Can',
        code: 'can',
        description: 'Đơn vị tính theo lon',
        status: BaseStatus.ACTIVE,
      },
      {
        name: 'Packet',
        code: 'packet',
        description: 'Đơn vị tính theo gói',
        status: BaseStatus.ACTIVE,
      },
    ];

    // Kiểm tra xem các đơn vị đã tồn tại chưa, nếu chưa thì thêm vào
    for (const unitData of defaultUnits) {
      const existingUnit = await unitRepository.findOne({
        where: {
          code: unitData.code,
          deleted_at: IsNull(),
        },
      });

      if (!existingUnit) {
        const unit = unitRepository.create(unitData);
        await unitRepository.save(unit);
        console.log(`Đã thêm đơn vị: ${unitData.name} (${unitData.code})`);
      } else {
        console.log(`Đơn vị ${unitData.name} (${unitData.code}) đã tồn tại`);
      }
    }

    console.log('Hoàn tất seeding đơn vị tính mặc định');
  }
}
