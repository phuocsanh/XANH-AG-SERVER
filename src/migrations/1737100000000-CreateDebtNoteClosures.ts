import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateDebtNoteClosures1737100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('debt_note_closures');
    if (exists) return;

    await queryRunner.createTable(
      new Table({
        name: 'debt_note_closures',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'debt_note_id', type: 'int', isNullable: false },
          { name: 'customer_id', type: 'int', isNullable: false },
          { name: 'season_id', type: 'int', isNullable: true },
          { name: 'closed_by', type: 'int', isNullable: true },
          { name: 'closed_at', type: 'timestamp', isNullable: false },
          {
            name: 'status',
            type: 'enum',
            enum: ['closed', 'reversed'],
            enumName: 'debt_note_closures_status_enum',
            default: "'closed'",
          },
          { name: 'reversed_by', type: 'int', isNullable: true },
          { name: 'reversed_at', type: 'timestamp', isNullable: true },
          { name: 'reverse_reason', type: 'text', isNullable: true },
          { name: 'before_snapshot', type: 'jsonb', isNullable: false },
          { name: 'after_snapshot', type: 'jsonb', isNullable: false },
          { name: 'reward_tracking_before', type: 'jsonb', isNullable: true },
          { name: 'reward_tracking_after', type: 'jsonb', isNullable: true },
          { name: 'reward_history_ids', type: 'jsonb', isNullable: true },
          { name: 'inventory_transaction_ids', type: 'jsonb', isNullable: true },
          { name: 'gift_cost_ids', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'debt_note_closures',
      new TableIndex({
        name: 'IDX_debt_note_closures_debt_note_status',
        columnNames: ['debt_note_id', 'status'],
      }),
    );

    await queryRunner.createForeignKeys('debt_note_closures', [
      new TableForeignKey({
        columnNames: ['debt_note_id'],
        referencedTableName: 'debt_notes',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['season_id'],
        referencedTableName: 'seasons',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['closed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['reversed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('debt_note_closures');
    if (!exists) return;

    await queryRunner.dropTable('debt_note_closures', true);
    await queryRunner.query('DROP TYPE IF EXISTS "debt_note_closures_status_enum"');
  }
}
