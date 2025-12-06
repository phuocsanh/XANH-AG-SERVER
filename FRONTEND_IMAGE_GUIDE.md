# 🖼️ Hướng Dẫn Xử Lý Ảnh (Frontend Integration Guide)

## 1. Chiến Lược Tối Ưu Hóa (Dual Optimization Strategy)

Để đảm bảo hiệu năng tốt nhất cho ứng dụng, chúng ta áp dụng chiến lược tối ưu kép:

1.  **Frontend (Sơ chế)**: Giảm kích thước ảnh (Resize) và nén nhẹ để tăng tốc độ upload lên server (tiết kiệm băng thông User).
2.  **Backend + Cloudinary (Tinh chỉnh)**: Server sẽ tự động cấu hình Cloudinary để nén thông minh (`q_auto`) và chuyển đổi định dạng tối ưu (`f_auto` - ví dụ sang WebP/AVIF tùy trình duyệt).

---

## 2. Trách Nhiệm Của Frontend

Frontend cần thực hiện các bước sau trước khi gọi API Upload:

### Bước 1: Resize (Quan trọng)
*   **Không bao giờ** upload ảnh gốc từ camera (thường > 5MB, 4000x3000px).
*   **Resize** ảnh về kích thước hiển thị tối đa cần thiết.
    *   Ví dụ: Ảnh Avatar chỉ cần ~500x500px.
    *   Ảnh sản phẩm chi tiết: ~1500x1500px hoặc 1920x1080px.

### Bước 2: Nén Nhẹ (Optional nhưng Recommended)
*   Nén chất lượng xuống 0.8 - 0.9 (80-90%). Đừng nén quá thấp vì Server sẽ nén lại một lần nữa.

### Bước 3: Gửi API
*   Gửi kèm tham số `type` (UploadType) để Server lưu ảnh vào folder tương ứng.

---

## 3. Upload Types (Quan trọng)

Thay vì gửi folder name tự do, bây giờ Frontend gửi `type` theo định nghĩa sau để đảm bảo an toàn và thống nhất:

| Upload Type | Folder trên Cloud | Mô tả sử dụng |
|-------------|-------------------|---------------|
| `avatar` | `/avatars` | Ảnh đại diện user |
| `product` | `/products` | Ảnh sản phẩm, vật tư |
| `rice-crop` | `/rice-crops` | Ảnh liên quan vụ lúa, nhật ký đồng ruộng |
| `document` | `/documents` | File tài liệu, hợp đồng |
| `common` | `/common` | (Mặc định) Các loại khác |

*Frontend chỉ cần gửi giá trị cột **Upload Type**.*

---

## 4. API Upload Mới

### Endpoint
`POST /upload/image`

### Headers
`Content-Type: multipart/form-data`

### Body (FormData)

| Key | Type | Bắt buộc | Mô tả |
|-----|------|----------|-------|
| `file` | File | ✅ | File ảnh cần upload |
| `type` | String | ❌ | Loại upload (xem bảng trên). Nếu không gửi, mặc định lưu vào `common`. |

### Response Thành Công (201 Created)
```json
{
  "id": "123",                    // ID record trong DB (lưu cái này nếu cần quan hệ bảng)
  "public_id": "gn-farm/products/abc_123", // QUAN TRỌNG: Lưu cái này để xóa sau này
  "url": "https://res.cloudinary.com/.../abc_123.jpg", // Dùng để hiển thị
  "name": "ten_file_goc.jpg",
  "type": "image/jpeg",
  "size": 102400
}
```

### Response Lỗi (400 Bad Request)
```json
{
  "message": "Invalid file type. Only image/jpeg, image/png are allowed.",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 5. API Xóa Ảnh

Do cấu trúc thư mục có thể lồng nhau, API xóa ảnh đã được cập nhật để sử dụng `publicId` thông qua Query Param thay vì URL Path.

### Endpoint
`DELETE /upload?publicId={publicId}`

*   **publicId**: Là ID đầy đủ của ảnh (ví dụ: `gn-farm/products/image_123`). ID này được trả về từ API Upload (`public_id`) và được lưu trong Database.

---

## 6. Ví dụ Code (React/JS)

```javascript
import imageCompression from 'browser-image-compression';

// Danh sách Type hợp lệ
const UPLOAD_TYPES = {
  AVATAR: 'avatar',
  PRODUCT: 'product',
  RICE_CROP: 'rice-crop',
  DOCUMENT: 'document',
  COMMON: 'common',
};

async function handleImageUpload(originalFile, uploadType = UPLOAD_TYPES.COMMON) {
  // 1. Cấu hình nén & Resize
  const options = {
    maxSizeMB: 1,          // Tối đa 1MB
    maxWidthOrHeight: 1920, // Resize về tối đa 1920px
    useWebWorker: true,
  };

  try {
    // 2. Thực hiện nén ở Client
    const compressedFile = await imageCompression(originalFile, options);

    // 3. Chuẩn bị FormData
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('type', uploadType); // Gửi type thay vì folder

    // 4. Gọi API
    const response = await fetch('https://api.your-domain.com/upload/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`, // Đừng quên Token
      },
      body: formData,
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
    }

    const data = await response.json();
    console.log('Upload thành công:', data);
    
    // 5. Lưu kết quả vào state/DB
    // QUAN TRỌNG: Hãy lưu data.public_id nếu bạn muốn cho phép user xóa/sửa ảnh sau này
    // setUploadedImage({ url: data.url, publicId: data.public_id });
    
  } catch (error) {
    console.error('Lỗi upload:', error);
    alert('Upload thất bại: ' + error.message);
  }
}
```

## 7. Checklist cho Frontend Dev ✅
1. [ ] Đã cài đặt thư viện nén ảnh (ví dụ `browser-image-compression`).
2. [ ] Đã resize ảnh trước khi upload (đừng up ảnh gốc 5-10MB).
3. [ ] Đã gửi đúng `type` (avatar, product, ...) trong FormData.
4. [ ] Đã lưu `public_id` từ response vào Database (cùng với `url`).
5. [ ] Khi user xóa ảnh ở UI, gọi API `DELETE` với `publicId` vừa lưu.
