# SQL Schema và Queries

## Thay đổi mới nhất

### 2024-10-07: Xóa bỏ hoàn toàn thuộc tính product_shop

Trong phiên bản này, chúng tôi đã thực hiện các thay đổi sau:

1. Xóa bỏ hoàn toàn cột `product_shop` khỏi các bảng:

   - `mushrooms`
   - `vegetables`
   - `bonsais`

2. Sửa đổi tất cả các queries liên quan để không còn tham chiếu đến cột `product_shop`.

Các thay đổi này cho phép chúng ta sử dụng Factory Pattern trong code mà không cần phụ thuộc vào thuộc tính `product_shop`.

## Cách áp dụng thay đổi

Để áp dụng các thay đổi này vào cơ sở dữ liệu, hãy chạy lệnh sau:

```bash
goose postgres "postgresql://username:password@localhost:5432/database_name?sslmode=disable" up
```

Thay thế `username`, `password`, và `database_name` bằng thông tin cơ sở dữ liệu của bạn.

## Cách tạo mã từ SQL

Sau khi áp dụng các thay đổi vào cơ sở dữ liệu, hãy tạo lại mã Go bằng sqlc:

```bash
sqlc generate
```

Điều này sẽ tạo ra các struct và hàm Go dựa trên schema và queries mới.
