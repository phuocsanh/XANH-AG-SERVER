# 🔧 Hướng dẫn Backend: Sửa Logic Trả Hàng (Sales Returns)

## 🎯 Mục tiêu

Sửa lỗi logic xử lý trả hàng để đảm bảo:
- ✅ Công thức: `partial_payment_amount + remaining_amount = final_amount` luôn đúng
- ✅ Hóa đơn gốc giữ nguyên tính toàn vẹn (immutability)
- ✅ Audit trail rõ ràng, dễ truy vết
- ✅ Tuân thủ chuẩn kế toán quốc tế

---

## ❌ Vấn đề hiện tại

### Kịch bản lỗi:

**Hóa đơn gốc:**
- Tổng tiền: 623.000đ
- Đã trả: 0đ
- Còn nợ: 623.000đ

**Sau khi trả hàng toàn bộ:**
- Tổng tiền: 623.000đ
- Đã trả: **0đ** ← ❌ SAI!
- Còn nợ: **0đ** ← ❌ SAI!

**Công thức kiểm tra:**
```
0đ + 0đ ≠ 623.000đ ❌ KHÔNG HỢP LỆ!
```

### Nguyên nhân:

File: `src-server/modules/sales-return/sales-return.service.ts`

**Dòng 119-129:** Backend chỉ giảm `remaining_amount` nhưng **KHÔNG cập nhật** `partial_payment_amount`

```typescript
// ❌ CODE CŨ - SAI
if (currentRemaining > 0) {
  const newRemaining = Math.max(0, currentRemaining - totalRefund);
  invoice.remaining_amount = newRemaining; // Chỉ giảm nợ
  // ❌ THIẾU: Không tăng partial_payment_amount
}
```

---

## ✅ Giải pháp

### Nguyên tắc cốt lõi:

1. **Immutability (Bất biến):** Hóa đơn gốc không bao giờ bị sửa đổi nội dung
2. **Separate Entity:** Trả hàng là giao dịch riêng, tham chiếu đến hóa đơn gốc
3. **Financial Integrity:** Luôn đảm bảo công thức tài chính đúng

### Logic đúng:

**Khi khách trả hàng = "Thanh toán bằng hàng hóa"**

- Nếu còn nợ → Trừ vào nợ + Tăng số tiền đã trả
- Nếu đã trả đủ → Tạo Payment âm (Refund) + Giảm số tiền đã trả

---

## 📝 Các bước thực hiện

### **Bước 1: Thêm field vào Entity SalesReturn**

File: `src-server/entities/sales-return.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SalesInvoice } from './sales-invoices.entity';
import { Customer } from './customer.entity';
import { SalesReturnItem } from './sales-return-items.entity';
import { User } from './users.entity';

export enum SalesReturnStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('sales_returns')
export class SalesReturn {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'customer_id', nullable: true })
  customer_id?: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_refund_amount!: number;

  // ✅ THÊM MỚI: Phương thức hoàn tiền
  @Column({ 
    type: 'varchar',
    length: 20,
    default: 'debt_credit'
  })
  refund_method!: string; // 'cash' | 'debt_credit'

  @Column({ type: 'text', nullable: true })
  reason?: string;

  // ✅ THÊM MỚI: Ghi chú
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: SalesReturnStatus,
    default: SalesReturnStatus.COMPLETED,
  })
  status!: SalesReturnStatus;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => SalesReturnItem, (item: SalesReturnItem) => item.sales_return, { cascade: true })
  items?: SalesReturnItem[];
}
```

---

### **Bước 2: Cập nhật DTO**

File: `src-server/modules/sales-return/dto/create-sales-return.dto.ts`

```typescript
import { IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnItemDto {
  @IsNotEmpty()
  product_id: number;

  @IsNotEmpty()
  quantity: number;

  @IsNotEmpty()
  unit_price: number;

  @IsOptional()
  reason?: string;
}

export class CreateSalesReturnDto {
  @IsNotEmpty()
  code: string;

  @IsNotEmpty()
  invoice_id: number;

  // ✅ THÊM MỚI
  @IsEnum(['cash', 'debt_credit'])
  refund_method: string;

  @IsOptional()
  reason?: string;

  // ✅ THÊM MỚI
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items: CreateSalesReturnItemDto[];
}
```

---

### **Bước 3: Sửa Service Logic** ⭐ QUAN TRỌNG NHẤT

File: `src-server/modules/sales-return/sales-return.service.ts`

**Thay thế toàn bộ phần xử lý tài chính (dòng 113-156):**

```typescript
// 6. ✅ XỬ LÝ TÀI CHÍNH - LOGIC MỚI ĐÚNG
const currentRemaining = parseFloat(invoice.remaining_amount?.toString() || '0');
const currentPaid = parseFloat(invoice.partial_payment_amount?.toString() || '0');

if (currentRemaining > 0) {
  // ========================================
  // CASE 1: Khách còn nợ → Trừ vào công nợ
  // ========================================
  // Trả hàng = "Thanh toán bằng hàng hóa"
  
  const amountToDeduct = Math.min(totalRefund, currentRemaining);
  
  // ✅ Giảm công nợ
  invoice.remaining_amount = currentRemaining - amountToDeduct;
  
  // ✅ QUAN TRỌNG: Tăng số tiền đã trả
  // Vì khách đã "trả" bằng cách trả hàng
  invoice.partial_payment_amount = currentPaid + amountToDeduct;
  
  this.logger.log(
    `[Trả hàng ${createDto.code}] Hóa đơn ${invoice.code}: ` +
    `Công nợ cũ: ${currentRemaining.toLocaleString()}đ, ` +
    `Trả hàng: ${totalRefund.toLocaleString()}đ, ` +
    `Công nợ mới: ${invoice.remaining_amount.toLocaleString()}đ, ` +
    `Đã trả mới: ${invoice.partial_payment_amount.toLocaleString()}đ`
  );
  
  // Nếu trả hàng nhiều hơn nợ → Tạo Payment âm cho phần dư
  if (totalRefund > currentRemaining) {
    const excessAmount = totalRefund - currentRemaining;
    
    if (!invoice.customer_id) {
      throw new BadRequestException('Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng');
    }
    
    const refundCode = this.generateRefundCode();
    
    const refundPayment = queryRunner.manager.create(Payment, {
      code: refundCode,
      customer_id: invoice.customer_id,
      amount: -excessAmount, // Số âm = Hoàn tiền
      payment_date: new Date(),
      payment_method: 'REFUND',
      notes: `Hoàn tiền phần dư - Phiếu ${createDto.code} - Hóa đơn ${invoice.code}`,
      created_by: userId,
    });
    
    await queryRunner.manager.save(refundPayment);
    
    this.logger.log(
      `[Trả hàng ${createDto.code}] Hoàn tiền phần dư: ${excessAmount.toLocaleString()}đ`
    );
  }
  
} else {
  // ========================================
  // CASE 2: Khách đã trả đủ → Hoàn tiền
  // ========================================
  
  if (!invoice.customer_id) {
    throw new BadRequestException('Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng');
  }
  
  const refundCode = this.generateRefundCode();
  
  // ✅ Tạo Payment âm (Refund)
  const refundPayment = queryRunner.manager.create(Payment, {
    code: refundCode,
    customer_id: invoice.customer_id,
    amount: -totalRefund, // ⚠️ Số âm = Hoàn tiền
    payment_date: new Date(),
    payment_method: 'REFUND',
    notes: `Hoàn tiền do trả hàng - Phiếu ${createDto.code} - Hóa đơn ${invoice.code}`,
    created_by: userId,
  });
  
  await queryRunner.manager.save(refundPayment);
  
  // ✅ QUAN TRỌNG: Giảm số tiền đã trả
  // Vì đã hoàn lại cho khách
  invoice.partial_payment_amount = Math.max(0, currentPaid - totalRefund);
  
  // ✅ Tăng công nợ (vì đã hoàn tiền)
  invoice.remaining_amount = currentRemaining + totalRefund;
  
  this.logger.log(
    `[Trả hàng ${createDto.code}] Hóa đơn ${invoice.code}: ` +
    `Khách đã trả đủ → Tạo phiếu hoàn tiền ${refundCode}: ${totalRefund.toLocaleString()}đ, ` +
    `Đã trả mới: ${invoice.partial_payment_amount.toLocaleString()}đ, ` +
    `Công nợ mới: ${invoice.remaining_amount.toLocaleString()}đ`
  );
}

await queryRunner.manager.save(invoice);
```

---

### **Bước 4: Cập nhật phần tạo phiếu trả (dòng 96-104)**

```typescript
// 5. Tạo phiếu trả hàng
const salesReturnData: any = {
  code: createDto.code,
  invoice_id: createDto.invoice_id,
  total_refund_amount: totalRefund,
  refund_method: createDto.refund_method,  // ✅ THÊM
  reason: createDto.reason || '',
  notes: createDto.notes || '',             // ✅ THÊM
  status: SalesReturnStatus.COMPLETED,
  created_by: userId,
  items: returnItems,
};

if (invoice.customer_id) {
  salesReturnData.customer_id = invoice.customer_id;
}

const salesReturn = this.salesReturnRepository.create(salesReturnData);
const savedReturn = await queryRunner.manager.save(salesReturn) as unknown as SalesReturn;
```

---

### **Bước 5: Migration Database**

Tạo file migration mới:

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRefundMethodAndNotesToSalesReturn1734270000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột refund_method
        await queryRunner.addColumn('sales_returns', new TableColumn({
            name: 'refund_method',
            type: 'varchar',
            length: '20',
            default: "'debt_credit'",
            isNullable: false,
        }));

        // Thêm cột notes
        await queryRunner.addColumn('sales_returns', new TableColumn({
            name: 'notes',
            type: 'text',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('sales_returns', 'refund_method');
        await queryRunner.dropColumn('sales_returns', 'notes');
    }
}
```

**Hoặc chạy SQL trực tiếp:**

```sql
-- Thêm cột refund_method
ALTER TABLE sales_returns 
ADD COLUMN refund_method VARCHAR(20) DEFAULT 'debt_credit' NOT NULL;

-- Thêm cột notes
ALTER TABLE sales_returns 
ADD COLUMN notes TEXT NULL;
```

---

## 🧪 Test Cases

### Test Case 1: Trả hàng khi còn nợ

**Setup:**
- Hóa đơn: 1.000.000đ
- Đã trả: 0đ
- Còn nợ: 1.000.000đ

**Action:** Trả hàng 300.000đ

**Expected Result:**
```
✅ Tổng tiền: 1.000.000đ (không đổi)
✅ Đã trả: 300.000đ (tăng từ 0đ)
✅ Còn nợ: 700.000đ (giảm từ 1.000.000đ)
✅ Công thức: 300.000 + 700.000 = 1.000.000 ✓
```

---

### Test Case 2: Trả hàng khi đã trả đủ

**Setup:**
- Hóa đơn: 1.000.000đ
- Đã trả: 1.000.000đ
- Còn nợ: 0đ

**Action:** Trả hàng 300.000đ

**Expected Result:**
```
✅ Tổng tiền: 1.000.000đ (không đổi)
✅ Đã trả: 700.000đ (giảm từ 1.000.000đ)
✅ Còn nợ: 300.000đ (tăng từ 0đ)
✅ Payment record: -300.000đ (Refund)
✅ Công thức: 700.000 + 300.000 = 1.000.000 ✓
```

---

### Test Case 3: Trả hàng toàn bộ khi còn nợ

**Setup:**
- Hóa đơn: 1.000.000đ
- Đã trả: 0đ
- Còn nợ: 1.000.000đ

**Action:** Trả hàng 1.000.000đ

**Expected Result:**
```
✅ Tổng tiền: 1.000.000đ (không đổi)
✅ Đã trả: 1.000.000đ (tăng từ 0đ)
✅ Còn nợ: 0đ (giảm từ 1.000.000đ)
✅ Công thức: 1.000.000 + 0 = 1.000.000 ✓
```

---

### Test Case 4: Trả hàng nhiều hơn nợ

**Setup:**
- Hóa đơn: 1.000.000đ
- Đã trả: 400.000đ
- Còn nợ: 600.000đ

**Action:** Trả hàng 800.000đ

**Expected Result:**
```
✅ Tổng tiền: 1.000.000đ (không đổi)
✅ Đã trả: 1.000.000đ (tăng 600.000đ)
✅ Còn nợ: 0đ (giảm hết)
✅ Payment record: -200.000đ (Refund phần dư)
✅ Công thức: 1.000.000 + 0 = 1.000.000 ✓
```

---

## ✅ Checklist

- [ ] Thêm cột `refund_method` vào bảng `sales_returns`
- [ ] Thêm cột `notes` vào bảng `sales_returns`
- [ ] Cập nhật Entity `SalesReturn`
- [ ] Cập nhật DTO `CreateSalesReturnDto`
- [ ] Sửa logic xử lý tài chính trong Service
- [ ] Test Case 1: Trả hàng khi còn nợ
- [ ] Test Case 2: Trả hàng khi đã trả đủ
- [ ] Test Case 3: Trả hàng toàn bộ
- [ ] Test Case 4: Trả hàng nhiều hơn nợ
- [ ] Kiểm tra công thức: `partial_payment_amount + remaining_amount = final_amount`

---

## 📞 Liên hệ

Nếu có thắc mắc, vui lòng liên hệ Frontend team.

**File tạo bởi:** Frontend Team  
**Ngày:** 2025-12-15
