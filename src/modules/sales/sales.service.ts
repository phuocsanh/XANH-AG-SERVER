import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, SelectQueryBuilder } from 'typeorm';
import {
  SalesInvoice,
  SalesInvoiceStatus,
} from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { SearchSalesDto } from './dto/search-sales.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';

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
    // Tạo phiếu bán hàng với trạng thái mặc định là DRAFT
    const invoice = this.salesInvoiceRepository.create({
      ...createSalesInvoiceDto,
      createdBy: 1, // TODO: Lấy user ID từ context
      status: SalesInvoiceStatus.DRAFT, // Trạng thái mặc định
    });
    const savedInvoice = await this.salesInvoiceRepository.save(invoice);

    // Tạo các item trong phiếu với tính toán totalPrice
    const items = createSalesInvoiceDto.items.map((item) => {
      // Tính tổng giá tiền = (giá đơn vị * số lượng) - số tiền giảm giá
      const totalPrice =
        item.unitPrice * item.quantity - (item.discountAmount || 0);

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
   * Lấy danh sách tất cả hóa đơn bán hàng (không bao gồm đã xóa mềm)
   * @returns Danh sách hóa đơn bán hàng
   */
  async findAll(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần
    });
  }

  /**
   * Lấy danh sách hóa đơn bán hàng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách hóa đơn bán hàng theo trạng thái
   */
  async findByStatus(status: SalesInvoiceStatus): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      where: {
        status,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy danh sách hóa đơn bán hàng đã xóa mềm
   * @returns Danh sách hóa đơn bán hàng đã xóa mềm
   */
  async findDeleted(): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepository.find({
      where: { deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
      withDeleted: true,
      relations: ['items'],
    });
  }

  /**
   * Tìm hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  async findOne(id: number): Promise<SalesInvoice | null> {
    return this.salesInvoiceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['items'], // Bao gồm cả các item trong hóa đơn
    });
  }

  /**
   * Tìm hóa đơn bán hàng theo mã
   * @param invoiceCode - Mã của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  async findByCode(code: string): Promise<SalesInvoice | null> {
    return this.salesInvoiceRepository.findOne({
      where: { code, deletedAt: IsNull() },
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
  ): Promise<SalesInvoice | null> {
    await this.salesInvoiceRepository.update(id, updateSalesInvoiceDto);
    return this.findOne(id);
  }

  /**
   * Cập nhật trạng thái hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param status - Trạng thái mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updateStatus(
    id: number,
    status: SalesInvoiceStatus,
  ): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.update(id, {
      status,
      updatedAt: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * Xác nhận hóa đơn bán hàng (chuyển từ DRAFT sang CONFIRMED)
   * @param id - ID của hóa đơn bán hàng cần xác nhận
   * @returns Thông tin hóa đơn bán hàng đã xác nhận
   */
  async confirmInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.CONFIRMED);
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  async markAsPaid(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.PAID);
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  async cancelInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.CANCELLED);
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  async refundInvoice(id: number): Promise<SalesInvoice | null> {
    return this.updateStatus(id, SalesInvoiceStatus.REFUNDED);
  }

  /**
   * Xóa mềm hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần xóa mềm
   * @returns Thông tin hóa đơn bán hàng đã xóa mềm
   */
  async softDelete(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.softDelete(id);

    return this.salesInvoiceRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['items'],
    });
  }

  /**
   * Khôi phục hóa đơn bán hàng đã xóa mềm
   * @param id - ID của hóa đơn bán hàng cần khôi phục
   * @returns Thông tin hóa đơn bán hàng đã khôi phục
   */
  async restore(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.salesInvoiceRepository.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    });

    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.restore(id);

    return this.findOne(id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID (xóa cứng)
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
  ): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }
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
  ): Promise<SalesInvoiceItem | null> {
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

  /**
   * Tìm kiếm nâng cao hóa đơn bán hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách hóa đơn bán hàng phù hợp
   */
  async searchSalesInvoices(
    searchDto: SearchSalesDto,
  ): Promise<SalesInvoice[]> {
    const queryBuilder =
      this.salesInvoiceRepository.createQueryBuilder('invoice');

    // Thêm điều kiện mặc định
    queryBuilder.where('invoice.deletedAt IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'invoice');

    return await queryBuilder.getMany();
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<SalesInvoice>,
    searchDto: SearchSalesDto,
    alias: string,
    parameterIndex: number = 0,
  ): number {
    // Xử lý các điều kiện lọc cơ bản
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          parameterIndex + index,
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

      parameterIndex += searchDto.filters.length;
    }

    // Xử lý các bộ lọc lồng nhau
    if (searchDto.nestedFilters && searchDto.nestedFilters.length > 0) {
      // Xây dựng điều kiện cho từng bộ lọc lồng nhau
      searchDto.nestedFilters.forEach((nestedFilter) => {
        parameterIndex = this.buildSearchConditions(
          queryBuilder,
          nestedFilter,
          alias,
          parameterIndex,
        );
      });
    }

    return parameterIndex;
  }

  /**
   * Xây dựng điều kiện lọc đơn lẻ
   * @param filter - Điều kiện lọc
   * @param alias - Alias của bảng
   * @param index - Chỉ số để tạo parameter name duy nhất
   * @param parameters - Object chứa các parameter
   * @returns Chuỗi điều kiện SQL
   */
  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) {
      return null;
    }

    const paramName = `param_${index}`;
    const field = `${alias}.${filter.field}`;

    switch (filter.operator) {
      case 'eq':
        parameters[paramName] = filter.value;
        return `${field} = :${paramName}`;
      case 'ne':
        parameters[paramName] = filter.value;
        return `${field} != :${paramName}`;
      case 'gt':
        parameters[paramName] = filter.value;
        return `${field} > :${paramName}`;
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        parameters[paramName] = `%${filter.value}%`;
        return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
        }
        return null;
      case 'isnull':
        return `${field} IS NULL`;
      case 'isnotnull':
        return `${field} IS NOT NULL`;
      default:
        return null;
    }
  }
}
