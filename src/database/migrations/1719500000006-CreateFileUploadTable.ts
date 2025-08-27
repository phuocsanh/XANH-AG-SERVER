import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFileUploadTable1719500000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'file_upload',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'public_id',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'original_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'file_path',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'file_size',
            type: 'bigint',
          },
          {
            name: 'file_type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'file_extension',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'upload_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'uploader_id',
            type: 'int',
          },
          {
            name: 'is_orphaned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mark_for_deletion',
            type: 'boolean',
            default: false,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('file_upload');
  }
}
