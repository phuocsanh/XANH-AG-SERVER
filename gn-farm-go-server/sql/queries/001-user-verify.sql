/*
#####################################################################
USER VERIFICATION QUERIES - CÁC QUERY XÁC THỰC NGƯỜI DÙNG
File: 001-user-verify.sql

Mục đích:
- Xử lý OTP verification cho đăng ký tài khoản
- Quản lý trạng thái xác thực email/phone
- Theo dõi quá trình verification của người dùng

Các chức năng:
- Lấy OTP hợp lệ cho xác thực
- Cập nhật trạng thái đã xác thực
- Thêm OTP mới
- Kiểm tra thông tin OTP
- Cập nhật OTP theo verify key

Tác giả: GN Farm Development Team
#####################################################################
*/

-- name: GetValidOTP :one
SELECT verify_otp, verify_key_hash, verify_key, verify_id
FROM user_verifications
WHERE verify_key_hash = $1 AND is_verified = 0;

-- update lai
-- name: UpdateUserVerificationStatus :exec
UPDATE user_verifications
SET is_verified = 1,
    verify_updated_at = now()
WHERE verify_key_hash = $1;

-- name: InsertOTPVerify :execresult
INSERT INTO user_verifications (
    verify_otp,
    verify_key,
    verify_key_hash,
    verify_type,
    is_verified,
    is_deleted,
    verify_created_at,
    verify_updated_at
)
VALUES ($1, $2, $3, $4, 0, 0, NOW(), NOW());

-- name: GetInfoOTP :one
SELECT verify_id, verify_otp, verify_key, verify_key_hash, verify_type, is_verified, is_deleted, verify_created_at, verify_updated_at
FROM user_verifications
WHERE verify_key_hash = $1;

-- name: GetOTPByVerifyKey :one
SELECT COUNT(*)
FROM user_verifications
WHERE verify_key = $1;

-- name: UpdateOTPByVerifyKey :exec
UPDATE user_verifications
SET verify_otp = $1,
    verify_key_hash = $2,
    verify_type = $3,
    is_verified = 0,
    is_deleted = 0,
    verify_updated_at = NOW()
WHERE verify_key = $4;
