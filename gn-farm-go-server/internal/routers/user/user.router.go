package user

import (
	user "gn-farm-go-server/internal/controller/user"
	"gn-farm-go-server/internal/middlewares"

	"github.com/gin-gonic/gin"
)

type UserRouter struct{}

func (pr *UserRouter) InitUserRouter(Router *gin.RouterGroup) {
	// public router
	// this is non-dependency
	// ur := repo.NewUserRepository()
	// us := service.NewUserService(ur)
	// userHanlderNonDependency := controller.NewUserController(us)
	// WIRE go
	// Dependency Injection (DI) DI java
	userRouterPublic := Router.Group("/user")
	{
		// userRouterPublic.POST("/register", userController.Register) // register -> YES -> No
		userRouterPublic.POST("/register", user.Auth.Register)
		userRouterPublic.POST("/verify-otp", user.Auth.VerifyOTP)
		userRouterPublic.POST("/update-pass-register", user.Auth.UpdatePasswordRegister)
		userRouterPublic.POST("/login", user.Auth.Login) // login -> YES -> No
		userRouterPublic.POST("/refresh-token", user.Auth.RefreshToken) // refresh token
	}
	// private router
	userRouterPrivate := Router.Group("/user")
	userRouterPrivate.Use(middlewares.AuthenMiddleware())
	// userRouterPrivate.Use(limiter())
	// userRouterPrivate.Use(Authen())
	// userRouterPrivate.Use(Permission())
	{
		// Removed GET /get_info as it used the old userController
		userRouterPrivate.POST("/logout", user.Auth.Logout) // Thêm route logout
		userRouterPrivate.POST("/two-factor/setup", user.TwoFA.SetupTwoFactorAuth)
		userRouterPrivate.POST("/two-factor/verify", user.TwoFA.VerifyTwoFactorAuth)
		userRouterPrivate.GET("/list", user.Auth.ListUsers) // Thêm route lấy danh sách user
	}
}
