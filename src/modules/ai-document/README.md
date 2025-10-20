# AI Document Module

Module này cung cấp chức năng sử dụng AI để đọc tài liệu có sẵn và trả lời các câu hỏi từ người dùng.

## Chức năng chính

- Đọc và phân tích tài liệu về phối trộn hóa chất thuốc bảo vệ thực vật
- Trả lời câu hỏi của người dùng dựa trên nội dung tài liệu
- Sử dụng Google Gemini API để xử lý ngôn ngữ tự nhiên

## Cách sử dụng

### Endpoint

```
POST /ai-document/ask
```

### Request Body

```json
{
  "question": "Mancozeb và Abamectin pha chung được không?"
}
```

### Response

```json
{
  "success": true,
  "answer": "Theo tài liệu hướng dẫn, Mancozeb thuộc nhóm Dithiocarbamate và Abamectin (IRAC 6) có thể pha chung được vì chúng thuộc hai nhóm cơ chế tác động khác nhau. Tuy nhiên, bạn nên thử pha nhỏ trước để kiểm tra tính tương thích..."
}
```

## Cấu hình

Module sử dụng các biến môi trường sau:

- `GOOGLE_AI_API_KEY`: API Key để truy cập Google Gemini API

## Cấu trúc thư mục

```
ai-document/
├── ai-document.controller.ts
├── ai-document.module.ts
├── ai-document.service.ts
├── dto/
│   └── ask.dto.ts
└── data/
    └── pesticide-mixing.data.ts
```
