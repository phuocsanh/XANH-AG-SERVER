import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng lưu vết hoàn tác phiếu thu.
 * Phiếu thu gốc bị xóa cứng khi hoàn tác nên bảng này giữ snapshot để đối soát.
 */
export class AddPaymentRollbackHistory1786394000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "payment_rollback_history" (
      "id" SERIAL PRIMARY KEY,
      "payment_id" integer NOT NULL,
      "payment_code" varchar(50) NOT NULL,
      "customer_id" integer,
      "customer_name" varchar(255),
      "amount" numeric(15,2) NOT NULL DEFAULT 0,
      "payment_kind" varchar(20) NOT NULL DEFAULT 'invoice',
      "debt_note_code" varchar(50),
      "loan_code" varchar(50),
      "reason" text NOT NULL,
      "rolled_back_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "rolled_back_at" timestamp NOT NULL DEFAULT now(),
      "affected_invoices" integer NOT NULL DEFAULT 0,
      "affected_debt_notes" integer NOT NULL DEFAULT 0,
      "payment_snapshot" jsonb NOT NULL,
      "allocations_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "debt_notes_snapshot" jsonb,
      "loan_snapshot" jsonb,
      "accumulation_snapshot" jsonb
    )`);
    // Bảng có thể đã được synchronize tạo trước đó, phải bổ sung cột còn thiếu.
    await queryRunner.query(`ALTER TABLE "payment_rollback_history"
      ADD COLUMN IF NOT EXISTS "payment_kind" varchar(20) NOT NULL DEFAULT 'invoice'`);
    await queryRunner.query(`ALTER TABLE "payment_rollback_history"
      ADD COLUMN IF NOT EXISTS "debt_notes_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "payment_rollback_history"
      ADD COLUMN IF NOT EXISTS "loan_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "payment_rollback_history"
      ADD COLUMN IF NOT EXISTS "accumulation_snapshot" jsonb`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_rollback_history_payment"
      ON "payment_rollback_history" ("payment_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payment_rollback_history_customer_at"
      ON "payment_rollback_history" ("customer_id", "rolled_back_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payment_rollback_history_at"
      ON "payment_rollback_history" ("rolled_back_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payment_rollback_history_code"
      ON "payment_rollback_history" ("payment_code")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_rollback_history"`);
  }
}
