import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAndRecreateTables1761275963047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Xóa các bảng theo thứ tự phụ thuộc ngược lại
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_invoice_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_receipt_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_references"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_uploads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rice_market_data"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weather_forecasts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_subtype_relations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_subtypes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_types"`);

    // Không xóa bảng "users" và "user_profiles" vì yêu cầu giữ lại

    // Tạo lại các bảng theo thứ tự phụ thuộc
    // Bảng product_types
    await queryRunner.query(`
            CREATE TABLE "product_types" (
                "id" SERIAL NOT NULL,
                "type_name" character varying NOT NULL,
                "type_description" character varying,
                "status" character varying NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_product_types" PRIMARY KEY ("id")
            )
        `);

    // Bảng product_subtypes
    await queryRunner.query(`
            CREATE TABLE "product_subtypes" (
                "id" SERIAL NOT NULL,
                "subtype_name" character varying NOT NULL,
                "subtype_description" character varying,
                "product_type_id" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_product_subtypes" PRIMARY KEY ("id")
            )
        `);

    // Bảng products
    await queryRunner.query(`
            CREATE TABLE "products" (
                "id" SERIAL NOT NULL,
                "product_name" character varying NOT NULL,
                "product_price" character varying NOT NULL,
                "product_status" integer,
                "status" character varying NOT NULL DEFAULT 'active',
                "product_thumb" character varying NOT NULL,
                "product_pictures" text array NOT NULL DEFAULT '{}',
                "product_videos" text array NOT NULL DEFAULT '{}',
                "product_ratings_average" character varying,
                "product_description" character varying,
                "product_slug" character varying,
                "product_quantity" integer,
                "product_type" integer NOT NULL,
                "sub_product_type" integer array NOT NULL DEFAULT '{}',
                "discount" character varying,
                "product_discounted_price" character varying NOT NULL,
                "product_selled" integer,
                "product_attributes" jsonb NOT NULL DEFAULT '{}',
                "is_draft" boolean,
                "is_published" boolean,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "average_cost_price" character varying NOT NULL,
                "profit_margin_percent" character varying NOT NULL,
                "deleted_at" TIMESTAMP,
                "unit" character varying,
                CONSTRAINT "PK_products" PRIMARY KEY ("id")
            )
        `);

    // Bảng product_subtype_relations
    await queryRunner.query(`
            CREATE TABLE "product_subtype_relations" (
                "id" SERIAL NOT NULL,
                "parent_id" integer NOT NULL,
                "child_id" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_product_subtype_relations" PRIMARY KEY ("id")
            )
        `);

    // Bảng inventories
    await queryRunner.query(`
            CREATE TABLE "inventories" (
                "id" SERIAL NOT NULL,
                "product_id" integer NOT NULL,
                "quantity" integer NOT NULL,
                "unit_cost" numeric(10,2) NOT NULL,
                "batch_number" character varying,
                "manufacturing_date" TIMESTAMP,
                "expiry_date" TIMESTAMP,
                "location" character varying,
                "status" character varying NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_inventories" PRIMARY KEY ("id")
            )
        `);

    // Bảng inventory_transactions
    await queryRunner.query(`
            CREATE TABLE "inventory_transactions" (
                "id" SERIAL NOT NULL,
                "inventory_id" integer NOT NULL,
                "transaction_type" character varying NOT NULL,
                "quantity" integer NOT NULL,
                "unit_cost" numeric(10,2) NOT NULL,
                "reference_type" character varying,
                "reference_id" integer,
                "notes" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id")
            )
        `);

    // Bảng inventory_receipts
    await queryRunner.query(`
            CREATE TABLE "inventory_receipts" (
                "id" SERIAL NOT NULL,
                "receipt_code" character varying NOT NULL,
                "supplier_name" character varying NOT NULL,
                "receipt_date" TIMESTAMP NOT NULL DEFAULT now(),
                "total_amount" numeric(10,2) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "notes" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_inventory_receipts" PRIMARY KEY ("id")
            )
        `);

    // Bảng inventory_receipt_items
    await queryRunner.query(`
            CREATE TABLE "inventory_receipt_items" (
                "id" SERIAL NOT NULL,
                "receipt_id" integer NOT NULL,
                "product_id" integer NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price" numeric(10,2) NOT NULL,
                "total_price" numeric(10,2) NOT NULL,
                "batch_number" character varying,
                "manufacturing_date" TIMESTAMP,
                "expiry_date" TIMESTAMP,
                "notes" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_inventory_receipt_items" PRIMARY KEY ("id")
            )
        `);

    // Bảng sales_invoices
    await queryRunner.query(`
            CREATE TABLE "sales_invoices" (
                "id" SERIAL NOT NULL,
                "invoice_code" character varying NOT NULL,
                "customer_name" character varying NOT NULL,
                "customer_email" character varying,
                "invoice_date" TIMESTAMP NOT NULL DEFAULT now(),
                "total_amount" numeric(10,2) NOT NULL,
                "discount_amount" numeric(10,2) DEFAULT '0',
                "final_amount" numeric(10,2) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'draft',
                "payment_status" character varying NOT NULL DEFAULT 'unpaid',
                "notes" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_sales_invoices" PRIMARY KEY ("id")
            )
        `);

    // Bảng sales_invoice_items
    await queryRunner.query(`
            CREATE TABLE "sales_invoice_items" (
                "id" SERIAL NOT NULL,
                "invoice_id" integer NOT NULL,
                "product_id" integer NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price" numeric(10,2) NOT NULL,
                "discount_amount" numeric(10,2) DEFAULT '0',
                "total_price" numeric(10,2) NOT NULL,
                "notes" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_sales_invoice_items" PRIMARY KEY ("id")
            )
        `);

    // Bảng file_uploads
    await queryRunner.query(`
            CREATE TABLE "file_uploads" (
                "id" SERIAL NOT NULL,
                "original_name" character varying NOT NULL,
                "file_name" character varying NOT NULL,
                "file_path" character varying NOT NULL,
                "file_size" integer NOT NULL,
                "mime_type" character varying NOT NULL,
                "folder" character varying NOT NULL,
                "tags" text array NOT NULL DEFAULT '{}',
                "uploaded_by" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_file_uploads" PRIMARY KEY ("id")
            )
        `);

    // Bảng file_references
    await queryRunner.query(`
            CREATE TABLE "file_references" (
                "id" SERIAL NOT NULL,
                "file_upload_id" integer NOT NULL,
                "entity_type" character varying NOT NULL,
                "entity_id" integer NOT NULL,
                "field_name" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_file_references" PRIMARY KEY ("id")
            )
        `);

    // Bảng rice_market_data
    await queryRunner.query(`
            CREATE TABLE "rice_market_data" (
                "id" SERIAL NOT NULL,
                "summary" character varying NOT NULL,
                "price_analysis" character varying NOT NULL,
                "supply_demand" character varying,
                "export_import_info" character varying,
                "related_news" jsonb NOT NULL DEFAULT '[]',
                "last_updated" TIMESTAMP NOT NULL,
                "data_sources" jsonb NOT NULL DEFAULT '[]',
                "data_quality" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rice_market_data" PRIMARY KEY ("id")
            )
        `);

    // Bảng weather_forecasts
    await queryRunner.query(`
            CREATE TABLE "weather_forecasts" (
                "id" SERIAL NOT NULL,
                "location" character varying NOT NULL,
                "forecast_date" TIMESTAMP NOT NULL,
                "temperature_min" numeric(5,2),
                "temperature_max" numeric(5,2),
                "humidity" integer,
                "rainfall" numeric(5,2),
                "wind_speed" numeric(5,2),
                "weather_condition" character varying,
                "description" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_weather_forecasts" PRIMARY KEY ("id")
            )
        `);

    // Tạo các chỉ mục
    await queryRunner.query(
      `CREATE INDEX "IDX_product_types_status" ON "product_types" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_subtypes_status" ON "product_subtypes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_status" ON "products" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_product_type" ON "products" ("product_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventories_product_id" ON "inventories" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_transactions_inventory_id" ON "inventory_transactions" ("inventory_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_receipts_status" ON "inventory_receipts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_receipt_items_receipt_id" ON "inventory_receipt_items" ("receipt_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoices_status" ON "sales_invoices" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoice_items_invoice_id" ON "sales_invoice_items" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_file_uploads_folder" ON "file_uploads" ("folder")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_file_references_entity" ON "file_references" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_weather_forecasts_location_date" ON "weather_forecasts" ("location", "forecast_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa các bảng theo thứ tự phụ thuộc ngược lại
    await queryRunner.query(`DROP TABLE IF EXISTS "weather_forecasts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rice_market_data"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_references"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_uploads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_invoice_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_receipt_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_subtype_relations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_subtypes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_types"`);

    // Không xóa bảng "users" và "user_profiles" vì yêu cầu giữ lại
  }
}
