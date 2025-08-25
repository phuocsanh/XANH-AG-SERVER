import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateInventoryReceiptDto } from './dto/create-inventory-receipt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('batches')
  createBatch(@Body() createInventoryBatchDto: CreateInventoryBatchDto) {
    return this.inventoryService.createBatch(createInventoryBatchDto);
  }

  @Get('batches')
  findAllBatches() {
    return this.inventoryService.findAllBatches();
  }

  @Get('batches/product/:productId')
  findBatchesByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findBatchesByProduct(+productId);
  }

  @Get('batches/:id')
  findBatchById(@Param('id') id: string) {
    return this.inventoryService.findBatchById(+id);
  }

  @Patch('batches/:id')
  updateBatch(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryBatchDto>,
  ) {
    return this.inventoryService.updateBatch(+id, updateData);
  }

  @Delete('batches/:id')
  removeBatch(@Param('id') id: string) {
    return this.inventoryService.removeBatch(+id);
  }

  @Post('transactions')
  createTransaction(
    @Body() createInventoryTransactionDto: CreateInventoryTransactionDto,
  ) {
    return this.inventoryService.createTransaction(
      createInventoryTransactionDto,
    );
  }

  @Get('transactions')
  findAllTransactions() {
    return this.inventoryService.findAllTransactions();
  }

  @Get('transactions/product/:productId')
  findTransactionsByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findTransactionsByProduct(+productId);
  }

  @Get('summary/product/:productId')
  getInventorySummary(@Param('productId') productId: string) {
    return this.inventoryService.getInventorySummary(+productId);
  }

  @Get('fifo/product/:productId')
  getFifoValue(@Param('productId') productId: string) {
    return this.inventoryService.getFifoValue(+productId);
  }

  // Inventory Receipt endpoints
  @Post('receipt')
  createReceipt(@Body() createInventoryReceiptDto: CreateInventoryReceiptDto) {
    return this.inventoryService.createReceipt(createInventoryReceiptDto);
  }

  @Get('receipts')
  findAllReceipts() {
    return this.inventoryService.findAllReceipts();
  }

  @Get('receipt/:id')
  findReceiptById(@Param('id') id: string) {
    return this.inventoryService.findReceiptById(+id);
  }

  @Get('receipt/code/:code')
  findReceiptByCode(@Param('code') code: string) {
    return this.inventoryService.findReceiptByCode(code);
  }

  @Patch('receipt/:id')
  updateReceipt(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryReceiptDto>,
  ) {
    return this.inventoryService.updateReceipt(+id, updateData);
  }

  @Delete('receipt/:id')
  removeReceipt(@Param('id') id: string) {
    return this.inventoryService.removeReceipt(+id);
  }

  @Post('receipt/:id/approve')
  approveReceipt(@Param('id') id: string) {
    return this.inventoryService.approveReceipt(+id);
  }

  @Post('receipt/:id/complete')
  completeReceipt(@Param('id') id: string) {
    return this.inventoryService.completeReceipt(+id);
  }

  @Post('receipt/:id/cancel')
  cancelReceipt(@Param('id') id: string, @Body('reason') reason: string) {
    return this.inventoryService.cancelReceipt(+id, reason);
  }

  @Get('receipt/:id/items')
  getReceiptItems(@Param('id') id: string) {
    return this.inventoryService.getReceiptItems(+id);
  }

  @Patch('receipt/item/:id')
  updateReceiptItem(
    @Param('id') id: string,
    @Body() updateData: Partial<InventoryReceiptItem>,
  ) {
    return this.inventoryService.updateReceiptItem(+id, updateData);
  }

  @Delete('receipt/item/:id')
  removeReceiptItem(@Param('id') id: string) {
    return this.inventoryService.removeReceiptItem(+id);
  }
}
