import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class UpdateUserProfilesTable1761291437655
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm cột status vào bảng user_profiles
    await queryRunner.addColumn(
      'user_profiles',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );

    // Tạo index cho cột status
    await queryRunner.createIndex(
      'user_profiles',
      new TableIndex({
        name: 'IDX_USER_PROFILES_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa index
    await queryRunner.dropIndex('user_profiles', 'IDX_USER_PROFILES_STATUS');

    // Xóa cột status
    await queryRunner.dropColumn('user_profiles', 'status');
  }
}
