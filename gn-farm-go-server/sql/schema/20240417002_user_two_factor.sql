-- +goose Up
-- +goose StatementBegin
-- Remove backticks for PostgreSQL compatibility
CREATE TABLE IF NOT EXISTS user_two_factors (
    two_factor_id SERIAL PRIMARY KEY,                                  -- Primary key (PostgreSQL: SERIAL)
    user_id INT NOT NULL,                                              -- Foreign key to user table (PostgreSQL: INT)
    -- Use VARCHAR and CHECK constraint for ENUM equivalent in PostgreSQL
    two_factor_auth_type VARCHAR(10) NOT NULL CHECK (two_factor_auth_type IN ('SMS', 'EMAIL', 'APP')), -- Type of 2FA method
    two_factor_auth_secret VARCHAR(255) NOT NULL,                        -- Secret info for 2FA
    two_factor_phone VARCHAR(20) NULL,                                 -- Phone number for SMS 2FA
    two_factor_email VARCHAR(255) NULL,                                -- Email address for Email 2FA
    two_factor_is_active BOOLEAN NOT NULL DEFAULT TRUE,                  -- Activation status of the 2FA method
    two_factor_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,           -- Creation timestamp (PostgreSQL: TIMESTAMPTZ)
    two_factor_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,           -- Update timestamp (PostgreSQL: TIMESTAMPTZ, ON UPDATE handled by app/trigger)

    -- Foreign Key Constraint (Remove backticks)
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes (PostgreSQL: Separate statements, remove backticks)
CREATE INDEX IF NOT EXISTS idx_user_id ON user_two_factors (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_type ON user_two_factors (two_factor_auth_type);

-- Table Comment (PostgreSQL: Separate statement)
COMMENT ON TABLE user_two_factors IS 'user_two_factors';

-- Column Comments (PostgreSQL: Separate statements)
COMMENT ON COLUMN user_two_factors.two_factor_id IS 'Primary key auto-increment';
COMMENT ON COLUMN user_two_factors.user_id IS 'Foreign key linking to the user table';
COMMENT ON COLUMN user_two_factors.two_factor_auth_type IS 'Type of 2FA method (SMS, Email, App)';
COMMENT ON COLUMN user_two_factors.two_factor_auth_secret IS 'Secret information for 2FA (e.g., TOTP secret key for app 2FA)';
COMMENT ON COLUMN user_two_factors.two_factor_phone IS 'Phone number for SMS 2FA (if applicable)';
COMMENT ON COLUMN user_two_factors.two_factor_email IS 'Email address for Email 2FA (if applicable)';
COMMENT ON COLUMN user_two_factors.two_factor_is_active IS 'Activation status of the 2FA method';
COMMENT ON COLUMN user_two_factors.two_factor_created_at IS 'Timestamp of 2FA method creation';
COMMENT ON COLUMN user_two_factors.two_factor_updated_at IS 'Timestamp of 2FA method update';


-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Remove backticks for PostgreSQL compatibility
DROP TABLE IF EXISTS user_two_factors;
-- +goose StatementEnd
