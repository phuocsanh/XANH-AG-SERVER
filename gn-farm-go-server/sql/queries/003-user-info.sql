-- name: GetUser :one
SELECT
    user_id,
    user_account,
    user_nickname,
    user_avatar,
    user_state,
    user_mobile,
    user_gender,
    user_birthday,
    user_email,
    user_is_authentication,
    created_at,
    updated_at
FROM user_profiles
WHERE user_id = $1 LIMIT 1;

-- name: GetUsers :many
SELECT user_id,
    user_account,
    user_nickname,
    user_avatar,
    user_state,
    user_mobile,
    user_gender,
    user_birthday,
    user_email,
    user_is_authentication,
    created_at,
    updated_at
FROM user_profiles
WHERE user_id = ANY($1::bigint[]);

-- name: FindUsers :many
SELECT * FROM user_profiles WHERE user_account LIKE $1 OR user_nickname LIKE $2;

-- name: ListUsers :many
SELECT * FROM user_profiles LIMIT $1 OFFSET $2;

-- name: CountUsers :one
SELECT COUNT(*) FROM user_profiles;

-- name: CountUsersWithSearch :one
SELECT COUNT(*) FROM user_profiles WHERE user_account LIKE $1 OR user_nickname LIKE $2;

-- name: ListUsersWithSearch :many
SELECT * FROM user_profiles WHERE user_account LIKE $1 OR user_nickname LIKE $2 LIMIT $3 OFFSET $4;


-- name: RemoveUser :exec
DELETE FROM user_profiles WHERE user_id = $1;


-- -- name: UpdatePassword :exec
-- UPDATE user_profiles SET user_password = $1 WHERE user_id = $2;



-- name: AddUserAutoUserId :execresult
INSERT INTO user_profiles (
    user_account, user_nickname, user_avatar, user_state, user_mobile,
    user_gender, user_birthday, user_email, user_is_authentication
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: AddUserHaveUserId :execresult
INSERT INTO user_profiles (
    user_id, user_account, user_nickname, user_avatar, user_state, user_mobile,
    user_gender, user_birthday, user_email, user_is_authentication
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: EditUserByUserId :execresult
UPDATE user_profiles
SET user_nickname = $1, user_avatar = $2, user_mobile = $3,
user_gender = $4, user_birthday = $5, user_email = $6, updated_at = NOW()
WHERE user_id = $7 AND user_is_authentication = 1;
