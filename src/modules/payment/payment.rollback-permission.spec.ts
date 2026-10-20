import { ForbiddenException } from '@nestjs/common';
import { RoleCode } from '../../common/enums/role-code.enum';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

/**
 * Kiểm tra quy tắc: chỉ SUPER_ADMIN mới được hoàn tác phiếu thu.
 * Test thuần (không kết nối database) để khóa hành vi phân quyền ở tầng controller.
 */
describe('PaymentController - phân quyền hoàn tác phiếu thu', () => {
  const previewToken = 'a'.repeat(64);

  /** Tạo controller với service giả để theo dõi service có được gọi hay không. */
  function createController() {
    const paymentService = {
      rollbackPayment: jest.fn().mockResolvedValue({ success: true }),
      getRollbackPreview: jest.fn().mockResolvedValue({ payment_id: 5, can_rollback: true }),
    };
    const controller = new PaymentController(paymentService as unknown as PaymentService);
    return { controller, paymentService };
  }

  const dto = { reason: 'Nhập sai số tiền', preview_token: previewToken };
  const superAdmin = { id: 1, role: { code: RoleCode.SUPER_ADMIN } };
  const admin = { id: 2, role: { code: RoleCode.ADMIN } };
  const staff = { id: 3, role: { code: RoleCode.STAFF } };

  it('chặn ADMIN khi hoàn tác phiếu thu', () => {
    const { controller, paymentService } = createController();

    // ADMIN có quyền sales:manage nhưng vẫn bị chặn vì không phải Super Admin
    expect(() => controller.rollback('5', dto as any, admin.id, admin)).toThrow(ForbiddenException);
    expect(paymentService.rollbackPayment).not.toHaveBeenCalled();
  });

  it('chặn STAFF khi hoàn tác phiếu thu', () => {
    const { controller, paymentService } = createController();

    expect(() => controller.rollback('5', dto as any, staff.id, staff)).toThrow(ForbiddenException);
    expect(paymentService.rollbackPayment).not.toHaveBeenCalled();
  });

  it('chặn ADMIN khi xem trước hoàn tác', () => {
    const { controller, paymentService } = createController();

    expect(() => controller.getRollbackPreview('5', admin)).toThrow(ForbiddenException);
    expect(paymentService.getRollbackPreview).not.toHaveBeenCalled();
  });

  it('chặn user thiếu thông tin role', () => {
    const { controller, paymentService } = createController();

    expect(() => controller.getRollbackPreview('5', { id: 9 })).toThrow(ForbiddenException);
    expect(paymentService.getRollbackPreview).not.toHaveBeenCalled();
  });

  it('cho phép SUPER_ADMIN hoàn tác và truyền lý do xuống service', async () => {
    const { controller, paymentService } = createController();

    await controller.rollback('5', dto as any, superAdmin.id, superAdmin);
    expect(paymentService.rollbackPayment).toHaveBeenCalledWith(5, dto, superAdmin.id);
  });

  it('cho phép SUPER_ADMIN xem trước hoàn tác', () => {
    const { controller, paymentService } = createController();

    controller.getRollbackPreview('5', superAdmin);
    expect(paymentService.getRollbackPreview).toHaveBeenCalledWith(5);
  });
});
