package routers

import (
	"gn-farm-go-server/internal/controller"
	"gn-farm-go-server/internal/routers/manage"
	"gn-farm-go-server/internal/routers/product"
	"gn-farm-go-server/internal/routers/user"
	"log"

	"github.com/gin-gonic/gin"
)

// Router chứa tất cả các router
var Router *gin.Engine

// InitRouter khởi tạo tất cả các router
func InitRouter(
	pongController *controller.PongController,
	userRouter *user.UserRouter,
	productRouter *product.ProductRouter,
	manageRouterGroup *manage.ManageRouterGroup,
	uploadRouter *UploadRouter,
) *gin.Engine {
	r := gin.Default()

	// Health check route
	r.GET("/ping", pongController.Pong)

	// API v1 group
	v1 := r.Group("/v1")
	{
		// Health check route in v1
		v1.GET("/ping", pongController.Pong)

		// Khởi tạo các router
		userRouter.InitUserRouter(v1)
		productRouter.InitProductRouter(v1)
		
		// Khởi tạo manage router
		manageRouterGroup.ProductManageRouter.InitProductManageRouter(v1)

		// Khởi tạo inventory router với xử lý lỗi
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Lỗi khi khởi tạo inventory router: %v", r)
				}
			}()
			
			log.Println("INIT: Đang khởi tạo inventory router...")
			manageRouterGroup.InventoryManageRouter.InitInventoryManageRouter(v1)
			log.Println("INIT: Đã khởi tạo inventory router thành công")
		}()
		
		// Khởi tạo sales router với xử lý lỗi
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Lỗi khi khởi tạo sales router: %v", r)
				}
			}()
			
			log.Println("INIT: Đang khởi tạo sales router...")
			manageRouterGroup.SalesManageRouter.InitSalesManageRouter(v1)
			log.Println("INIT: Đã khởi tạo sales router thành công")
		}()

		// Khởi tạo upload router
		uploadRouterGroup := UploadRouterGroup
		uploadRouterGroup.InitUploadRouter(v1)
	}

	Router = r
	return r
}
