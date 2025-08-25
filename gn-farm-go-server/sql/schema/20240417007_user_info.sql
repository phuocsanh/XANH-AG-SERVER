-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id BIGSERIAL PRIMARY KEY, -- Primary key for user ID (PostgreSQL: BIGSERIAL)
    user_account VARCHAR(255) NOT NULL UNIQUE, -- Account of the user (Added UNIQUE directly here, let PostgreSQL name it)
    user_nickname VARCHAR(255), -- Nickname of the user
    user_avatar VARCHAR(255), -- Avatar image URL for the user
    user_state SMALLINT NOT NULL, -- User state: 0-Locked, 1-Activated, 2-Not Activated (PostgreSQL: SMALLINT)
    user_mobile VARCHAR(20), -- User's mobile phone number

    user_gender SMALLINT, -- User gender: 0-Secret, 1-Male, 2-Female (PostgreSQL: SMALLINT)
    user_birthday DATE, -- Date of birth
    user_email VARCHAR(255), -- Email address

    user_is_authentication SMALLINT NOT NULL, -- Authentication status: 0-Not Authenticated, 1-Pending, 2-Authenticated, 3-Failed (PostgreSQL: SMALLINT)

    -- Add timestamps for record creation and updates
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Record creation time (PostgreSQL: TIMESTAMPTZ)
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP -- Record update time (PostgreSQL: TIMESTAMPTZ, ON UPDATE handled by app/trigger)
);

-- Indexes for optimized querying (PostgreSQL: Separate statements)
CREATE INDEX IF NOT EXISTS idx_user_mobile ON user_profiles (user_mobile);
CREATE INDEX IF NOT EXISTS idx_user_email ON user_profiles (user_email);
CREATE INDEX IF NOT EXISTS idx_user_state ON user_profiles (user_state);
CREATE INDEX IF NOT EXISTS idx_user_is_authentication ON user_profiles (user_is_authentication);

-- Add comments (PostgreSQL: Separate statements)
COMMENT ON TABLE user_profiles IS 'user_profiles';
COMMENT ON COLUMN user_profiles.user_id IS 'User ID';
COMMENT ON COLUMN user_profiles.user_account IS 'User account';
COMMENT ON COLUMN user_profiles.user_nickname IS 'User nickname';
COMMENT ON COLUMN user_profiles.user_avatar IS 'User avatar';
COMMENT ON COLUMN user_profiles.user_state IS 'User state: 0-Locked, 1-Activated, 2-Not Activated';
COMMENT ON COLUMN user_profiles.user_mobile IS 'Mobile phone number';
COMMENT ON COLUMN user_profiles.user_gender IS 'User gender: 0-Secret, 1-Male, 2-Female';
COMMENT ON COLUMN user_profiles.user_birthday IS 'User birthday';
COMMENT ON COLUMN user_profiles.user_email IS 'User email address';
COMMENT ON COLUMN user_profiles.user_is_authentication IS 'Authentication status: 0-Not Authenticated, 1-Pending, 2-Authenticated, 3-Failed';
COMMENT ON COLUMN user_profiles.created_at IS 'Record creation time';
COMMENT ON COLUMN user_profiles.updated_at IS 'Record update time';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Correct table name and remove backticks for PostgreSQL compatibility
DROP TABLE IF EXISTS user_profiles;
-- +goose StatementEnd
