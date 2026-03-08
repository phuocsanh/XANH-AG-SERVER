
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { InventoryReceipt } from './src/entities/inventory-receipts.entity';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(InventoryReceipt);

  const receipts = await repo.find();
  console.log(`Checking ${receipts.length} receipts...`);

  for (const receipt of receipts) {
    const totalAmount = Number(receipt.total_amount) || 0;
    const returnedAmount = Number(receipt.returned_amount) || 0;
    const finalAmount = Number(receipt.final_amount) || totalAmount - returnedAmount;
    const supplierAmount = Number(receipt.supplier_amount) || finalAmount;
    const paidAmount = Number(receipt.paid_amount) || 0;

    // Công thức đúng: Nợ = Max(0, Nợ NCC - Đã trả)
    const newDebtAmount = Math.max(0, Math.round(supplierAmount - paidAmount));

    if (Number(receipt.debt_amount) !== newDebtAmount) {
      console.log(`Updating ${receipt.code}: ${receipt.debt_amount} -> ${newDebtAmount}`);
      await repo.update(receipt.id, { debt_amount: newDebtAmount });
    }
  }

  console.log('Finished recalculating debts correctly.');
  await app.close();
}

bootstrap();
