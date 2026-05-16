import { In } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { InventoryReceipt } from '../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../entities/inventory-receipt-items.entity';
import { InventoryBatch } from '../entities/inventories.entity';
import { InventoryTransaction } from '../entities/inventory-transactions.entity';
import { Product } from '../entities/products.entity';
import { InventoryReturnItem } from '../entities/inventory-return-items.entity';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const receiptIdsArg = args.find((arg) => arg.startsWith('--receipt-ids='));
const receiptIds = (receiptIdsArg?.split('=')[1] || '')
  .split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => Number.isFinite(id) && id > 0);

const roundMoney = (value: number) => Math.round(value);
const round2 = (value: number) => Math.round(value * 100) / 100;

async function recalculateAverageCostPrice(productId: number) {
  const receiptItems = await AppDataSource.getRepository(InventoryReceiptItem)
    .createQueryBuilder('item')
    .innerJoin('item.receipt', 'receipt')
    .where('item.product_id = :productId', { productId })
    .andWhere('receipt.status IN (:...statuses)', {
      statuses: ['approved', 'completed'],
    })
    .andWhere('receipt.deleted_at IS NULL')
    .andWhere('item.deleted_at IS NULL')
    .getMany();

  const returnItems = await AppDataSource.getRepository(InventoryReturnItem)
    .createQueryBuilder('item')
    .innerJoin('item.return', 'inventoryReturn')
    .where('item.product_id = :productId', { productId })
    .andWhere('inventoryReturn.status = :status', { status: 'approved' })
    .andWhere('inventoryReturn.deleted_at IS NULL')
    .andWhere('item.deleted_at IS NULL')
    .getMany();

  const receiptTotals = receiptItems.reduce(
    (sum, item) => {
      const factor = Number(item.conversion_factor || 1);
      const baseQuantity = Number(
        item.base_quantity || Number(item.quantity || 0) * factor,
      );
      const unitCostInBaseUnit =
        Number(item.final_unit_cost ?? item.unit_cost ?? 0) /
        (factor > 0 ? factor : 1);

      sum.quantity += baseQuantity;
      sum.value += baseQuantity * unitCostInBaseUnit;
      return sum;
    },
    { quantity: 0, value: 0 },
  );

  const returnTotals = returnItems.reduce(
    (sum, item) => {
      const factor = Number(item.conversion_factor || 1);
      const baseQuantity = Number(
        item.base_quantity || Number(item.quantity || 0) * factor,
      );
      const unitCostInBaseUnit =
        Number(item.unit_cost || 0) / (factor > 0 ? factor : 1);

      sum.quantity += baseQuantity;
      sum.value += baseQuantity * unitCostInBaseUnit;
      return sum;
    },
    { quantity: 0, value: 0 },
  );

  const netQuantity = receiptTotals.quantity - returnTotals.quantity;
  const netValue = receiptTotals.value - returnTotals.value;
  const averageCostPrice = netQuantity > 0 ? round2(netValue / netQuantity) : 0;

  if (shouldApply) {
    await AppDataSource.getRepository(Product).update(productId, {
      average_cost_price: averageCostPrice.toFixed(2),
    });
  }

  return {
    productId,
    averageCostPrice,
    netQuantity: round2(netQuantity),
  };
}

async function main() {
  await AppDataSource.initialize();

  try {
    const receiptRepo = AppDataSource.getRepository(InventoryReceipt);
    const itemRepo = AppDataSource.getRepository(InventoryReceiptItem);
    const batchRepo = AppDataSource.getRepository(InventoryBatch);
    const txRepo = AppDataSource.getRepository(InventoryTransaction);

    const where: any = {
      status: In(['approved', 'completed']),
    };

    if (receiptIds.length > 0) {
      where.id = In(receiptIds);
    }

    const receipts = await receiptRepo.find({
      where,
      relations: ['items'],
      order: { id: 'ASC' },
    });

    const affectedProductIds = new Set<number>();
    const receiptSummaries: Array<{
      receiptId: number;
      code: string;
      updatedItems: number;
    }> = [];

    for (const receipt of receipts) {
      const sharedShippingCost = Number(receipt.shared_shipping_cost || 0);
      const allocationMethod = receipt.shipping_allocation_method || 'by_value';
      const items = receipt.items || [];

      let totalValue = 0;
      let totalQuantity = 0;

      for (const item of items) {
        totalValue += Number(item.quantity || 0) * Number(item.unit_cost || 0);
        totalQuantity += Number(item.quantity || 0);
      }

      let updatedItems = 0;

      for (const item of items) {
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) {
          continue;
        }

        let allocatedShipping = 0;
        if (sharedShippingCost > 0) {
          if (allocationMethod === 'by_value' && totalValue > 0) {
            const itemValue = quantity * Number(item.unit_cost || 0);
            allocatedShipping = (itemValue / totalValue) * sharedShippingCost;
          } else if (allocationMethod === 'by_quantity' && totalQuantity > 0) {
            allocatedShipping = (quantity / totalQuantity) * sharedShippingCost;
          }
        }

        const individualShipping = Number(item.individual_shipping_cost || 0);
        const shippingPerUnit =
          (individualShipping + allocatedShipping) / quantity;
        const roundedAllocatedShipping = roundMoney(allocatedShipping);
        const roundedFinalUnitCost = roundMoney(
          Number(item.unit_cost || 0) + shippingPerUnit,
        );
        const conversionFactor = Number(item.conversion_factor || 1);
        const normalizedUnitCost =
          conversionFactor > 0
            ? round2(roundedFinalUnitCost / conversionFactor)
            : roundedFinalUnitCost;
        const baseQuantity = Number(
          item.base_quantity || quantity * conversionFactor,
        );

        updatedItems += 1;
        affectedProductIds.add(Number(item.product_id));

        if (shouldApply) {
          await itemRepo.update(item.id, {
            allocated_shipping_cost: roundedAllocatedShipping,
            final_unit_cost: roundedFinalUnitCost,
          });

          await batchRepo.update(
            { receipt_item_id: item.id },
            { unit_cost_price: normalizedUnitCost.toFixed(2) },
          );

          await txRepo.update(
            { receipt_item_id: item.id },
            {
              unit_cost_price: normalizedUnitCost.toFixed(2),
              total_value: round2(baseQuantity * normalizedUnitCost).toFixed(2),
            },
          );
        }
      }

      receiptSummaries.push({
        receiptId: receipt.id,
        code: receipt.code,
        updatedItems,
      });
    }

    const productSummaries: Array<{
      productId: number;
      averageCostPrice: number;
      netQuantity: number;
    }> = [];
    for (const productId of affectedProductIds) {
      productSummaries.push(await recalculateAverageCostPrice(productId));
    }

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          receiptsProcessed: receipts.length,
          receiptIds: receiptIds.length > 0 ? receiptIds : 'all-approved',
          affectedProducts: affectedProductIds.size,
          receiptSummaries,
          productSummaries,
        },
        null,
        2,
      ),
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
