import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Injectable()
export class SalesService {
  /**
   * Constructor injection các repository cần thiết
   * @param salesInvoiceRepository - Repository để thao tác với entity SalesInvoice
   * @param salesInvoiceItemRepository - Repository để thao tác với entity SalesInvoiceItem
   */
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(SalesInvoiceItem)
    private salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
  ) {}

  /**
   * Tạo hóa đơn bán hàng mới
   * @param createSalesInvoiceDto - Dữ liệu tạo hóa đơn bán hàng mới
   * @returns Thông tin hóa đơn bán hàng đã tạo
   */
  async create(
    createSalesInvoiceDto: CreateSalesInvoiceDto,
  ): Promise<SalesInvoice> {
    // Tạo phiếu bán hàng
    const invoice = this.salesInvoiceRepository.create({
      ...createSalesInvoiceDto,
      createdByUserId: 1, // TODO: Lấy user ID từ context
    });
    const savedInvoice = await this.salesInvoiceRepository.save(invoice);

    // Tạo các item trong phiếu với tính toán totalPrice
    const items = createSalesInvoiceDto.items.map((item) => {
      // Tính tổng giá tiền = (giá đơn vị * số lượng) - số tiền giảm giá
      const totalPrice = (item.unitPrice * item.quantity) - (item.discountAmount || 0);
      
      return this.salesInvoiceItemRepository.create({
        ...item,
        invoiceId: savedInvoice.id,
        totalPrice: totalPrice,
      });
    });
    await this.salesInvoiceItemRepository.save(items);

    return savedInvoice;
  }

  /**
   * Lấy danh sách tất cả hóa đơn bán hàng
   * @returns Danh sách hóa đơn bán hàng
   */
  async findAll(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      order: { createdAt: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần
    });
  }

  /**
   * Tìm hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  async findOne(id: number): Promise<SalesInvoice> {
    return this.salesInvoiceRepository.findOne({
      where: { id },
      relations: ['items'], // Bao gồm cả các item trong hóa đơn
    });
  }

  /**
   * Tìm hóa đơn bán hàng theo mã
   * @param invoiceCode - Mã của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  async findByCode(invoiceCode: string): Promise<SalesInvoice> {
    return this.salesInvoiceRepository.findOne({
      where: { invoiceCode },
      relations: ['items'], // Bao gồm cả các item trong hóa đơn
    });
  }

  /**
   * Cập nhật thông tin hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param updateSalesInvoiceDto - Dữ liệu cập nhật hóa đơn bán hàng
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async update(
    id: number,
    updateSalesInvoiceDto: UpdateSalesInvoiceDto,
  ): Promise<SalesInvoice> {
    await this.salesInvoiceRepository.update(id, updateSalesInvoiceDto);
    return this.findOne(id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.salesInvoiceRepository.delete(id);
  }

  /**
   * Cập nhật trạng thái thanh toán của hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param paymentStatus - Trạng thái thanh toán mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updatePaymentStatus(
    id: number,
    paymentStatus: string,
  ): Promise<SalesInvoice> {
    const invoice = await this.findOne(id);
    invoice.paymentStatus = paymentStatus; // Cập nhật trạng thái thanh toán
    return this.salesInvoiceRepository.save(invoice);
  }

  /**
   * Lấy danh sách chi tiết hóa đơn bán hàng
   * @param invoiceId - ID của hóa đơn bán hàng
   * @returns Danh sách chi tiết hóa đơn bán hàng
   */
  async getInvoiceItems(invoiceId: number): Promise<SalesInvoiceItem[]> {
    return this.salesInvoiceItemRepository.find({
      where: { invoiceId },
      relations: ['product'], // Bao gồm thông tin sản phẩm
    });
  }

  /**
   * Cập nhật thông tin chi tiết hóa đơn bán hàng
   * @param id - ID của chi tiết hóa đơn bán hàng cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết hóa đơn bán hàng
   * @returns Thông tin chi tiết hóa đơn bán hàng đã cập nhật
   */
  async updateInvoiceItem(
    id: number,
    updateData: Partial<SalesInvoiceItem>,
  ): Promise<SalesInvoiceItem> {
    await this.salesInvoiceItemRepository.update(id, updateData);
    return this.salesInvoiceItemRepository.findOne({ where: { id } });
  }

  /**
   * Xóa chi tiết hóa đơn bán hàng theo ID
   * @param id - ID của chi tiết hóa đơn bán hàng cần xóa
   */
  async removeInvoiceItem(id: number): Promise<void> {
    await this.salesInvoiceItemRepository.delete(id);
  }
}
