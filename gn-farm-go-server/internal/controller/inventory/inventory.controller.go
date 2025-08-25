package inventory

import (
	"strconv"

	"gn-farm-go-server/internal/service"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var Inventory = new(InventoryController)

type InventoryController struct {
	inventoryService service.IInventoryService
}

func NewInventoryController(inventoryService service.IInventoryService) *InventoryController {
	return &InventoryController{
		inventoryService: inventoryService,
	}
}

// CreateInventoryReceipt tạo phiếu nhập kho mới
// @Summary      Tạo phiếu nhập kho mới
// @Description  Tạo phiếu nhập kho mới với thông tin chi tiết
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        payload body inventoryVO.CreateInventoryReceiptRequest true "Thông tin phiếu nhập kho"
// @Success      201  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt [post]
func (c *InventoryController) CreateInventoryReceipt(ctx *gin.Context) {
	var req inventoryVO.CreateInventoryReceiptRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Lấy userID từ context (JWT token)
	userID := int32(1) // TODO: Lấy từ JWT token trong context

	result, responseData, err := c.inventoryService.CreateInventoryReceipt(ctx, userID, &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// GetInventoryReceipt lấy thông tin phiếu nhập kho theo ID
// @Summary      Lấy thông tin phiếu nhập kho
// @Description  Lấy thông tin chi tiết phiếu nhập kho theo ID
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id} [get]
func (c *InventoryController) GetInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	result, responseData, err := c.inventoryService.GetInventoryReceipt(ctx, int32(id))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// GetInventoryReceiptByCode lấy thông tin phiếu nhập kho theo mã phiếu
// @Summary      Lấy thông tin phiếu nhập kho theo mã
// @Description  Lấy thông tin chi tiết phiếu nhập kho theo mã phiếu
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        code path string true "Mã phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/code/{code} [get]
func (c *InventoryController) GetInventoryReceiptByCode(ctx *gin.Context) {
	code := ctx.Param("code")
	if code == "" {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "Mã phiếu không được để trống")
		return
	}

	result, responseData, err := c.inventoryService.GetInventoryReceiptByCode(ctx, code)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// ListInventoryReceipts lấy danh sách phiếu nhập kho
// @Summary      Lấy danh sách phiếu nhập kho
// @Description  Lấy danh sách phiếu nhập kho với phân trang và lọc
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        page query int false "Số trang" default(1)
// @Param        limit query int false "Số lượng mỗi trang" default(10)
// @Param        status query string false "Trạng thái phiếu" Enums(DRAFT, APPROVED, COMPLETED, CANCELLED)
// @Param        supplier query string false "Nhà cung cấp"
// @Param        created_by query int false "ID người tạo"
// @Param        from_date query string false "Từ ngày (YYYY-MM-DD)"
// @Param        to_date query string false "Đến ngày (YYYY-MM-DD)"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt [get]
func (c *InventoryController) ListInventoryReceipts(ctx *gin.Context) {
	var req inventoryVO.ListInventoryReceiptsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Set default values
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	result, responseData, err := c.inventoryService.ListInventoryReceipts(ctx, &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// UpdateInventoryReceipt cập nhật phiếu nhập kho
// @Summary      Cập nhật phiếu nhập kho
// @Description  Cập nhật thông tin phiếu nhập kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Param        payload body inventoryVO.UpdateInventoryReceiptRequest true "Thông tin cập nhật"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id} [put]
func (c *InventoryController) UpdateInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req inventoryVO.UpdateInventoryReceiptRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.inventoryService.UpdateInventoryReceipt(ctx, int32(id), &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// DeleteInventoryReceipt xóa phiếu nhập kho
// @Summary      Xóa phiếu nhập kho
// @Description  Xóa phiếu nhập kho (chỉ được phép xóa phiếu ở trạng thái DRAFT)
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id} [delete]
func (c *InventoryController) DeleteInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	responseData, err := c.inventoryService.DeleteInventoryReceipt(ctx, int32(id))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, "Xóa phiếu nhập kho thành công")
}

// ApproveInventoryReceipt duyệt phiếu nhập kho
// @Summary      Duyệt phiếu nhập kho
// @Description  Duyệt phiếu nhập kho từ trạng thái DRAFT sang APPROVED
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Param        payload body inventoryVO.ApproveReceiptRequest true "Thông tin duyệt phiếu"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id}/approve [post]
func (c *InventoryController) ApproveInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req inventoryVO.ApproveReceiptRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.inventoryService.ApproveInventoryReceipt(ctx, int32(id), &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// CompleteInventoryReceipt hoàn thành phiếu nhập kho
// @Summary      Hoàn thành phiếu nhập kho
// @Description  Hoàn thành phiếu nhập kho và cập nhật tồn kho sản phẩm
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id}/complete [post]
func (c *InventoryController) CompleteInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	// Lấy userID từ context (JWT token)
	userID := int32(1) // TODO: Lấy từ JWT token trong context

	result, responseData, err := c.inventoryService.CompleteInventoryReceipt(ctx, int32(id), userID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// CancelInventoryReceipt hủy phiếu nhập kho
// @Summary      Hủy phiếu nhập kho
// @Description  Hủy phiếu nhập kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{id}/cancel [post]
func (c *InventoryController) CancelInventoryReceipt(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Lấy userID từ context (JWT token)
	userID := int32(1) // TODO: Lấy từ JWT token trong context

	result, responseData, err := c.inventoryService.CancelInventoryReceipt(ctx, int32(id), userID, req.Reason)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// GetInventoryReceiptItems lấy danh sách sản phẩm trong phiếu nhập
// @Summary      Lấy danh sách sản phẩm trong phiếu nhập
// @Description  Lấy danh sách chi tiết sản phẩm trong phiếu nhập kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        receipt_id path int true "ID phiếu nhập kho"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt/{receipt_id}/items [get]
func (c *InventoryController) GetInventoryReceiptItems(ctx *gin.Context) {
	receiptIDStr := ctx.Param("receipt_id")
	receiptID, err := strconv.ParseInt(receiptIDStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID phiếu nhập không hợp lệ")
		return
	}

	result, responseData, err := c.inventoryService.GetInventoryReceiptItems(ctx, int32(receiptID))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// UpdateInventoryReceiptItem cập nhật sản phẩm trong phiếu nhập
// @Summary      Cập nhật sản phẩm trong phiếu nhập
// @Description  Cập nhật thông tin sản phẩm trong phiếu nhập kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID chi tiết phiếu nhập"
// @Param        payload body inventoryVO.UpdateInventoryReceiptItemRequest true "Thông tin cập nhật"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt-item/{id} [put]
func (c *InventoryController) UpdateInventoryReceiptItem(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req inventoryVO.UpdateInventoryReceiptItemRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.inventoryService.UpdateInventoryReceiptItem(ctx, int32(id), &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// DeleteInventoryReceiptItem xóa sản phẩm khỏi phiếu nhập
// @Summary      Xóa sản phẩm khỏi phiếu nhập
// @Description  Xóa sản phẩm khỏi phiếu nhập kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID chi tiết phiếu nhập"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/receipt-item/{id} [delete]
func (c *InventoryController) DeleteInventoryReceiptItem(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	responseData, err := c.inventoryService.DeleteInventoryReceiptItem(ctx, int32(id))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, "Xóa sản phẩm khỏi phiếu nhập thành công")
}

// ProcessStockIn xử lý nhập kho với tính giá trung bình gia quyền
// @Summary      Nhập kho sản phẩm
// @Description  Nhập kho sản phẩm với tính toán giá trung bình gia quyền và cập nhật tồn kho
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        payload body inventoryVO.StockInRequest true "Thông tin nhập kho"
// @Success      201  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/stock-in [post]
func (c *InventoryController) ProcessStockIn(ctx *gin.Context) {
	var req inventoryVO.StockInRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Lấy userID từ context (JWT token)
	userID := int32(1) // TODO: Lấy từ JWT token trong context
	req.CreatedByUserID = userID

	result, responseData, err := c.inventoryService.ProcessStockIn(ctx, &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// GetInventoryHistory lấy lịch sử tồn kho
// @Summary      Lấy lịch sử tồn kho
// @Description  Lấy lịch sử thay đổi tồn kho của sản phẩm
// @Tags         inventory management
// @Accept       json
// @Produce      json
// @Param        product_id query int true "ID sản phẩm"
// @Param        page query int false "Số trang" default(1)
// @Param        limit query int false "Số lượng mỗi trang" default(10)
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/inventory/history [get]
func (c *InventoryController) GetInventoryHistory(ctx *gin.Context) {
	var req inventoryVO.GetInventoryHistoryRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Nếu có path param product_id, ưu tiên sử dụng path param
	if productIDStr := ctx.Param("product_id"); productIDStr != "" {
		productID, err := strconv.ParseInt(productIDStr, 10, 32)
		if err != nil {
			response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID sản phẩm không hợp lệ")
			return
		}
		req.ProductID = int32(productID)
	}

	if req.ProductID <= 0 {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID sản phẩm không hợp lệ")
		return
	}

	// Set default values
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	result, responseData, err := c.inventoryService.GetInventoryHistory(ctx, &req)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}
