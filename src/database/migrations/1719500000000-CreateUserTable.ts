import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserTable1719500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'user_id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_account',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'user_password',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'user_salt',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'user_login_time',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'user_logout_time',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'user_login_ip',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'user_updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'is_two_factor_enabled',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
