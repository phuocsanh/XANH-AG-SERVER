package sales

import (
	"strconv"

	"gn-farm-go-server/internal/service"
	salesVO "gn-farm-go-server/internal/vo/sales"
	"gn-farm-go-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var Sales = new(SalesController)

type SalesController struct {
	salesService service.ISalesService
}

func NewSalesController(salesService service.ISalesService) *SalesController {
	return &SalesController{
		salesService: salesService,
	}
}

// SetSalesService cập nhật salesService cho controller
func (c *SalesController) SetSalesService(salesService service.ISalesService) {
	c.salesService = salesService
}

// ===== QUẢN LÝ PHIẾU BÁN HÀNG =====

// CreateSalesInvoice tạo phiếu bán hàng mới
// @Summary      Tạo phiếu bán hàng mới
// @Description  Tạo phiếu bán hàng mới với thông tin chi tiết và danh sách sản phẩm
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        payload body salesVO.CreateSalesInvoiceRequest true "Thông tin phiếu bán hàng"
// @Success      201  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice [post]
func (c *SalesController) CreateSalesInvoice(ctx *gin.Context) {
	var req salesVO.CreateSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Validate items
	if len(req.Items) == 0 {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "Phiếu bán hàng phải có ít nhất một sản phẩm")
		return
	}

	// Lấy userID từ context (JWT token)
	userID := int32(1) // TODO: Lấy từ JWT token trong context

	result, responseData, err := c.salesService.CreateSalesInvoice(ctx, userID, &req)
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

// GetSalesInvoice lấy thông tin phiếu bán hàng theo ID
// @Summary      Lấy thông tin phiếu bán hàng
// @Description  Lấy thông tin chi tiết phiếu bán hàng theo ID, bao gồm danh sách sản phẩm
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id} [get]
func (c *SalesController) GetSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	result, responseData, err := c.salesService.GetSalesInvoice(ctx, int32(id))
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

// GetSalesInvoiceByCode lấy thông tin phiếu bán hàng theo mã phiếu
// @Summary      Lấy thông tin phiếu bán hàng theo mã
// @Description  Lấy thông tin chi tiết phiếu bán hàng theo mã phiếu
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        code path string true "Mã phiếu bán hàng"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/code/{code} [get]
func (c *SalesController) GetSalesInvoiceByCode(ctx *gin.Context) {
	code := ctx.Param("code")
	if code == "" {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "Mã phiếu không được để trống")
		return
	}

	result, responseData, err := c.salesService.GetSalesInvoiceByCode(ctx, code)
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

// ListSalesInvoices lấy danh sách phiếu bán hàng
// @Summary      Lấy danh sách phiếu bán hàng
// @Description  Lấy danh sách phiếu bán hàng với phân trang và lọc theo nhiều tiêu chí
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        page query int false "Số trang" default(1)
// @Param        limit query int false "Số lượng mỗi trang" default(10)
// @Param        status query int false "Trạng thái phiếu (1: Nháp, 2: Đã xác nhận, 3: Đã giao hàng, 4: Hoàn thành, 5: Hủy)"
// @Param        payment_status query int false "Trạng thái thanh toán (1: Chưa thanh toán, 2: Thanh toán một phần, 3: Đã thanh toán đủ)"
// @Param        customer_phone query string false "Số điện thoại khách hàng"
// @Param        from_date query string false "Từ ngày (YYYY-MM-DD)"
// @Param        to_date query string false "Đến ngày (YYYY-MM-DD)"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoices [get]
func (c *SalesController) ListSalesInvoices(ctx *gin.Context) {
	var req salesVO.ListSalesInvoicesRequest
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

	result, responseData, err := c.salesService.ListSalesInvoices(ctx, &req)
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

// UpdateSalesInvoice cập nhật phiếu bán hàng
// @Summary      Cập nhật phiếu bán hàng
// @Description  Cập nhật thông tin phiếu bán hàng (chỉ cho phép khi phiếu ở trạng thái nháp hoặc đã xác nhận)
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Param        payload body salesVO.UpdateSalesInvoiceRequest true "Thông tin cập nhật"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id} [put]
func (c *SalesController) UpdateSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.UpdateSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.UpdateSalesInvoice(ctx, int32(id), &req)
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

// DeleteSalesInvoice xóa phiếu bán hàng
// @Summary      Xóa phiếu bán hàng
// @Description  Xóa phiếu bán hàng (chỉ cho phép khi phiếu ở trạng thái nháp)
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id} [delete]
func (c *SalesController) DeleteSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	responseData, err := c.salesService.DeleteSalesInvoice(ctx, int32(id))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, gin.H{"message": "Xóa phiếu bán hàng thành công"})
}

// ===== CÁC HÀNH ĐỘNG VỚI PHIẾU BÁN HÀNG =====

// ConfirmSalesInvoice xác nhận phiếu bán hàng
// @Summary      Xác nhận phiếu bán hàng
// @Description  Xác nhận phiếu bán hàng và chuyển từ trạng thái nháp sang đã xác nhận
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Param        payload body salesVO.ConfirmSalesInvoiceRequest true "Thông tin xác nhận"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id}/confirm [post]
func (c *SalesController) ConfirmSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.ConfirmSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.ConfirmSalesInvoice(ctx, int32(id), &req)
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

// DeliverSalesInvoice đánh dấu đã giao hàng
// @Summary      Đánh dấu đã giao hàng
// @Description  Đánh dấu phiếu bán hàng đã giao hàng và cập nhật tồn kho
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Param        payload body salesVO.DeliverSalesInvoiceRequest true "Thông tin giao hàng"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id}/deliver [post]
func (c *SalesController) DeliverSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.DeliverSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.DeliverSalesInvoice(ctx, int32(id), &req)
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

// CompleteSalesInvoice hoàn thành phiếu bán hàng
// @Summary      Hoàn thành phiếu bán hàng
// @Description  Đánh dấu phiếu bán hàng hoàn thành và cập nhật trạng thái thanh toán
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Param        payload body salesVO.CompleteSalesInvoiceRequest true "Thông tin hoàn thành"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id}/complete [post]
func (c *SalesController) CompleteSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.CompleteSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.CompleteSalesInvoice(ctx, int32(id), &req)
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

// CancelSalesInvoice hủy phiếu bán hàng
// @Summary      Hủy phiếu bán hàng
// @Description  Hủy phiếu bán hàng và hoàn trả tồn kho nếu đã xuất hàng
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Param        payload body salesVO.CancelSalesInvoiceRequest true "Thông tin hủy phiếu"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id}/cancel [post]
func (c *SalesController) CancelSalesInvoice(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.CancelSalesInvoiceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.CancelSalesInvoice(ctx, int32(id), &req)
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

// ===== QUẢN LÝ CHI TIẾT SẢN PHẨM TRONG PHIẾU =====

// GetSalesInvoiceItems lấy danh sách sản phẩm trong phiếu bán hàng
// @Summary      Lấy danh sách sản phẩm trong phiếu
// @Description  Lấy danh sách chi tiết tất cả sản phẩm của một phiếu bán hàng
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID phiếu bán hàng"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/{id}/items [get]
func (c *SalesController) GetSalesInvoiceItems(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	result, responseData, err := c.salesService.GetSalesInvoiceItems(ctx, int32(id))
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

// UpdateSalesInvoiceItem cập nhật thông tin một sản phẩm trong phiếu
// @Summary      Cập nhật sản phẩm trong phiếu
// @Description  Cập nhật thông tin một sản phẩm trong phiếu bán hàng
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID sản phẩm trong phiếu"
// @Param        payload body salesVO.UpdateSalesInvoiceItemRequest true "Thông tin cập nhật"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/item/{id} [put]
func (c *SalesController) UpdateSalesInvoiceItem(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	var req salesVO.UpdateSalesInvoiceItemRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	result, responseData, err := c.salesService.UpdateSalesInvoiceItem(ctx, int32(id), &req)
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

// DeleteSalesInvoiceItem xóa một sản phẩm khỏi phiếu bán hàng
// @Summary      Xóa sản phẩm khỏi phiếu
// @Description  Xóa một sản phẩm khỏi phiếu bán hàng (chỉ cho phép khi phiếu ở trạng thái nháp)
// @Tags         sales management
// @Accept       json
// @Produce      json
// @Param        id path int true "ID sản phẩm trong phiếu"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /manage/sales/invoice/item/{id} [delete]
func (c *SalesController) DeleteSalesInvoiceItem(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "ID không hợp lệ")
		return
	}

	responseData, err := c.salesService.DeleteSalesInvoiceItem(ctx, int32(id))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	if responseData != nil {
		response.ErrorResponse(ctx, responseData.Code, responseData.Message)
		return
	}

	response.SuccessResponse(ctx, response.ErrCodeSuccess, gin.H{"message": "Xóa sản phẩm khỏi phiếu bán hàng thành công"})
}