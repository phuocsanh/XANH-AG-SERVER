/*
#####################################################################
MIGRATION: USER BASE TABLE - BẢNG NGƯỜI DÙNG CHÍNH
Ngày tạo: 2024-04-17
Phiên bản: 001 (Migration đầu tiên)

MỤc đích:
- Tạo bảng users chính lưu trữ thông tin cơ bản của người dùng
- Hỗ trợ authentication và session management
- Tracking thời gian đăng nhập/đăng xuất và IP

Các tính năng chính:
- User authentication với salt và hashed password
- Session tracking (login/logout time, IP)
- Unique account constraint
- Timestamp tracking cho audit

Tác giả: GN Farm Development Team
#####################################################################
*/

-- +goose Up - Tạo bảng
-- +goose StatementBegin
-- Tạo bảng users - Lưu trữ thông tin người dùng cơ bản
CREATE TABLE IF NOT EXISTS users (
    -- ===== THÔNG TIN NGƯỜI DÙNG CƠ BẢN =====
    user_id SERIAL PRIMARY KEY,                         -- ID tự tăng (PostgreSQL SERIAL)
    user_account VARCHAR(255) NOT NULL,                 -- Tài khoản đăng nhập (email hoặc username)
    user_password VARCHAR(255) NOT NULL,                -- Mật khẩu đã hash (bcrypt/argon2)
    user_salt VARCHAR(255) NOT NULL,                    -- Salt để bảo mật mật khẩu
    
    -- ===== THÔNG TIN PHIEN LÀM VIỆC =====
    user_login_time TIMESTAMPTZ NULL,                   -- Thời gian đăng nhập gần nhất
    user_logout_time TIMESTAMPTZ NULL,                  -- Thời gian đăng xuất gần nhất
    user_login_ip VARCHAR(45) NULL,                     -- IP đăng nhập (hỗ trợ IPv4/IPv6)

    -- ===== THÔNG TIN AUDIT =====
    user_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Thời gian tạo tài khoản
    user_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Thời gian cập nhật cuối

    -- ===== RÀNG BUỘC =====
    -- Đảm bảo tài khoản là duy nhất trong hệ thống
    CONSTRAINT unique_user_account UNIQUE (user_account)
);

-- Thêm comment mô tả cho bảng (PostgreSQL metadata)
COMMENT ON TABLE users IS 'Bảng người dùng chính - Lưu trữ thông tin authentication và session';
-- +goose StatementEnd

-- +goose Down - Rollback migration (xóa bảng)
-- +goose StatementBegin
-- Xóa bảng users nếu cần rollback migration
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
