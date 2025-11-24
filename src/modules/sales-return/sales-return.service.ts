import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { FilterConditionDto } from '../payment/dto/filter-condition.dto';
import { InventoryBatch } from '../../entities/inventories.entity';

@Injectable()
export class SalesReturnService {
  constructor(
    @InjectRepository(SalesReturn)
    private salesReturnRepository: Repository<SalesReturn>,
    @InjectRepository(SalesReturnItem)
    private salesReturnItemRepository: Repository<SalesReturnItem>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreateSalesReturnDto): Promise<SalesReturn> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Invoice
      const invoice = await queryRunner.manager.findOne(SalesInvoice, {
        where: { id: createDto.invoice_id },
        relations: ['customer'],
      });

      if (!invoice) {
        throw new NotFoundException('Hóa đơn không tồn tại');
      }

      // 2. Calculate Total Refund
      let totalRefund = 0;
      const returnItems: SalesReturnItem[] = [];

      for (const itemDto of createDto.items) {
        const total = itemDto.quantity * itemDto.unit_price;
        totalRefund += total;

        const returnItem = this.salesReturnItemRepository.create({
          product_id: itemDto.product_id,
          quantity: itemDto.quantity,
          unit_price: itemDto.unit_price,
          total_price: total,
        });
        returnItems.push(returnItem);
      }

      // 3. Create Sales Return
      const salesReturnData: any = {
        code: createDto.code,
        invoice_id: createDto.invoice_id,
        total_refund_amount: totalRefund,
        reason: createDto.reason || '',
        status: SalesReturnStatus.COMPLETED,
        created_by: 1,
        items: returnItems,
      };
      
      if (invoice.customer_id) {
        salesReturnData.customer_id = invoice.customer_id;
      }
      
      const salesReturn = this.salesReturnRepository.create(salesReturnData);

      const savedReturn = await queryRunner.manager.save(salesReturn) as unknown as SalesReturn;

      // 4. Handle Financial Impact (Reduce Debt or Create Refund)
      // Logic:
      // If invoice has remaining_amount > 0 (Customer owes money):
      //    Reduce remaining_amount by refundAmount.
      //    If refundAmount > remaining_amount:
      //        remaining_amount = 0.
      //        Excess amount needs to be refunded manually or credited.
      // For simplicity now: We just update the invoice debt.

      const currentRemaining = parseFloat(invoice.remaining_amount?.toString() || '0');
      // const currentPaid = parseFloat(invoice.partial_payment_amount?.toString() || '0');
      
      // Scenario A: Customer owes 3M. Return goods worth 1M.
      // New Debt = 2M.
      
      // Scenario B: Customer paid full (Debt 0). Return goods worth 1M.
      // New Debt = 0. Customer needs 1M back.
      
      // We will update the invoice to reflect this "return" as a form of payment/adjustment?
      // Actually, standard practice is:
      // Sales Return reduces the "Final Amount" effectively, or acts as a payment.
      // Let's treat it as reducing the debt first.

      let amountToDeductFromDebt = totalRefund;
      let refundToCustomer = 0;
      
      if (amountToDeductFromDebt > currentRemaining) {
        // Customer has less debt than refund amount
        // Deduct all remaining debt, and the rest needs to be refunded
        amountToDeductFromDebt = currentRemaining;
        refundToCustomer = totalRefund - currentRemaining;
      }

      const newRemaining = currentRemaining - amountToDeductFromDebt;
      
      invoice.remaining_amount = newRemaining;
      
      // Log refund information
      if (refundToCustomer > 0) {
        console.log(`[Sales Return ${createDto.code}] Customer needs refund: ${refundToCustomer} VND`);
        // TODO: Create a refund payment record or credit note for the customer
        // For now, this is just logged. In production, you should:
        // 1. Create a Payment with negative amount (refund)
        // 2. Or create a Credit Note for future purchases
        // 3. Or update Customer balance
      }
      
      // If debt is cleared
      if (newRemaining <= 0 && invoice.status !== 'paid') {
          // Debt is now cleared due to return
          // Note: We don't change status to 'paid' because technically
          // the customer didn't pay - they returned goods
      }

      await queryRunner.manager.save(invoice);

      // 5. Update Inventory (Increase stock for returned items)
      for (const item of returnItems) {
        // Find the most recent inventory batch for this product
        const inventoryBatch = await queryRunner.manager.findOne(
          InventoryBatch,
          {
            where: { product_id: item.product_id },
            order: { created_at: 'DESC' as any },
          },
        );

        if (inventoryBatch) {
          // Increase the remaining quantity
          inventoryBatch.remaining_quantity += item.quantity;
          await queryRunner.manager.save(inventoryBatch);
        } else {
          // If no batch exists, create a new one with the returned items
          const newBatch = queryRunner.manager.create(InventoryBatch, {
            product_id: item.product_id,
            code: `RETURN-${createDto.code}`,
            unit_cost_price: item.unit_price.toString(),
            original_quantity: item.quantity,
            remaining_quantity: item.quantity,
            notes: `Returned from Sales Return ${createDto.code}`,
          });
          await queryRunner.manager.save(newBatch);
        }
      }

      await queryRunner.commitTransaction();
      return savedReturn;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<SalesReturn[]> {
    return this.salesReturnRepository.find({
      relations: ['invoice', 'customer', 'items'],
      order: { created_at: 'DESC' },
    });
  }

  async search(searchDto: SearchSalesReturnDto): Promise<{
    data: SalesReturn[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.salesReturnRepository.createQueryBuilder('sales_return');
    
    queryBuilder.leftJoinAndSelect('sales_return.invoice', 'invoice');
    queryBuilder.leftJoinAndSelect('sales_return.customer', 'customer');
    queryBuilder.leftJoinAndSelect('sales_return.items', 'items');

    this.buildSearchConditions(queryBuilder, searchDto, 'sales_return');

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);
    queryBuilder.orderBy('sales_return.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<SalesReturn>,
    searchDto: SearchSalesReturnDto,
    alias: string,
  ): void {
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }
    }
  }

  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) return null;
    const paramName = `param_${index}`;
    const field = `${alias}.${filter.field}`;

    switch (filter.operator) {
      case 'eq': parameters[paramName] = filter.value; return `${field} = :${paramName}`;
      // Add other operators as needed
      default: return null;
    }
  }
}
