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
        unitName: 'Kilogram',
        unitCode: 'kg',
        description: 'Đơn vị khối lượng kilogram',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Gram',
        unitCode: 'g',
        description: 'Đơn vị khối lượng gram',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Liter',
        unitCode: 'l',
        description: 'Đơn vị thể tích lít',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Milliliter',
        unitCode: 'ml',
        description: 'Đơn vị thể tích mililit',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Piece',
        unitCode: 'pc',
        description: 'Đơn vị tính theo cái',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Box',
        unitCode: 'box',
        description: 'Đơn vị tính theo hộp',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Bag',
        unitCode: 'bag',
        description: 'Đơn vị tính theo bao',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Bottle',
        unitCode: 'bottle',
        description: 'Đơn vị tính theo chai',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Can',
        unitCode: 'can',
        description: 'Đơn vị tính theo lon',
        status: BaseStatus.ACTIVE,
      },
      {
        unitName: 'Packet',
        unitCode: 'packet',
        description: 'Đơn vị tính theo gói',
        status: BaseStatus.ACTIVE,
      },
    ];

    // Kiểm tra xem các đơn vị đã tồn tại chưa, nếu chưa thì thêm vào
    for (const unitData of defaultUnits) {
      const existingUnit = await unitRepository.findOne({
        where: {
          unitCode: unitData.unitCode,
          deletedAt: IsNull(),
        },
      });

      if (!existingUnit) {
        const unit = unitRepository.create(unitData);
        await unitRepository.save(unit);
        console.log(
          `Đã thêm đơn vị: ${unitData.unitName} (${unitData.unitCode})`,
        );
      } else {
        console.log(
          `Đơn vị ${unitData.unitName} (${unitData.unitCode}) đã tồn tại`,
        );
      }
    }

    console.log('Hoàn tất seeding đơn vị tính mặc định');
  }
}
