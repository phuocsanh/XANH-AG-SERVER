package auth

import (
	"time"

	"gn-farm-go-server/global"

	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

//"github.com/golang-jwt/jwt"

type PayloadClaims struct {
	jwt.StandardClaims
}

func GenTokenJWT(payload jwt.Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)
	return token.SignedString([]byte(global.Config.JWT.API_SECRET_KEY))
}

// TokenPair chứa cả access token và refresh token
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int // Thời gian hết hạn của access token (giây)
}

// CreateToken tạo access token từ uuidToken
func CreateToken(uuidToken string) (string, error) {
	// 1. Set time expiration
	timeEx := global.Config.JWT.JWT_EXPIRATION
	if timeEx == "" {
		timeEx = "1h"
	}
	expiration, err := time.ParseDuration(timeEx)
	if err != nil {
		return "", err
	}
	now := time.Now()
	expiresAt := now.Add(expiration)
	return GenTokenJWT(&PayloadClaims{
		StandardClaims: jwt.StandardClaims{
			Id:        uuid.New().String(),
			ExpiresAt: expiresAt.Unix(),
			IssuedAt:  now.Unix(),
			Issuer:    "shopdevgo",
			Subject:   uuidToken,
			// Thêm trường để phân biệt đây là access token
			Audience: "access",
		},
	})
}

// CreateTokenPair tạo cả access token và refresh token
func CreateTokenPair(uuidToken string) (TokenPair, error) {
	var result TokenPair
	var err error

	// 1. Tạo access token
	accessTimeEx := global.Config.JWT.JWT_EXPIRATION
	if accessTimeEx == "" {
		accessTimeEx = "1h"
	}
	accessExpiration, err := time.ParseDuration(accessTimeEx)
	if err != nil {
		return result, err
	}

	// 2. Tạo refresh token (thời gian sống lâu hơn, thường là 7-30 ngày)
	refreshTimeEx := "168h" // 7 ngày
	refreshExpiration, err := time.ParseDuration(refreshTimeEx)
	if err != nil {
		return result, err
	}

	now := time.Now()
	accessExpiresAt := now.Add(accessExpiration)
	refreshExpiresAt := now.Add(refreshExpiration)

	// 3. Tạo access token
	result.AccessToken, err = GenTokenJWT(&PayloadClaims{
		StandardClaims: jwt.StandardClaims{
			Id:        uuid.New().String(),
			ExpiresAt: accessExpiresAt.Unix(),
			IssuedAt:  now.Unix(),
			Issuer:    "shopdevgo",
			Subject:   uuidToken,
			Audience:  "access",
		},
	})
	if err != nil {
		return result, err
	}

	// 4. Tạo refresh token
	result.RefreshToken, err = GenTokenJWT(&PayloadClaims{
		StandardClaims: jwt.StandardClaims{
			Id:        uuid.New().String(),
			ExpiresAt: refreshExpiresAt.Unix(),
			IssuedAt:  now.Unix(),
			Issuer:    "shopdevgo",
			Subject:   uuidToken,
			Audience:  "refresh",
		},
	})
	if err != nil {
		return result, err
	}

	// 5. Tính thời gian hết hạn của access token (giây)
	result.ExpiresIn = int(accessExpiration.Seconds())

	return result, nil
}

func ParseJwtTokenSubject(token string) (*jwt.StandardClaims, error) {
	tokenClaims, err := jwt.ParseWithClaims(token, &jwt.StandardClaims{}, func(jwtToken *jwt.Token) (interface{}, error) {
		return []byte(global.Config.JWT.API_SECRET_KEY), nil
	})

	if tokenClaims != nil {
		if claims, ok := tokenClaims.Claims.(*jwt.StandardClaims); ok && tokenClaims.Valid {
			return claims, nil
		}
	}

	return nil, err
}

// validate token

func VerifyTokenSubject(token string) (*jwt.StandardClaims, error) {
	claims, err := ParseJwtTokenSubject(token)
	if err != nil {
		return nil, err
	}
	if err = claims.Valid(); err != nil {
		return nil, err
	}
	return claims, nil
}
