import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRiceFarmingTables1733150000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng cost_items
    await queryRunner.createTable(
      new Table({
        name: 'cost_items',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'rice_crop_id', type: 'int', isNullable: false },
          { name: 'category', type: 'varchar', length: '50', isNullable: false },
          { name: 'item_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'quantity', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'unit', type: 'varchar', length: '50', isNullable: true },
          { name: 'unit_price', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'total_cost', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'purchase_date', type: 'date', isNullable: true },
          { name: 'invoice_id', type: 'int', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'cost_items',
      new TableForeignKey({
        columnNames: ['rice_crop_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rice_crops',
        onDelete: 'CASCADE',
        name: 'fk_cost_items_rice_crop',
      }),
    );

    // 2. Tạo bảng harvest_records
    await queryRunner.createTable(
      new Table({
        name: 'harvest_records',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'rice_crop_id', type: 'int', isNullable: false },
          { name: 'harvest_date', type: 'date', isNullable: false },
          { name: 'yield_amount', type: 'decimal', precision: 10, scale: 2, isNullable: false },
          { name: 'moisture_content', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'quality_grade', type: 'varchar', length: '10', isNullable: false },
          { name: 'selling_price_per_unit', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'total_revenue', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'buyer', type: 'varchar', length: '255', isNullable: true },
          { name: 'payment_status', type: 'varchar', length: '20', default: "'pending'", isNullable: false },
          { name: 'payment_date', type: 'date', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'harvest_records',
      new TableForeignKey({
        columnNames: ['rice_crop_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rice_crops',
        onDelete: 'CASCADE',
        name: 'fk_harvest_records_rice_crop',
      }),
    );

    // 3. Tạo bảng farming_schedules
    await queryRunner.createTable(
      new Table({
        name: 'farming_schedules',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'rice_crop_id', type: 'int', isNullable: false },
          { name: 'activity_type', type: 'varchar', length: '50', isNullable: false },
          { name: 'activity_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'scheduled_date', type: 'date', isNullable: false },
          { name: 'scheduled_time', type: 'varchar', length: '100', isNullable: true },
          { name: 'product_ids', type: 'jsonb', isNullable: true },
          { name: 'estimated_quantity', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'estimated_cost', type: 'decimal', precision: 15, scale: 2, isNullable: true },
          { name: 'instructions', type: 'text', isNullable: true },
          { name: 'weather_dependent', type: 'boolean', default: false },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'", isNullable: false },
          { name: 'reminder_enabled', type: 'boolean', default: false },
          { name: 'reminder_time', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'farming_schedules',
      new TableForeignKey({
        columnNames: ['rice_crop_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rice_crops',
        onDelete: 'CASCADE',
        name: 'fk_farming_schedules_rice_crop',
      }),
    );

    // 4. Tạo bảng application_records
    await queryRunner.createTable(
      new Table({
        name: 'application_records',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'rice_crop_id', type: 'int', isNullable: false },
          { name: 'farming_schedule_id', type: 'int', isNullable: true },
          { name: 'activity_type', type: 'varchar', length: '50', isNullable: false },
          { name: 'application_date', type: 'date', isNullable: false },
          { name: 'application_time', type: 'varchar', length: '100', isNullable: true },
          { name: 'products', type: 'jsonb', isNullable: false },
          { name: 'total_cost', type: 'decimal', precision: 15, scale: 2, isNullable: false },
          { name: 'weather_condition', type: 'varchar', length: '255', isNullable: true },
          { name: 'operator', type: 'varchar', length: '255', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'effectiveness', type: 'int', isNullable: true },
          { name: 'side_effects', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'application_records',
      new TableForeignKey({
        columnNames: ['rice_crop_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rice_crops',
        onDelete: 'CASCADE',
        name: 'fk_application_records_rice_crop',
      }),
    );

    // 5. Tạo bảng growth_trackings
    await queryRunner.createTable(
      new Table({
        name: 'growth_trackings',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'rice_crop_id', type: 'int', isNullable: false },
          { name: 'tracking_date', type: 'date', isNullable: false },
          { name: 'growth_stage', type: 'varchar', length: '50', isNullable: false },
          { name: 'plant_height', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'tiller_count', type: 'int', isNullable: true },
          { name: 'leaf_color', type: 'varchar', length: '100', isNullable: true },
          { name: 'health_status', type: 'varchar', length: '50', isNullable: false },
          { name: 'pest_disease_detected', type: 'varchar', length: '255', isNullable: true },
          { name: 'severity', type: 'varchar', length: '20', isNullable: true },
          { name: 'photo_urls', type: 'jsonb', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'growth_trackings',
      new TableForeignKey({
        columnNames: ['rice_crop_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rice_crops',
        onDelete: 'CASCADE',
        name: 'fk_growth_trackings_rice_crop',
      }),
    );

    // Tạo indexes
    await queryRunner.query(`
      CREATE INDEX idx_cost_items_rice_crop_id ON cost_items(rice_crop_id);
      CREATE INDEX idx_cost_items_category ON cost_items(category);
      
      CREATE INDEX idx_harvest_records_rice_crop_id ON harvest_records(rice_crop_id);
      
      CREATE INDEX idx_farming_schedules_rice_crop_id ON farming_schedules(rice_crop_id);
      CREATE INDEX idx_farming_schedules_status ON farming_schedules(status);
      CREATE INDEX idx_farming_schedules_scheduled_date ON farming_schedules(scheduled_date);
      
      CREATE INDEX idx_application_records_rice_crop_id ON application_records(rice_crop_id);
      CREATE INDEX idx_application_records_application_date ON application_records(application_date);
      
      CREATE INDEX idx_growth_trackings_rice_crop_id ON growth_trackings(rice_crop_id);
      CREATE INDEX idx_growth_trackings_tracking_date ON growth_trackings(tracking_date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_growth_trackings_tracking_date;
      DROP INDEX IF EXISTS idx_growth_trackings_rice_crop_id;
      DROP INDEX IF EXISTS idx_application_records_application_date;
      DROP INDEX IF EXISTS idx_application_records_rice_crop_id;
      DROP INDEX IF EXISTS idx_farming_schedules_scheduled_date;
      DROP INDEX IF EXISTS idx_farming_schedules_status;
      DROP INDEX IF EXISTS idx_farming_schedules_rice_crop_id;
      DROP INDEX IF EXISTS idx_harvest_records_rice_crop_id;
      DROP INDEX IF EXISTS idx_cost_items_category;
      DROP INDEX IF EXISTS idx_cost_items_rice_crop_id;
    `);

    // Xóa foreign keys và tables
    await queryRunner.dropForeignKey('growth_trackings', 'fk_growth_trackings_rice_crop');
    await queryRunner.dropTable('growth_trackings');

    await queryRunner.dropForeignKey('application_records', 'fk_application_records_rice_crop');
    await queryRunner.dropTable('application_records');

    await queryRunner.dropForeignKey('farming_schedules', 'fk_farming_schedules_rice_crop');
    await queryRunner.dropTable('farming_schedules');

    await queryRunner.dropForeignKey('harvest_records', 'fk_harvest_records_rice_crop');
    await queryRunner.dropTable('harvest_records');

    await queryRunner.dropForeignKey('cost_items', 'fk_cost_items_rice_crop');
    await queryRunner.dropTable('cost_items');
  }
}
