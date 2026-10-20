# GBKT trong báo cáo khai thuế

`GET /store-profit-report/period` tính giá theo các allocation xuất kho của
từng dòng hóa đơn bán:

1. Dòng phiếu nhập gốc có GBKT dương: dùng GBKT đó, chia hệ số quy đổi của
   phiếu nhập để đưa về đơn vị kho.
2. Thiếu phiếu nhập hoặc thiếu GBKT: dùng `products.tax_selling_price` hiện tại,
   vốn được lưu theo đơn vị kho.
3. Không ưu tiên `sales_invoice_items.tax_selling_price` khi định giá báo cáo.

Thành tiền khai thuế là tổng lượng có thuế còn bán của từng nguồn nhân với
GBKT nguồn tương ứng. Khi một dòng bán lấy từ nhiều lô, GBKT hiển thị là
bình quân theo **số lượng có thuế**; thành tiền cộng trực tiếp từng lô, không
làm tròn giá bình quân trước khi nhân.

Phiếu khách trả đã duyệt giảm đúng lượng thuế và giá trị theo snapshot
`sourceBatchId`/`sourceReceiptItemId`. Hàng trả không thuế không giảm doanh thu
khai thuế. Phiếu trả đã hủy không tham gia tính toán.

## Dữ liệu cũ

- Không có allocation: dùng giá sản phẩm và giữ tương thích cách đọc lượng
  thuế lịch sử. Chưa sửa các snapshot đơn vị cũ bị lệch; đây là thay đổi nguồn
  giá, không phải migration sửa quantity.
- Allocation có snapshot thuế: dùng snapshot, kể cả giá trị `0`.
- Thiếu snapshot: chỉ xác định từ lô LOT gốc khớp `receipt.batch_number`,
  liên kết receipt/product, số lượng gốc và phiếu nhập toàn bộ có/không thuế.
  Không suy thuế của lô hủy/trả từ tính chất phiếu nhập.
- Chỉ cần dùng chứng cứ receipt khi phần thiếu snapshot khác GBKT và chưa
  xác định được giá trị từ tổng thuế cũ. Ưu tiên loại phần chắc chắn không
  thuế; chỉ chốt cả nhóm full-tax khi tổng thuế cũ bao phủ nhóm đó. Không
  tăng số lượng thuế cũ để ép khớp phiếu nhập hiện tại.
- Phần chưa xác định còn lại chỉ tính khi toàn bộ có/không thuế hoặc có cùng
  một GBKT nên thành tiền xác định duy nhất. Nếu khác giá và không đủ chứng
  cứ, báo lỗi chứa mã hóa đơn và dòng bán, không tự chia theo tỷ lệ.
- Hóa đơn cũ không allocation cũng giữ phép trừ lượng trả cũ khi thiếu
  snapshot hoàn dùng được; không coi đây là đối soát lại đơn vị lịch sử.

Báo cáo chỉ đọc dữ liệu, không đóng băng giá hoặc cập nhật hóa đơn khi xem.
Sửa GBKT phiếu nhập/sản phẩm sẽ được phản ánh ở lần xem báo cáo tiếp theo.
Không thay đổi tồn kho, tồn thuế, giá bán thực tế hoặc quyết toán nhà cung cấp.

## Kiểm tra

```bash
npm test -- --runInBand --watchman=false tax-report-pricing store-profit-report-tax
npx tsc --noEmit --incremental false
npm run build
```

Đã đối chiếu chế độ READ ONLY với 14 dòng bán từ `REC-8371080358A4`:
Lúa 3: 900 kg × 9.600đ = 8.640.000đ; Đạm Cà Mau: 475 kg × 16.400đ =
7.790.000đ; tổng 16.430.000đ. Bản cuối được kiểm tra cả kỳ từ 01/01/2026 đến
14/10/2026: 444 hóa đơn, doanh thu khai thuế 301.528.000đ; không ghi lại DB
trong các lần kiểm tra này. Đây là kết quả chạy code local với dữ liệu pro,
chưa phải xác nhận đã triển khai bản sửa lên server.
