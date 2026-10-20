import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInventoryAdjustmentDto } from './create-inventory-adjustment.dto';

describe('CreateInventoryAdjustmentDto taxable quantity', () => {
  const payload = (taxableQuantity: number) => ({
    adjustment_code: 'ADJ-TEST',
    adjustment_type: 'IN',
    reason: 'Kiểm thử',
    created_by: 1,
    items: [{ product_id: 10, quantity_change: 5, taxable_quantity: taxableQuantity }],
  });

  it('accepts a finite non-negative taxable quantity within an increase', async () => {
    const dto = plainToInstance(CreateInventoryAdjustmentDto, payload(1.5));

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([-0.01, NaN, Infinity, -Infinity])(
    'rejects invalid taxable quantity %s',
    async (taxableQuantity) => {
      const dto = plainToInstance(
        CreateInventoryAdjustmentDto,
        payload(taxableQuantity),
      );

      const errors = await validate(dto);
      expect(errors[0]?.children?.[0]?.children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'taxable_quantity' }),
        ]),
      );
    },
  );
});
