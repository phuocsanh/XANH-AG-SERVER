# Snapshot thuế phiếu mượn

Khi duyệt phiếu mượn, `inventory_borrow_items.taxable_quantity` lưu số lượng thuế thực tế mà lần xuất kho đã trừ khỏi lô được chọn. Lô phải có snapshot tồn thuế hợp lệ và số thuế xuất theo lô không được vượt tồn thuế tổng sản phẩm; lô cũ thiếu snapshot hoặc có số dư mâu thuẫn không dùng tỷ lệ toàn sản phẩm để ước tính mà bị chặn để đối soát. Trả từng phần khôi phục theo snapshot này, lần lượt hàng không thuế trước rồi mới đến hàng có thuế; hủy phiếu khôi phục toàn bộ snapshot. Tồn thuế của lô nguồn và sản phẩm được cập nhật cùng transaction.

Nếu dòng mượn đã có lượng chuyển bán nhưng chưa lưu snapshot thuế riêng của phần chuyển, không cho trả phần còn lại vì không thể xác định chính xác phần thuế cần hoàn.

Migration `1786387000000-AddInventoryBorrowTaxableSnapshot` chỉ thêm cột nullable, không suy đoán/backfill phiếu mượn cũ. Đã chạy riêng trên DB pro ngày 14/10/2026; DB dev chưa được xác nhận đã chạy migration này. Phiếu cũ thiếu snapshot hoặc lô thiếu số dư thuế hợp lệ không thể tự trả/hủy; API trả lỗi kèm mã phiếu và yêu cầu đối soát. Dòng mượn #3 của `BRW-2318417944A0` đã được đối chiếu theo phiếu nhập `REC-14598361D029` và ghi snapshot thuế 14 trên pro.
