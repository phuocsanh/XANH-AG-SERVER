-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_verifications (
    verify_id SERIAL PRIMARY KEY,                         -- ID of the OTP record (PostgreSQL: SERIAL for auto-increment)
    verify_otp VARCHAR(6) NOT NULL,                       -- OTP code (verification code)
    verify_key VARCHAR(255) NOT NULL,                     -- verify_key: User's email (or phone number) to identify the OTP recipient
    verify_key_hash VARCHAR(255) NOT NULL,                -- verify_key_hash: User's email (or phone number) to identify the OTP recipient
    verify_type INT DEFAULT 1,                            -- 1: Email, 2: Phone, 3:... (Type of verification)
    is_verified INT DEFAULT 0,                            -- 0: No, 1: Yes - OTP verification status (default is not verified)
    is_deleted INT DEFAULT 0,                             -- 0: No, 1: Yes - Deletion status
    verify_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Record creation time (PostgreSQL: TIMESTAMPTZ)
    verify_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Record update time (PostgreSQL: TIMESTAMPTZ, ON UPDATE handled by app/trigger)
    -- Ensure verify_key is unique (PostgreSQL: CONSTRAINT UNIQUE)
    CONSTRAINT unique_verify_key UNIQUE (verify_key)
);

-- Create an index for the verify_otp field (PostgreSQL: Separate statement)
CREATE INDEX IF NOT EXISTS idx_verify_otp ON user_verifications (verify_otp);

-- Add table comment (PostgreSQL: Separate statement)
COMMENT ON TABLE user_verifications IS 'account_user_verify';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Remove backticks for PostgreSQL compatibility
DROP TABLE IF EXISTS user_verifications;
-- +goose StatementEnd

