# Rà lại mục 8: đơn vị khi khôi phục tồn thuế

Ngày rà soát: 14/10/2026. Ban đầu mục 8 chưa đủ điều kiện chốt. Phần bên dưới
ghi lại lỗi đã tìm thấy và bản sửa hiện tại trong code local.

## 1. P1: Đơn vị vẫn bị suy ra từ GBKT hiện tại

Vị trí: `sales.service.ts:3877` (`getInvoiceTaxableBaseQuantity`), kết quả
được dùng làm giới hạn hoàn tại `sales.service.ts:3578`.

Hàm so sánh GBKT đã lưu trên dòng bán với GBKT sản phẩm hiện tại để chọn
giữa số lượng thuế theo đơn vị bán và số lượng thuế theo đơn vị kho. Vì vậy,
sửa giá sản phẩm có thể đổi số lượng thuế được hoàn của một hóa đơn cũ.

Tái hiện bằng mock, allocation vẫn giữ snapshot đúng:

- Bán 10 bao, factor 50; thuế trên dòng bán 6 bao; allocation thuế 300 kg.
  GBKT dòng bán 100.000; GBKT sản phẩm hiện tại cũng 100.000.
  Hủy hóa đơn chỉ hoàn 6 kg thay vì 300 kg. Với tồn thuế trước đó là 2 kg,
  kết quả thực tế là 8 kg, kỳ vọng 302 kg.
- Snapshot cũ lưu thuế theo đơn vị kho là 6 kg, factor 50; giá dòng bán 2.000.
  Đổi giá sản phẩm 2.000 sang 2.100 làm code nhân 50 thành 300 kg và chặn
  hủy với lỗi snapshot allocation không đủ.
- Reviewer độc lập cũng tái hiện case factor 0,02 và case đã trả một phần.

Cùng heuristic còn nằm ở `inventory.service.ts:6858` trong đồng bộ tồn thuế.
Không được dùng giá đang thay đổi để xác định đơn vị số lượng đã bán.

## 2. P1: Precision của snapshot dòng bán không khớp DB

Vị trí: `sales.service.ts:3265`; entity `sales-invoice-items.entity.ts:103`.

Code tính/kiểm tra snapshot với 4 chữ số thập phân, nhưng DB pro xác nhận:

| Trường | Kiểu |
| --- | --- |
| sales_invoice_items.taxable_quantity | numeric(15,2) |
| sales_invoice_item_stock_allocations.taxable_quantity | numeric(15,4) |
| products.taxable_quantity_stock | numeric(15,2) |

SQL chỉ đọc xác nhận `0.001::numeric(15,2) = 0.00` và
`0.025::numeric(15,2) = 0.03`.

- Factor 1000, xuất 1 đơn vị thuế kho: dòng bán ghi 0,001, DB lưu 0,00.
  Khi hủy, code hoàn 0 thuế dù allocation còn snapshot 1. Tái hiện trong bộ
  nhớ có mô phỏng round-trip DB: tồn thuế giữ 2 thay vì tăng thành 3.
- Factor 40, xuất 1 kg thuế: snapshot 0,025 đơn vị bán bị lưu 0,03, tương
  đương 1,2 kg khi đọc lại; allocation chỉ có 1 kg nên hủy bị chặn.
  Cấu hình quy đổi factor 40 thực sự tồn tại trên pro; chưa khẳng định một
  hóa đơn thực tế đã gặp mất precision này.

Test cũ `keeps a sale-unit tax snapshot that fits the database precision`
chỉ assert mock nhận 0,001 nên không chứng minh DB lưu được giá trị đó.

## Dữ liệu thực tế và giới hạn kiểm tra

DB pro được đọc trong transaction READ ONLY rồi rollback. Có 2 dòng bán
đang hoạt động với factor 0,02, đều không có allocation:

- `HD-998594200501`, dòng 509, D.A.P PHI (HL) 18-46-0 (50kg): bán 10 Kg,
  base_quantity 0,2; taxable_quantity 10; giá dòng 1.030.000, giá sản phẩm 20.600.
- `HD-36228310BCD3`, dòng 526: bán 40 Kg, base_quantity 0,8;
  taxable_quantity 40; giá dòng và giá sản phẩm cùng 20.600.

Các dòng này cần được phân biệt với dữ liệu mới có snapshot đầy đủ. Chưa
thực hiện hủy/hoàn hoặc tự sửa dữ liệu của hai hóa đơn trên.

## Bản sửa

- Khôi phục hủy/hoàn tính từ allocation theo đơn vị kho, trừ số lượng và thuế
  đã được các phiếu trả duyệt ghi rõ cho từng lô. Không còn suy đơn vị từ GBKT.
- Nếu allocation cũ thiếu, sai nguồn, sai tổng số lượng, snapshot trả không
  khớp, hoặc phần hàng không thuế/thuế trả vượt lô gốc, thao tác dừng trong
  transaction với mã hóa đơn/dòng/lô trong thông báo.
- Batch cũ thiếu tồn thuế hoặc thuộc sai sản phẩm sẽ không bị âm thầm bỏ qua.
- Nhánh tạo lô hoàn mới chỉ cộng tồn thuế qua `processStockIn` một lần.
- Đồng bộ tồn thuế lấy số thuế từ allocation bán và snapshot trả/hoàn theo
  đơn vị kho. Dòng quy đổi cũ thiếu allocation được bỏ qua toàn sản phẩm nếu
  không thể xác định đơn vị; không ghi một phần kết quả.
- Snapshot dòng bán và tồn thuế sản phẩm được kiểm tra khả năng lưu chính xác
  theo `numeric(15,2)`. Giá trị không biểu diễn được bị chặn trước khi commit;
  không làm tròn để âm thầm mất hoặc tăng thuế.
- Không đổi schema, không chạy migration và không ghi DB pro/dev. DB dev chỉ
  được đọc trong transaction `READ ONLY` để xác nhận scale và round-trip.

## Kiểm chứng và giới hạn

- 157 test tập trung trong 4 suite (planner khôi phục, sales restoration,
  inventory tax/sync, sales return) đạt.
- `npx tsc --noEmit`, `npm run build`, `git diff --check` đạt sau các thay đổi.
- Toàn bộ Jest: 9 suite đạt, 3 suite lỗi sẵn ở product search (factory/DTO)
  và season (provider test setup); 2 suite khác bị skip. Không thấy lỗi từ
  các suite tồn thuế mới.
- Reviewer độc lập đã duyệt các thay đổi item 8 được chỉ định.
- Lịch sử cũ thiếu allocation hoặc snapshot cần được đối soát thủ công trước
  khi hủy/hoàn. Không thể bảo đảm tự động cho dữ liệu không lưu bằng chứng.
- Precision `numeric(15,2)` giới hạn số lượng thuế ở hai chữ số thập phân.
  Các giao dịch không biểu diễn được sẽ bị chặn; hỗ trợ thêm số lẻ cần một
  thay đổi schema riêng.
