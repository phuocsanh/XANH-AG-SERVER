-- name: GetOneUserInfo :one
SELECT user_id, user_account, user_password, user_salt
FROM users
WHERE user_account = $1;

-- name: GetOneUserInfoAdmin :one
SELECT user_id, user_account, user_password, user_salt, user_login_time, user_logout_time, user_login_ip
        ,user_created_at, user_updated_at
FROM users
WHERE user_account = $1;

-- name: CheckUserBaseExists :one
SELECT COUNT(*)
FROM users
WHERE user_account = $1;

-- name: AddUserBase :one
INSERT INTO users (
    user_account, user_password, user_salt, user_created_at, user_updated_at
) VALUES (
    $1, $2, $3, NOW(), NOW()
)
RETURNING user_id;

-- name: LoginUserBase :exec
UPDATE users
SET user_login_time = NOW(), user_login_ip = $1
WHERE user_account = $2 AND user_password = $3;

-- name: LogoutUserBase :exec
UPDATE users
SET user_logout_time = NOW()
WHERE user_account = $1;

