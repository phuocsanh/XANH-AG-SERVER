# Khôi Phục Tồn Thuế Lô

Migration `1786384000000` cũ có hai lỗi: aggregate trả hàng không có dòng vẫn
thành 0 nên che nguồn phiếu nhập, và công thức trừ hàng thuế trước trong lô trộn.
Sửa file migration cũ chỉ bảo vệ các database chưa chạy; database đã chạy cần
migration `RepairLegacyBatchTaxableBalances1786386000000` mới.

## Quy Tắc Khôi Phục

- Lô nhập gốc phải khớp sản phẩm, lượng nhập quy đổi, trạng thái phiếu, giao
  dịch tạo lô và không bị trùng nguồn. Lô toàn thuế còn bao nhiêu thì còn bấy
  nhiêu thuế; lô không thuế vẫn bằng 0.
- Lô trộn chỉ suy từ tồn còn lại khi lịch sử là xuất thông thường và tổng
  lượng xuất khớp lượng lô giảm. Nhiều lô phải có phân bổ xuất đủ từng lô. Trong lô,
  hàng không thuế xuất trước: nhập 30, có 10 thuế, còn 21 thì còn 10 thuế;
  còn 7 thì còn 7 thuế.
- Lô khách trả cần snapshot số lượng/thuế đầy đủ, đúng sản phẩm, mã phiếu,
  trạng thái approved, tổng phân bổ khớp toàn bộ dòng trả và lượng lô được tạo.
  JSON thiếu/null/sai kiểu
  không được đổi thành snapshot 0 hoặc clamp thành giá trị hợp lệ.
- Lô trộn có hoàn/hủy/mượn/điều chỉnh không rõ phân bổ không tự tính lại từ
  original-minus-remaining. Lô thiếu nguồn giữ nguyên và xuất danh sách đối soát.
- Tồn thuế sản phẩm chỉ cộng lại khi mọi lô còn hàng có kết quả xác định,
  tổng tồn lô khớp tồn sản phẩm và tổng thuế biểu diễn được trong precision
  hai chữ số thập phân của cột sản phẩm.
- Không đổi tồn vật lý, số thuế phiếu nhập, snapshot bán/trả hoặc giá trị tài
  chính của chứng từ. Đây là sửa migration/số dư; không thay thế sửa logic
  nghiệp vụ hủy/trả đang được rà soát riêng.

## Preview Chỉ Đọc

Đặt biến môi trường của database cần kiểm tra trước khi chạy. Không ghi URL
database vào source, báo cáo hoặc lệnh được commit.

```bash
npx ts-node src/scripts/preview-batch-taxable-repair.ts --output=/tmp/tax-repair-dev-preview.json
NODE_ENV=production npx ts-node src/scripts/preview-batch-taxable-repair.ts --output=/tmp/tax-repair-pro-preview.json
```

Script dùng transaction REPEATABLE READ / READ ONLY. Báo cáo gồm lô/sản phẩm
dự kiến thay đổi, lô chưa đủ căn cứ và các sai lệch tồn vật lý. Cột
`expected_tax: null` nghĩa là chưa xác định, không phải không thuế.
Kế hoạch cập nhật sản phẩm dùng chung SQL với migration, không làm tròn hoặc
so sánh gần đúng bằng JavaScript để quyết định ghi dữ liệu.

## Test PostgreSQL

```bash
TAX_BACKFILL_TEST_URL="$DATABASE_URL_DEV" npx jest --watchman=false --runInBand src/migrations/helpers/batch-taxable-evidence.spec.ts
```

Các test tạo bảng TEMP trong session riêng và rollback sau mỗi test. Chúng
không sửa bảng kho thật. Nếu không đặt `TAX_BACKFILL_TEST_URL`, suite này được
skip; phải chạy có database trước khi áp dụng migration production.

## Áp Dụng

Sao lưu số dư và dữ liệu nguồn, đọc preview, kiểm tra migration pending, áp
dụng dev rồi đọc lại preview. Chỉ chạy pro khi thay đổi dự kiến đúng phạm vi.

```bash
npm run migration:run
NODE_ENV=production npm run migration:run
```

Migration mới khóa sản phẩm trước lô và giữ chứng từ nguồn ổn định trong cùng
transaction. Dữ liệu thiếu căn cứ không bị ghi đè. Hậu kiểm xác nhận lượng tồn
không đổi và thuế từng lô đã sửa đúng kết quả phân loại.

`down()` không tự xóa/hoàn ngược số dư: giao dịch bán sau migration có thể đã
dùng số dư này. Nếu cần sửa lại, đối soát bản sao trước cập nhật với giao dịch
phát sinh sau đó, không chạy một rollback số lượng hàng loạt.

## Kết Quả Ngày 2026-10-13

Migration mới đã COMMIT trên dev trước, hậu kiểm đạt rồi COMMIT trên pro.

| Chỉ số | Dev | Pro |
| --- | --- | --- |
| Sản phẩm / lô đang hoạt động | 208 / 381 | 208 / 381 |
| Lô thay đổi thuế | 0 | 98 |
| Sản phẩm thay đổi thuế | 0 | 1 |
| Lệch thuế sản phẩm với tổng thuế lô trước → sau | 0 → 0 | 93 → 0 |
| Lệch tồn vật lý sau sửa | 0 | 0 |
| Lô còn hàng thiếu căn cứ tự tính, giữ nguyên | 10 | 10 |

98 lô pro đều có nguồn nhập toàn thuế hợp lệ nhưng số dư thuế lô bị ghi 0.
Sản phẩm duy nhất đổi số dư là ID38 FULLKILL / PER GOLD: 39 → 40 thuế,
tồn vật lý vẫn 40. Lô nhập 40 chai hiện tại có thuế đầy đủ; chai cũ đã bán
thuộc nguồn không thuế. Không sửa ngược snapshot hóa đơn trong đợt này.

Các số dư đã xác nhận được giữ nguyên: GA3 48 tồn / 0 thuế; CHỐNG SẬP ẤN ĐỘ
21 / 10; STARFIT 18 / 18; INCIPIO 97 / 97; GARSONI 150 / 150;
TILMIL SUPER 55 / 15. Không ép mọi sản phẩm có tồn thuế bằng tồn vật lý.

Các lô giữ nguyên vì migration không đủ nguồn để tự suy diễn: RETURN ID309
(GA3, 2 / 0), ID314 (STARFIT, 1 / 1), điều chỉnh ID361 (GARSONI, 150 / 150),
và CANCEL ID183,214,353,367,382,383,390 (thuế hiện tại 0). Ba lô đầu có số dư
được người dùng xác nhận trước; các lô CANCEL không được tự gán thêm thuế.
Không còn lệch tổng không đồng nghĩa lịch sử thiếu snapshot đã được tái dựng.

Đối chiếu JSON trước/sau xác nhận toàn bộ tồn vật lý, nguồn phiếu nhập,
phân bổ bán, phiếu trả khách/nhà cung cấp và giao dịch nguồn trong bản sao
không đổi. Các cập nhật khớp đúng preview; preview sau sửa không còn cập nhật.
Bản sao và hậu kiểm lưu tại `/tmp/xanh-item1-{dev,pro}-before-apply-2026-10-13.json`,
`/tmp/xanh-item1-{dev,pro}-after-apply-2026-10-13.json` và
`/tmp/xanh-item1-{dev,pro}-verification-2026-10-13.json`.

Kiểm chứng: TypeScript/build đạt; 44 ca PostgreSQL TEMP đạt (43 ca trong
lượt đầy đủ và 1 ca hợp lệ hai lô chạy riêng); 71 test tồn thuế hiện có đạt.
Full suite còn ba suite lỗi có sẵn: product-search import/DTO và season
controller/service thiếu dependency trong test. Không sửa các lỗi ngoài phạm vi.
Reviewer đã duyệt implementation mục 1 trước khi chạy migration. Code chưa
commit/push.

## Mục 2: Sửa Số Thuế Phiếu Nhập

Sửa số lượng thuế của phiếu nhập đã duyệt chỉ được phép khi lô gốc chưa phát
sinh xuất/hoàn/hủy/mượn/điều chỉnh và lịch sử, tổng tồn sản phẩm, tổng tồn lô
đều khớp. Khi đủ căn cứ, cập nhật dòng phiếu, tồn thuế lô và tồn thuế sản phẩm
trong cùng transaction; nếu không đủ căn cứ thì từ chối để đối soát, không tự
phân bổ lại lịch sử. Sửa phiếu nháp chỉ đổi dòng phiếu. Đổi giá bán thuế không
được đồng bộ lại số dư tồn.

Luồng sửa, duyệt và hủy khóa phiếu nhập trước khi khóa sản phẩm/lô để tránh
đan xen trạng thái và deadlock. Test dịch vụ bao gồm cập nhật nguyên tử, rollback,
phiếu nháp, thay đổi trạng thái và thay giá bán thuế. Test SQL dùng PostgreSQL
TEMP tables và rollback, không sửa dữ liệu kho thật.
