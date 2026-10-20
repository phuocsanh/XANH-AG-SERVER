import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ReceiptStatus } from './enums/receipt-status.enum';

describe('InventoryService.updateReceipt status transitions', () => {
  it.each([
    [ReceiptStatus.DRAFT, ReceiptStatus.APPROVED],
    [ReceiptStatus.APPROVED, ReceiptStatus.DRAFT],
  ])(
    'rejects changing receipt status from %s to %s through the update API',
    async (currentStatus, requestedStatus) => {
      const update = jest.fn();
      const service = Object.create(InventoryService.prototype) as InventoryService;
      service.findReceiptById = jest.fn().mockResolvedValue({
        id: 12,
        status: currentStatus,
      }) as any;
      Object.assign(service, {
        inventoryReceiptRepository: { update },
      });

      await expect(
        service.updateReceipt(12, { status: requestedStatus } as any),
      ).rejects.toThrow(
        new BadRequestException(
          'Không thể thay đổi trạng thái phiếu nhập qua API cập nhật. ' +
            'Hãy dùng chức năng duyệt phiếu nhập để chuyển phiếu nháp sang đã duyệt và ghi nhận tồn kho.',
        ),
      );

      expect(update).not.toHaveBeenCalled();
    },
  );
});
