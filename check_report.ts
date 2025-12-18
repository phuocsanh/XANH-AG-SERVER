import { DataSource } from "typeorm";

const dataSource = new DataSource({
  type: "postgres",
  url: "postgresql://postgres.obnjqiotcosyjpjfbrxk:0987383606Tp%24@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  synchronize: false,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await dataSource.initialize();
  const invoices = await dataSource.query("SELECT id, code, deleted_at FROM sales_invoices WHERE id = 37");
  console.table(invoices);
  await dataSource.destroy();
}

run().catch(console.error);
