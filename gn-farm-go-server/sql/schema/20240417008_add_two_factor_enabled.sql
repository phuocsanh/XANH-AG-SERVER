-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
-- Use BOOLEAN type for PostgreSQL
ADD COLUMN is_two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Add comment separately
COMMENT ON COLUMN users.is_two_factor_enabled IS 'authentication is enabled for the user';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users
DROP COLUMN IF EXISTS is_two_factor_enabled; -- Added IF EXISTS for robustness
-- +goose StatementEnd
