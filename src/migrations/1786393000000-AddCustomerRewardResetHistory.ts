import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng lưu lịch sử xóa tích lũy hiện tại của khách hàng.
 * Bảng chỉ phục vụ đối soát và khôi phục, không thay đổi dữ liệu tích lũy hiện có.
 */
export class AddCustomerRewardResetHistory1786393000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customer_reward_reset_history" (
      "id" SERIAL PRIMARY KEY,
      "customer_id" integer NOT NULL REFERENCES "customers"("id"),
      "customer_name" varchar(255),
      "customer_phone" varchar(20),
      "pending_before" numeric(15,2) NOT NULL DEFAULT 0,
      "pending_reset" numeric(15,2) NOT NULL DEFAULT 0,
      "total_accumulated_snapshot" numeric(15,2) NOT NULL DEFAULT 0,
      "reward_count_snapshot" integer NOT NULL DEFAULT 0,
      "reason" text NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "restored_pending_amount" numeric(15,2),
      "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "restored_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "restored_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reward_reset_history_customer_created" ON "customer_reward_reset_history" ("customer_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reward_reset_history_status" ON "customer_reward_reset_history" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reward_reset_history_created_at" ON "customer_reward_reset_history" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_reward_reset_history"`);
  }
}
