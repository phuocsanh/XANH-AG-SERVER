# Phân Tích & So Sánh: Operating Costs vs Cost Items

## 1. TÌNH TRẠNG HIỆN TẠI (API Status)
Cả 2 module đều đã có đầy đủ API và đã được phân quyền.

| Chức năng | Operating Costs (`/operating-costs`) | Cost Items (`/cost-items`) |
| :--- | :--- | :--- |
| **API Create** | `POST /operating-costs` | `POST /cost-items` |
| **API Search** | `POST /operating-costs/search` | `POST /cost-items/search` |
| **Báo cáo Lợi nhuận** | **Đã tích hợp** (Tính vào Net Profit) | ✅ **Đã tích hợp** (Vừa được update: Tính vào Chi phí sản xuất) |
| **Độ chi tiết** | **Cơ bản** (Tên, Số tiền, Loại) | **Chi tiết** (Số lượng, Đơn vị, Đơn giá, Thành tiền) |
| **Mục đích** | Tài chính, Kế toán, Tổng hợp | Nhật ký canh tác, Quản lý vật tư |

## 2. API Của Cost Items (Đã có sẵn)
Các API này nằm trong `CostItemController` và đã được gán quyền (`cost_item:read`, `cost_item:create`...):

*   `POST /cost-items`: Tạo mới (Body: `rice_crop_id`, `category`, `item_name`, `quantity`, `unit`, `unit_price`...)
*   `POST /cost-items/search`: Tìm kiếm
*   `GET /cost-items/crop/:cropId/summary`: Tổng hợp theo vụ
*   `PATCH /cost-items/:id`: Sửa
*   `DELETE /cost-items/:id`: Xóa

## 3. CÁCH SỬ DỤNG: DÙNG Ở ĐÂU?

Để bạn dễ hình dung, hãy tưởng tượng 2 màn hình khác nhau trong App:

### Màn hình A: "Sổ Quỹ / Tài Chính" (Dùng Operating Costs) 💰
*   **Người dùng:** Kế toán hoặc Chủ doanh nghiệp.
*   **Mục tiêu:** Tính toán **LÃI LỖ**.
*   **Thao tác:** Nhập nhanh số tiền đã chi.
    *   *Ví dụ:* "Hôm nay chi 5 triệu tiền phân bón cho ruộng Ông Sáu." (Chỉ cần nhập 5,000,000đ).
*   **Kết quả:** Con số này chạy thẳng vào Báo Cáo Lợi Nhuận để trừ doanh thu.

### Màn hình B: "Nhật Ký Đồng Ruộng / Kỹ Thuật" (Dùng Cost Items) 🌾
*   **Người dùng:** Nông dân hoặc Kỹ sư nông nghiệp đi thăm ruộng.
*   **Mục tiêu:** Theo dõi **QUY TRÌNH CANH TÁC**.
*   **Thao tác:** Ghi chép chi tiết vật tư sử dụng.
    *   *Ví dụ:* "Hôm nay bón 10 bao NPK (loại 50kg), đơn giá 500k/bao."
*   **Kết quả:** Hệ thống biết được ruộng này đã "ăn" bao nhiêu kg phân, phun bao nhiêu lít thuốc. Dữ liệu này dùng để **phân tích năng suất** (tại sao ruộng này tốt, ruộng kia xấu) chứ không chỉ đơn thuần là tiền.

---

## 4. KẾT LUẬN & ĐỀ XUẤT CHO BẠN

Dựa vào việc bạn đang làm tính năng cho **Cửa Hàng (Store)** quản lý tài chính:

👉 **Cost Items dùng ở đâu?**: Nó sẽ dùng ở tính năng **"Nhật Ký Canh Tác"** (nếu app bạn có tính năng này cho nông dân).

👉 **Bạn có cần không?**:
*   Nếu app chỉ quản lý **Bán Hàng & Lợi Nhuận**: **KHÔNG CẦN** `Cost Items`. Hãy ẩn nó đi.
*   Chỉ dùng **`Operating Costs`** là đủ.
