-- file: user_two_factors.sql

-- EnableTwoFactor
-- name: EnableTwoFactorTypeEmail :exec
-- Note: Inserting "OTP" as secret might need review based on actual logic.
INSERT INTO user_two_factors (user_id, two_factor_auth_type, two_factor_email, two_factor_auth_secret, two_factor_is_active, two_factor_created_at, two_factor_updated_at)
VALUES ($1, $2, $3, 'OTP', FALSE, NOW(), NOW()); -- Use $1..$3 placeholders, kept 'OTP' as string literal

-- DisableTwoFactor
-- name: DisableTwoFactor :exec
UPDATE user_two_factors
SET two_factor_is_active = FALSE, 
    two_factor_updated_at = NOW()
WHERE user_id = $1 AND two_factor_auth_type = $2; -- Use $1, $2 placeholders

-- UpdateTwoFactorStatusVerification
-- name: UpdateTwoFactorStatus :exec
UPDATE user_two_factors
SET two_factor_is_active = TRUE, two_factor_updated_at = NOW()
WHERE user_id = $1 AND two_factor_auth_type = $2 AND two_factor_is_active = FALSE; -- Use $1, $2 placeholders

-- VerifyTwoFactor
-- name: VerifyTwoFactor :one
SELECT COUNT(*)
FROM user_two_factors
WHERE user_id = $1 AND two_factor_auth_type = $2 AND two_factor_is_active = TRUE; -- Use $1, $2 placeholders

-- GetTwoFactorStatus
-- name: GetTwoFactorStatus :one
SELECT two_factor_is_active
FROM user_two_factors
WHERE user_id = $1 AND two_factor_auth_type = $2; -- Use $1, $2 placeholders

-- IsTwoFactorEnabled
-- name: IsTwoFactorEnabled :one
SELECT COUNT(*)
FROM user_two_factors
WHERE user_id = $1 AND two_factor_is_active = TRUE; -- Use $1 placeholder

-- AddOrUpdatePhoneNumber
-- name: AddOrUpdatePhoneNumber :exec
-- Assuming a UNIQUE constraint exists on (user_id, two_factor_auth_type) for ON CONFLICT
INSERT INTO user_two_factors (user_id, two_factor_auth_type, two_factor_phone, two_factor_is_active)
VALUES ($1, 'SMS', $2, TRUE) -- Use $1, $2 placeholders, assuming type is SMS
ON CONFLICT (user_id, two_factor_auth_type) DO UPDATE SET 
    two_factor_phone = EXCLUDED.two_factor_phone, 
    two_factor_is_active = TRUE, -- Ensure it stays active on update
    two_factor_updated_at = NOW();

-- AddOrUpdateEmail
-- name: AddOrUpdateEmail :exec
-- Assuming a UNIQUE constraint exists on (user_id, two_factor_auth_type) for ON CONFLICT
INSERT INTO user_two_factors (user_id, two_factor_auth_type, two_factor_email, two_factor_is_active)
VALUES ($1, 'EMAIL', $2, TRUE) -- Use $1, $2 placeholders, assuming type is EMAIL
ON CONFLICT (user_id, two_factor_auth_type) DO UPDATE SET 
    two_factor_email = EXCLUDED.two_factor_email, 
    two_factor_is_active = TRUE, -- Ensure it stays active on update
    two_factor_updated_at = NOW();

-- GetUserTwoFactorMethods
-- name: GetUserTwoFactorMethods :many
SELECT two_factor_id, user_id, two_factor_auth_type, two_factor_auth_secret, 
       two_factor_phone, two_factor_email, 
       two_factor_is_active, two_factor_created_at, two_factor_updated_at
FROM user_two_factors
WHERE user_id = $1; -- Use $1 placeholder

-- ReactivateTwoFactor
-- name: ReactivateTwoFactor :exec
UPDATE user_two_factors
SET two_factor_is_active = TRUE, 
    two_factor_updated_at = NOW()
WHERE user_id = $1 AND two_factor_auth_type = $2; -- Use $1, $2 placeholders

-- RemoveTwoFactor
-- name: RemoveTwoFactor :exec
DELETE FROM user_two_factors
WHERE user_id = $1 AND two_factor_auth_type = $2; -- Use $1, $2 placeholders

-- CountActiveTwoFactorMethods
-- name: CountActiveTwoFactorMethods :one
SELECT COUNT(*)
FROM user_two_factors
WHERE user_id = $1 AND two_factor_is_active = TRUE; -- Use $1 placeholder

-- GetTwoFactorMethodByID
-- name: GetTwoFactorMethodByID :one
SELECT two_factor_id, user_id, two_factor_auth_type, two_factor_auth_secret, 
       two_factor_phone, two_factor_email, 
       two_factor_is_active, two_factor_created_at, two_factor_updated_at
FROM user_two_factors
WHERE two_factor_id = $1; -- Use $1 placeholder

-- GetTwoFactorMethodByIDAndType: select lay email de sen otp
-- name: GetTwoFactorMethodByIDAndType :one
SELECT two_factor_id, user_id, two_factor_auth_type, two_factor_auth_secret, 
       two_factor_phone, two_factor_email, 
       two_factor_is_active, two_factor_created_at, two_factor_updated_at
FROM user_two_factors
WHERE user_id = $1 AND two_factor_auth_type = $2; -- Use $1, $2 placeholders
