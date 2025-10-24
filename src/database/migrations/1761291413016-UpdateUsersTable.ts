import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateUsersTable1761291413016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật cột status trong bảng users để sử dụng enum mới
    await queryRunner.changeColumn(
      'users',
      'status',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trở về cấu trúc cũ nếu cần
    await queryRunner.changeColumn(
      'users',
      'status',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );
  }
}
