import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bổ sung cờ loại tích lũy và sổ theo dõi hóa đơn, giữ nguyên tổng tích lũy lịch sử. */
export class AddProductRewardExclusion1786392000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "exclude_from_reward" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "sales_invoice_items"
      ADD COLUMN IF NOT EXISTS "exclude_from_reward" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "sales_invoices"
      ADD COLUMN IF NOT EXISTS "reward_policy_version" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customer_reward_invoice_tracking" (
      "invoice_id" integer PRIMARY KEY REFERENCES "sales_invoices"("id"),
      "customer_id" integer NOT NULL REFERENCES "customers"("id"),
      "accumulated_amount" numeric(15,2) NOT NULL DEFAULT 0,
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`);
    // Chỉ tạo mốc đối chiếu cho chứng từ cũ; không sửa bảng tích lũy khách hàng.
    await queryRunner.query(`INSERT INTO "customer_reward_invoice_tracking"
      ("invoice_id", "customer_id", "accumulated_amount")
      SELECT "id", "customer_id",
        CASE WHEN "status" IN ('confirmed', 'paid')
          THEN GREATEST(0, LEAST(COALESCE("partial_payment_amount", 0), "final_amount"::numeric))
          ELSE 0 END
      FROM "sales_invoices"
      WHERE "customer_id" IS NOT NULL AND "season_id" IS NOT NULL
        AND "deleted_at" IS NULL AND "reward_policy_version" = 0
      ON CONFLICT ("invoice_id") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "customer_reward_invoice_tracking"`);
    await queryRunner.query(`ALTER TABLE "sales_invoices" DROP COLUMN "reward_policy_version"`);
    await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP COLUMN "exclude_from_reward"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "exclude_from_reward"`);
  }
}
