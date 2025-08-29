import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateUserProfileTable1719500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_profiles',
        columns: [
          {
            name: 'user_id',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'user_account',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'user_nickname',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'user_avatar',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_state',
            type: 'int',
          },
          {
            name: 'user_mobile',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'user_gender',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'user_birthday',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'user_email',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'user_is_authentication',
            type: 'int',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Tạo foreign key constraint
    await queryRunner.createForeignKey(
      'user_profiles',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['user_id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraint trước
    const table = await queryRunner.getTable('user_profiles');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1,
    );
    await queryRunner.dropForeignKey('user_profiles', foreignKey);

    // Xóa bảng
    await queryRunner.dropTable('user_profiles');
  }
}
