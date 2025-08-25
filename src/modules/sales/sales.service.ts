import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesInvoice } from '../../entities/sales-invoice.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-item.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(SalesInvoiceItem)
    private salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
  ) {}

  async create(
    createSalesInvoiceDto: CreateSalesInvoiceDto,
  ): Promise<SalesInvoice> {
    // Tạo phiếu bán hàng
    const invoice = this.salesInvoiceRepository.create({
      ...createSalesInvoiceDto,
      createdByUserId: 1, // TODO: Lấy user ID từ context
    });
    const savedInvoice = await this.salesInvoiceRepository.save(invoice);

    // Tạo các item trong phiếu
    const items = createSalesInvoiceDto.items.map((item) =>
      this.salesInvoiceItemRepository.create({
        ...item,
        invoiceId: savedInvoice.id,
      }),
    );
    await this.salesInvoiceItemRepository.save(items);

    return savedInvoice;
  }

  async findAll(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<SalesInvoice> {
    return this.salesInvoiceRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  async findByCode(invoiceCode: string): Promise<SalesInvoice> {
    return this.salesInvoiceRepository.findOne({
      where: { invoiceCode },
      relations: ['items'],
    });
  }

  async update(
    id: number,
    updateSalesInvoiceDto: UpdateSalesInvoiceDto,
  ): Promise<SalesInvoice> {
    await this.salesInvoiceRepository.update(id, updateSalesInvoiceDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.salesInvoiceRepository.delete(id);
  }

  async confirmInvoice(id: number): Promise<SalesInvoice> {
    const invoice = await this.findOne(id);
    invoice.status = 'confirmed';
    invoice.confirmedAt = new Date();
    return this.salesInvoiceRepository.save(invoice);
  }

  async deliverInvoice(id: number): Promise<SalesInvoice> {
    const invoice = await this.findOne(id);
    invoice.status = 'delivered';
    invoice.deliveredAt = new Date();
    return this.salesInvoiceRepository.save(invoice);
  }

  async completeInvoice(id: number): Promise<SalesInvoice> {
    const invoice = await this.findOne(id);
    invoice.status = 'completed';
    invoice.completedAt = new Date();
    return this.salesInvoiceRepository.save(invoice);
  }

  async cancelInvoice(id: number, reason: string): Promise<SalesInvoice> {
    const invoice = await this.findOne(id);
    invoice.status = 'cancelled';
    invoice.cancelledAt = new Date();
    invoice.cancelledReason = reason;
    return this.salesInvoiceRepository.save(invoice);
  }

  async getInvoiceItems(invoiceId: number): Promise<SalesInvoiceItem[]> {
    return this.salesInvoiceItemRepository.find({
      where: { invoiceId },
      relations: ['product'],
    });
  }

  async updateInvoiceItem(
    id: number,
    updateData: Partial<SalesInvoiceItem>,
  ): Promise<SalesInvoiceItem> {
    await this.salesInvoiceItemRepository.update(id, updateData);
    return this.salesInvoiceItemRepository.findOne({ where: { id } });
  }

  async removeInvoiceItem(id: number): Promise<void> {
    await this.salesInvoiceItemRepository.delete(id);
  }
}
