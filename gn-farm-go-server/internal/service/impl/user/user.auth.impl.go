package user

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"gn-farm-go-server/global"
	consts "gn-farm-go-server/internal/const"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/model"
	"gn-farm-go-server/internal/utils"
	"gn-farm-go-server/internal/utils/auth"
	"gn-farm-go-server/internal/utils/crypto"
	"gn-farm-go-server/internal/utils/random"
	"gn-farm-go-server/internal/utils/sendto"
	"gn-farm-go-server/internal/vo/user"
	"gn-farm-go-server/pkg/response"

	"github.com/redis/go-redis/v9"
)

// Changed struct name to be exported
type SUserAuth struct {
	// Implement the IUserAuth interface here
	r *database.Queries
}

// Changed constructor name to match exported struct
func NewUserAuthImpl(r *database.Queries) *SUserAuth {
	return &SUserAuth{
		r: r,
	}
}

// ---- TWO FACTOR AUTHEN -----

// Changed receiver to match exported struct name
func (s *SUserAuth) IsTwoFactorEnabled(ctx context.Context, userId int32) (codeResult int, rs bool, err error) {
	count, err := s.r.IsTwoFactorEnabled(ctx, userId)
	if err != nil {
		return response.ErrCodeAuthFailed, false, fmt.Errorf("failed to check 2FA status: %v", err)
	}
	return response.ErrCodeSuccess, count > 0, nil
}

// Changed receiver to match exported struct name
func (s *SUserAuth) SetupTwoFactorAuth(ctx context.Context, in *user.SetupTwoFactorAuthServiceRequest) (codeResult int, err error) {
	// Logic
	// 1. Check isTwoFactorEnabled -> true return
	code, enabled, err := s.IsTwoFactorEnabled(ctx, int32(in.UserId))
	if err != nil {
		return code, err
	}
	if enabled {
		return response.ErrCodeTwoFactorAuthSetupFailed, fmt.Errorf("Two-factor authentication is already enabled")
	}
	// 2. crate new type Authe
	err = s.r.EnableTwoFactorTypeEmail(ctx, database.EnableTwoFactorTypeEmailParams{
		UserID:            int32(in.UserId),
		TwoFactorAuthType: "EMAIL",
		TwoFactorEmail:    sql.NullString{String: in.TwoFactorEmail, Valid: true},
	})
	if err != nil {
		return response.ErrCodeTwoFactorAuthSetupFailed, err
	}

	// 3. send otp to in.TwoFactorEmail
	keyUserTwoFator := crypto.GetHash("2fa:" + strconv.Itoa(int(in.UserId)))
	go global.Rdb.Set(ctx, keyUserTwoFator, "123456", time.Duration(consts.TIME_OTP_REGISTER)*time.Minute).Err()
	// if err != nil {
	// 	return response.ErrCodeTwoFactorAuthSetupFailed, err
	// }
	return response.ErrCodeSuccess, nil
}

// Changed receiver to match exported struct name
func (s *SUserAuth) VerifyTwoFactorAuth(ctx context.Context, in *user.TwoFactorVerificationServiceRequest) (codeResult int, err error) {
	// 1. Check isTwoFactorEnabled
	code, _, err := s.IsTwoFactorEnabled(ctx, int32(in.UserId))
	if err != nil {
		return code, err
	}
	// Check if it's already enabled/verified, logic might need adjustment based on exact requirements
	// if enabled {
	// 	return response.ErrCodeTwoFactorAuthVerifyFailed, fmt.Errorf("Two-factor authentication is already verified/enabled")
	// }

	// 2. Check Otp in redis avaible
	keyUserTwoFator := crypto.GetHash("2fa:" + strconv.Itoa(int(in.UserId)))
	otpVerifyAuth, err := global.Rdb.Get(ctx, keyUserTwoFator).Result()
	if err == redis.Nil {
		return response.ErrCodeTwoFactorAuthVerifyFailed, fmt.Errorf("Key %s does not exists or OTP expired", keyUserTwoFator)
	} else if err != nil {
		return response.ErrCodeTwoFactorAuthVerifyFailed, err
	}
	// 3. check otp
	if otpVerifyAuth != in.TwoFactorCode {
		return response.ErrCodeTwoFactorAuthVerifyFailed, fmt.Errorf("OTP does not match")
	}

	// 4. udpoate status to active
	err = s.r.UpdateTwoFactorStatus(ctx, database.UpdateTwoFactorStatusParams{
		UserID:            int32(in.UserId),
		TwoFactorAuthType: "EMAIL",
	})
	if err != nil {
		return response.ErrCodeTwoFactorAuthVerifyFailed, err
	}
	// 5. remove otp
	_, err = global.Rdb.Del(ctx, keyUserTwoFator).Result()
	if err != nil {
		// Log the error but potentially allow proceeding as the main verification succeeded
		log.Printf("Warning: Failed to delete OTP key %s from Redis: %v", keyUserTwoFator, err)
	}
	return response.ErrCodeSuccess, nil
}

// ---- END TWO FACTOR AUTHEN ----

// Changed receiver to match exported struct name
func (s *SUserAuth) Login(ctx context.Context, in *user.LoginRequest) (codeResult int, out user.LoginResponse, err error) {
	fmt.Println("Login called with userAccount:", in.UserAccount, "and userPassword:", in.UserPassword)
	// 1. logic login
	userBase, err := s.r.GetOneUserInfo(ctx, in.UserAccount)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.ErrCodeAuthFailed, out, fmt.Errorf("user not found")
		}
		return response.ErrCodeAuthFailed, out, err
	}
	// 2. check password?
	if !crypto.MatchingPassword(userBase.UserPassword, in.UserPassword, userBase.UserSalt) {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("does not match password")
	}
	// 3. check two-factor authentication
	code, isTwoFactorEnable, err := s.IsTwoFactorEnabled(ctx, userBase.UserID)
	if err != nil {
		return code, out, fmt.Errorf("failed to check 2fa status: %v", err)
	}

	if isTwoFactorEnable {
		// sen otp to in.TwoFactorEmail
		keyUserLoginTwoFactor := crypto.GetHash("2fa:otp:" + strconv.Itoa(int(userBase.UserID)))
		otpCode := "111111" // Consider generating a real OTP
		err = global.Rdb.SetEx(ctx, keyUserLoginTwoFactor, otpCode, time.Duration(consts.TIME_OTP_REGISTER)*time.Minute).Err()
		if err != nil {
			return response.ErrCodeAuthFailed, out, fmt.Errorf("set otp redis failed: %v", err)
		}
		// send otp via twofactorEmail
		// get email 2fa
		infoUserTwoFactor, err := s.r.GetTwoFactorMethodByIDAndType(ctx, database.GetTwoFactorMethodByIDAndTypeParams{
			UserID:            userBase.UserID,
			TwoFactorAuthType: "EMAIL",
		})
		if err != nil {
			return response.ErrCodeAuthFailed, out, fmt.Errorf("get two factor method failed: %v", err)
		}
		if !infoUserTwoFactor.TwoFactorEmail.Valid {
			return response.ErrCodeAuthFailed, out, fmt.Errorf("2FA email not configured for user")
		}
		// go sendto.SendEmailToJavaByAPI()
		log.Println("send OTP 2FA to Email::", infoUserTwoFactor.TwoFactorEmail.String)
		go sendto.SendTextEmailOtp([]string{infoUserTwoFactor.TwoFactorEmail.String}, consts.HOST_EMAIL, otpCode)

		out.Message = "send OTP 2FA to Email, pls het OTP by Email.."
		// Indicate that 2FA is required
		// You might want a specific response code for this
		// return response.ErrCodeTwoFactorAuthRequired, out, nil // Temporarily commented out - Define ErrCodeTwoFactorAuthRequired
		return response.ErrCodeSuccess, out, fmt.Errorf("2FA OTP sent, verification required") // Returning success but indicating next step
	}
	// 4. update login time (Consider if password needs update here - seems LoginUserBase takes password)
	go s.r.LoginUserBase(ctx, database.LoginUserBaseParams{
		UserLoginIp: sql.NullString{String: "127.0.0.1", Valid: true},
		UserAccount: in.UserAccount,
		// UserPassword: userBase.UserPassword, // Pass the correct hashed password if needed, or remove if not updated
	})

	// 5. Create UUID User
	subToken := utils.GenerateCliTokenUUID(int(userBase.UserID))
	log.Println("subtoken:", subToken)
	// 6. get user_info table
	infoUser, err := s.r.GetUser(ctx, int64(userBase.UserID))
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to get user info: %v", err)
	}
	// convert to json
	infoUserJson, err := json.Marshal(infoUser)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("convert to json failed: %v", err)
	}
	// 7. give infoUserJson to redis with key = subToken
	err = global.Rdb.Set(ctx, subToken, infoUserJson, time.Duration(consts.TIME_2FA_OTP_REGISTER)*time.Minute).Err()
	if err != nil {
		return response.ErrCodeAuthFailed, out, err
	}

	// 8. create token pair (access token và refresh token)
	tokenPair, err := auth.CreateTokenPair(subToken)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to create token pair: %v", err)
	}

	// 9. Lấy thông tin người dùng từ Redis
	userInfoStr, err := global.Rdb.Get(ctx, subToken).Result()
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to get user info: %v", err)
	}

	// Parse thông tin người dùng
	var userInfo map[string]interface{}
	err = json.Unmarshal([]byte(userInfoStr), &userInfo)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to parse user info: %v", err)
	}

	// 10. Gán giá trị vào output theo cấu trúc mới
	// Thông tin người dùng
	userIdInt, _ := userInfo["user_id"].(float64)
	out.User.UserID = int64(userIdInt)
	out.User.UserAccount = fmt.Sprintf("%v", userInfo["user_account"])
	out.User.UserEmail = fmt.Sprintf("%v", userInfo["user_account"]) // Tạm thời dùng account làm email

	// Thông tin token
	out.Tokens.AccessToken = tokenPair.AccessToken
	out.Tokens.RefreshToken = tokenPair.RefreshToken

	// Thông tin khác
	out.ExpiresIn = tokenPair.ExpiresIn
	out.Message = "Login successful"

	return response.ErrCodeSuccess, out, nil
}

// Changed receiver to match exported struct name
func (s *SUserAuth) Register(ctx context.Context, in *user.RegisterRequest) (codeResult int, err error) {
	// logic
	// 1. hash email
	fmt.Printf("VerifyKey: %s\n", in.VerifyKey)
	fmt.Printf("VerifyType: %d\n", in.VerifyType)
	hashKey := crypto.GetHash(strings.ToLower(in.VerifyKey))
	fmt.Printf("hashKey: %s\n", hashKey)

	// 2. check user exists in user base
	userFound, err := s.r.CheckUserBaseExists(ctx, in.VerifyKey)
	if err != nil {
		// Consider returning a different error code for DB errors vs user exists
		return response.ErrCodeUserHasExists, fmt.Errorf("error checking user existence: %v", err)
	}

	if userFound > 0 {
		return response.ErrCodeUserHasExists, fmt.Errorf("user has already registered")
	}

	// 3. Generate OTP (Removed check for existing OTP in Redis)
	otpNew := random.GenerateSixDigitOtp()
	if in.VerifyPurpose == "TEST_USER" {
		otpNew = 123456
	}
	fmt.Printf("Otp is :::%d\n", otpNew)
	fmt.Print("SENDGRID_API_KEY",os.Getenv("SENDGRID_API_KEY"))
	// 4. Send OTP based on type
	switch in.VerifyType {
	case consts.EMAIL:
		// Attempt to send email first
		otpString := strconv.Itoa(otpNew)
		// err = sendto.SendTextEmailOtp([]string{in.VerifyKey}, os.Getenv("SENDER_EMAIL"), otpString)
		// if err != nil {
		// 	// Don't save OTP if sending failed
		// 	return response.ErrSendEmailOtp, fmt.Errorf("failed to send email OTP: %v", err)
		// }

		// 5. If email sending was successful, THEN save OTP to Redis and DB
		userKey := utils.GetUserKey(hashKey)
		err = global.Rdb.SetEx(ctx, userKey, otpString, time.Duration(consts.TIME_OTP_REGISTER)*time.Minute).Err()
		if err != nil {
			// Log error, but potentially proceed with DB insert? Or return error?
			// Let's return an error for consistency, as OTP verification relies on Redis.
			log.Printf("Error saving OTP to Redis after successful send: %v", err)
			return response.ErrInvalidOTP, fmt.Errorf("failed to save OTP to cache: %v", err)
		}

		// 6. Check if verify_key already exists in user_verifications table
		existingOTPCount, err := s.r.GetOTPByVerifyKey(ctx, in.VerifyKey)
		if err != nil {
			log.Printf("Error checking existing OTP record: %v", err)
			return response.ErrSendEmailOtp, fmt.Errorf("failed to check existing OTP record: %v", err)
		}

		if existingOTPCount > 0 {
			// If verify_key already exists, update the existing record instead of inserting a new one
			err = s.r.UpdateOTPByVerifyKey(ctx, database.UpdateOTPByVerifyKeyParams{
				VerifyOtp:     otpString,
				VerifyType:    sql.NullInt32{Int32: int32(in.VerifyType), Valid: true},
				VerifyKey:     in.VerifyKey,
				VerifyKeyHash: hashKey,
			})
			if err != nil {
				log.Printf("Error updating OTP record: %v", err)
				return response.ErrSendEmailOtp, fmt.Errorf("failed to update OTP record: %v", err)
			}
			log.Println("Updated existing OTP record for verify_key:", in.VerifyKey)
		} else {
			// If verify_key doesn't exist, insert a new record
			result, err := s.r.InsertOTPVerify(ctx, database.InsertOTPVerifyParams{
				VerifyOtp:     otpString,
				VerifyType:    sql.NullInt32{Int32: int32(in.VerifyType), Valid: true},
				VerifyKey:     in.VerifyKey,
				VerifyKeyHash: hashKey,
			})
			if err != nil {
				// Consider deleting the Redis key if DB insert fails?
				log.Printf("Error saving OTP to DB after successful send and Redis save: %v", err)
				return response.ErrSendEmailOtp, fmt.Errorf("failed to save OTP record: %v", err) // Using ErrSendEmailOtp might be confusing, consider a DB error code
			}

			// Log last insert ID (optional, depends on if LastInsertId is reliable)
			lastIdVerifyUser, errId := result.LastInsertId()
			if errId != nil {
				log.Printf("Warning: could not get last insert ID for OTP verify: %v", errId)
			}
			log.Println("lastIdVerifyUser", lastIdVerifyUser)
		}

		return response.ErrCodeSuccess, nil

	case consts.MOBILE:
		// TODO: Implement OTP sending via SMS
		// If SMS sending succeeds, save to Redis and DB similar to email
		return response.ErrCodeSuccess, fmt.Errorf("SMS OTP not implemented") // Placeholder
	default:
		return response.ErrCodeParamInvalid, fmt.Errorf("invalid verify type specified")
	}

	// This line should not be reached due to switch cases returning
	// return response.ErrCodeSuccess, nil
}

// Changed receiver to match exported struct name
func (s *SUserAuth) VerifyOTP(ctx context.Context, in *user.VerifyOTPRequest) (out user.VerifyOTPResponse, err error) {
	// logic
	hashKey := crypto.GetHash(strings.ToLower(in.VerifyKey))

	// get otp
	otpFound, err := global.Rdb.Get(ctx, utils.GetUserKey(hashKey)).Result()
	if err != nil {
		return out, err
	}
	if in.VerifyCode != otpFound {
		// Neu nhu ma sai 3 lan trong vong 1 phut??

		return out, fmt.Errorf("OTP not match")
	}
	infoOTP, err := s.r.GetInfoOTP(ctx, hashKey)
	if err != nil {
		return out, err
	}
	// uopdate status verified
	err = s.r.UpdateUserVerificationStatus(ctx, hashKey)
	if err != nil {
		return out, err
	}

	// Giữ lại các trường cũ để tương thích ngược
	out.VerifyToken = infoOTP.VerifyKeyHash

	// Thêm thông tin theo cấu trúc mới
	// Thông tin người dùng
	out.User.UserID = 0 // Chưa có ID người dùng vì chưa tạo tài khoản
	out.User.UserAccount = in.VerifyKey
	out.User.UserEmail = in.VerifyKey

	// Thông tin token (chưa có token thực sự vì chưa đăng nhập)
	out.Tokens.AccessToken = infoOTP.VerifyKeyHash // Tạm thời dùng verify token
	out.Tokens.RefreshToken = ""

	out.ExpiresIn = consts.TIME_OTP_REGISTER
	out.Message = "OTP verified successfully"

	return out, err
}

// Changed receiver to match exported struct name
func (s *SUserAuth) UpdatePasswordRegister(ctx context.Context, token string, password string) (codeResult int, userId int64, err error) {
	// Log token for debugging
	log.Printf("UpdatePasswordRegister called with token: %s", token)

	// 1. token is already verified : user_verify table
	infoOTP, err := s.r.GetInfoOTP(ctx, token)
	if err != nil {
		// Log the error for debugging
		log.Printf("Error in GetInfoOTP: %v", err)
		// Return specific error code, 0 for userId, and the original error
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("failed to get OTP info: %v", err)
	}
	// 1 check isVerified OK
	// Check if IsVerified is Null or 0 (assuming it might be sql.NullInt32)
	if !infoOTP.IsVerified.Valid || infoOTP.IsVerified.Int32 == 0 {
		// Return specific error code, 0 for userId, and a new error message
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("user OTP not verified")
	}
	// 2. check token is exists in user_base
	//update user_base table
	log.Println("infoOTP::", infoOTP)
	userBase := database.AddUserBaseParams{}
	userBase.UserAccount = infoOTP.VerifyKey
	userSalt, err := crypto.GenerateSalt(16)
	if err != nil {
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("failed to generate salt: %v", err)
	}
	userBase.UserSalt = userSalt
	userBase.UserPassword = crypto.HashPassword(password, userSalt)

	// add userBase to user_base table and get the returned user_id
	// AddUserBase now returns the user_id directly (int32 based on SERIAL type)
	newUserBaseID, err := s.r.AddUserBase(ctx, userBase)
	log.Println("AddUserBase returned ID:", newUserBaseID)
	if err != nil {
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("failed to add user base: %v", err)
	}
	// Cast the returned ID (int32) to int64 for further use
	userId = int64(newUserBaseID)

	if userId == 0 { // Check if we got a valid ID
		// This check might be redundant if AddUserBase errors out on failure
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("failed to get valid user ID after insert")
	}

	// add user_id to user_info table (expects int64)
	_, err = s.r.AddUserHaveUserId(ctx, database.AddUserHaveUserIdParams{
		UserID:               userId, // Pass int64 directly
		UserAccount:          infoOTP.VerifyKey,
		UserNickname:         sql.NullString{String: infoOTP.VerifyKey, Valid: true},
		UserAvatar:           sql.NullString{String: "", Valid: true},
		UserState:            1, // Assuming 1 means active
		UserMobile:           sql.NullString{String: "", Valid: true},
		UserGender:           sql.NullInt16{Int16: 0, Valid: true}, // Assuming 0 means secret
		UserBirthday:         sql.NullTime{Time: time.Time{}, Valid: false},
		UserEmail:            sql.NullString{String: infoOTP.VerifyKey, Valid: true},
		UserIsAuthentication: 1, // Assuming 1 means pending/authenticated after register
	})
	if err != nil {
		// Consider cleanup if this fails (delete from user_base?)
		return response.ErrCodeUserOtpNotExists, 0, fmt.Errorf("failed to add user info: %v", err)
	}

	// AddUserHaveUserId returns execresult, so LastInsertId is likely not applicable here either.
	// The user_id we need is the one from the user_base insert.

	return response.ErrCodeSuccess, userId, nil // Return success code, userId, and nil error
}
// RefreshToken refreshes an access token using a refresh token
func (s *SUserAuth) RefreshToken(ctx context.Context, refreshToken string) (codeResult int, out user.RefreshTokenResponse, err error) {
	// 1. Verify the refresh token
	claims, err := auth.VerifyTokenSubject(refreshToken)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("invalid refresh token: %v", err)
	}

	// 2. Get the subject (UUID) from the token
	subToken := claims.Subject

	// 3. Check if the user info exists in Redis
	exists, err := global.Rdb.Exists(ctx, subToken).Result()
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to check user info: %v", err)
	}

	if exists == 0 {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("user session expired or not found")
	}

	// 4. Create a new token pair
	tokenPair, err := auth.CreateTokenPair(subToken)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to create token pair: %v", err)
	}

	// 5. Lấy thông tin người dùng từ Redis
	userInfoStr, err := global.Rdb.Get(ctx, subToken).Result()
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to get user info: %v", err)
	}

	// Parse thông tin người dùng
	var userInfo map[string]interface{}
	err = json.Unmarshal([]byte(userInfoStr), &userInfo)
	if err != nil {
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to parse user info: %v", err)
	}

	// 6. Gán giá trị vào output theo cấu trúc mới
	// Thông tin người dùng
	userIdFloat, _ := userInfo["user_id"].(float64)
	out.User.UserID = int64(userIdFloat)
	out.User.UserAccount = fmt.Sprintf("%v", userInfo["user_account"])
	out.User.UserEmail = fmt.Sprintf("%v", userInfo["user_account"]) // Tạm thời dùng account làm email

	// Thông tin token
	out.Tokens.AccessToken = tokenPair.AccessToken
	out.Tokens.RefreshToken = tokenPair.RefreshToken

	// Thông tin khác
	out.ExpiresIn = tokenPair.ExpiresIn
	out.Message = "Token refreshed successfully"

	return response.ErrCodeSuccess, out, nil
}

// Logout đăng xuất người dùng
func (s *SUserAuth) Logout(ctx context.Context, token string) (codeResult int, out user.LogoutResponse, err error) {
	// 1. Verify the token
	claims, err := auth.VerifyTokenSubject(token)
	if err != nil {
		out.Success = false
		out.Message = "Invalid token"
		return response.ErrCodeAuthFailed, out, fmt.Errorf("invalid token: %v", err)
	}

	// 2. Get the subject (UUID) from the token
	subToken := claims.Subject

	// 3. Check if the user info exists in Redis
	exists, err := global.Rdb.Exists(ctx, subToken).Result()
	if err != nil {
		out.Success = false
		out.Message = "Failed to check user session"
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to check user info: %v", err)
	}

	if exists == 0 {
		// Người dùng đã đăng xuất hoặc phiên đã hết hạn
		out.Success = true
		out.Message = "Already logged out or session expired"
		return response.ErrCodeSuccess, out, nil
	}

	// 4. Delete the user info from Redis
	_, err = global.Rdb.Del(ctx, subToken).Result()
	if err != nil {
		out.Success = false
		out.Message = "Failed to logout"
		return response.ErrCodeAuthFailed, out, fmt.Errorf("failed to delete user session: %v", err)
	}

	// 5. Set output values
	out.Success = true
	out.Message = "Logged out successfully"

	return response.ErrCodeSuccess, out, nil
}

// ListUsers lấy danh sách user có phân trang và tìm kiếm theo tên
func (s *SUserAuth) ListUsers(ctx context.Context, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[database.UserProfile], err error) {
	// Validate input
	input.Validate()

	var users []database.UserProfile
	var total int64

	// Optimize: Use single conditional query instead of separate if/else blocks
	if input.Search != "" {
		// Search users by account or nickname
		searchPattern := "%" + input.Search + "%"

		// Get total count with search
		total, err = s.r.CountUsersWithSearch(ctx, database.CountUsersWithSearchParams{
			UserAccount:  searchPattern,
			UserNickname: sql.NullString{String: searchPattern, Valid: true},
		})
		if err != nil {
			return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to count users with search: %w", err)
		}

		// Get users with search
		users, err = s.r.ListUsersWithSearch(ctx, database.ListUsersWithSearchParams{
			UserAccount:  searchPattern,
			UserNickname: sql.NullString{String: searchPattern, Valid: true},
			Limit:        int32(input.PageSize),
			Offset:       int32(input.CalculateOffset()),
		})
		if err != nil {
			return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to list users with search: %w", err)
		}
	} else {
		// Get all users without search
		total, err = s.r.CountUsers(ctx)
		if err != nil {
			return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to count users: %w", err)
		}

		// Get users without search
		users, err = s.r.ListUsers(ctx, database.ListUsersParams{
			Limit:  int32(input.PageSize),
			Offset: int32(input.CalculateOffset()),
		})
		if err != nil {
			return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to list users: %w", err)
		}
	}

	// Create paginated response using SQLC best practice (slice of values)
	paginatedResponse := model.NewPaginatedResponse(users, *input, total, "Users retrieved successfully")
	return response.ErrCodeSuccess, &paginatedResponse, nil
}

// auto-reload trigger

// reload test Tue Apr 29 22:16:04 +07 2025
// AUTO-RELOAD TEST Tue Apr 29 22:19:23 +07 2025
