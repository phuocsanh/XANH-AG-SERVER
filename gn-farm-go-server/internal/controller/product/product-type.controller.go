package product

import (
	"strconv"

	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/vo/product"
	"gn-farm-go-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	ProductType           = new(productTypeController)
	ProductSubtype        = new(productSubtypeController)
	ProductSubtypeRelation = new(productSubtypeRelationController)
)

type productTypeController struct{}

// CreateProductType creates a new product type
// @Summary      Create a new product type
// @Description  Create a new product type with the provided details
// @Tags         product type management
// @Accept       json
// @Produce      json
// @Param        payload body product.ProductTypeRequest true "Product type details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type [post]
func (c *productTypeController) CreateProductType(ctx *gin.Context) {
	var req product.ProductTypeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	codeRs, dataRs, err := service.ProductType.CreateProductType(ctx, &req)
	if err != nil {
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, codeRs, dataRs)
}

// GetProductType retrieves a product type by ID
// @Summary      Get a product type by ID
// @Description  Get detailed information about a product type by its ID
// @Tags         product type management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Type ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type/{id} [get]
func (c *productTypeController) GetProductType(ctx *gin.Context) {
	var params struct {
		ID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	codeRs, dataRs, err := service.ProductType.GetProductType(ctx, params.ID)
	if err != nil {
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, codeRs, dataRs)
}

// ListProductTypes retrieves a list of product types
// @Summary      List product types
// @Description  Get a list of all product types
// @Tags         product type management
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type [get]
func (c *productTypeController) ListProductTypes(ctx *gin.Context) {
	codeRs, dataRs, err := service.ProductType.ListProductTypes(ctx)
	if err != nil {
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItems(ctx, codeRs, dataRs)
}

// UpdateProductType updates an existing product type
// @Summary      Update a product type
// @Description  Update an existing product type with the provided details
// @Tags         product type management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Type ID" example:1
// @Param        payload body product.ProductTypeRequest true "Updated product type details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type/{id} [put]
func (c *productTypeController) UpdateProductType(ctx *gin.Context) {
	var req product.ProductTypeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	var params struct {
		ID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	codeRs, dataRs, err := service.ProductType.UpdateProductType(ctx, params.ID, &req)
	if err != nil {
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, codeRs, dataRs)
}

// DeleteProductType deletes a product type
// @Summary      Delete a product type
// @Description  Delete a product type by its ID
// @Tags         product type management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Type ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type/{id} [delete]
func (c *productTypeController) DeleteProductType(ctx *gin.Context) {
	var params struct {
		ID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	codeRs, err := service.ProductType.DeleteProductType(ctx, params.ID)
	if err != nil {
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, codeRs, gin.H{"message": "Product type deleted successfully"})
}

type productSubtypeController struct{}

// CreateProductSubtype creates a new product subtype
// @Summary      Create a new product subtype
// @Description  Create a new product subtype with the provided details
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        payload body product.ProductSubtypeRequest true "Product subtype details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype [post]
func (c *productSubtypeController) CreateProductSubtype(ctx *gin.Context) {
	var req product.ProductSubtypeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để tạo product subtype
	subtype, err := service.ProductSubtype.CreateProductSubtype(ctx, req.Name, req.Description)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Chuyển đổi sang response object
	responseData := product.ToProductSubtypeResponse(*subtype)
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, responseData)
}

// GetProductSubtype retrieves a product subtype by ID
// @Summary      Get a product subtype by ID
// @Description  Get detailed information about a product subtype by its ID
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Subtype ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype/{id} [get]
func (c *productSubtypeController) GetProductSubtype(ctx *gin.Context) {
	var params struct {
		ID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để lấy product subtype
	subtype, err := service.ProductSubtype.GetProductSubtype(ctx, params.ID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeNotFound, err.Error())
		return
	}

	// Chuyển đổi sang response object
	responseData := product.ToProductSubtypeResponse(*subtype)
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, responseData)
}

// ListProductSubtypes retrieves a list of product subtypes
// @Summary      List product subtypes
// @Description  Get a list of all product subtypes
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype [get]
func (c *productSubtypeController) ListProductSubtypes(ctx *gin.Context) {
	// Gọi service để lấy danh sách product subtypes
	subtypes, err := service.ProductSubtype.ListProductSubtypes(ctx)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Chuyển đổi sang response object
	responseData := product.ToProductSubtypeResponses(subtypes)
	response.SuccessResponseWithItems(ctx, response.ErrCodeSuccess, responseData)
}

// ListProductSubtypesByType retrieves a list of product subtypes by product type ID
// @Summary      List product subtypes by type
// @Description  Get a list of product subtypes for a specific product type
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        typeId path int true "Product Type ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/type/{typeId}/subtypes [get]
func (c *productSubtypeController) ListProductSubtypesByType(ctx *gin.Context) {
	var params struct {
		TypeID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để lấy danh sách product subtypes
	subtypes, err := service.ProductSubtype.ListProductSubtypesByType(ctx, params.TypeID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Chuyển đổi sang response object
	responseData := product.ToProductSubtypeResponses(subtypes)
	response.SuccessResponseWithItems(ctx, response.ErrCodeSuccess, responseData)
}

// UpdateProductSubtype updates an existing product subtype
// @Summary      Update a product subtype
// @Description  Update an existing product subtype with the provided details
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Subtype ID" example:1
// @Param        payload body product.ProductSubtypeRequest true "Updated product subtype details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype/{id} [put]
func (c *productSubtypeController) UpdateProductSubtype(ctx *gin.Context) {
	// Lấy ID từ URL
	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, "Invalid product subtype ID")
		return
	}

	var req product.ProductSubtypeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để cập nhật product subtype
	subtype, err := service.ProductSubtype.UpdateProductSubtype(ctx, int32(id), req.Name, req.Description)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Chuyển đổi sang response object
	responseData := product.ToProductSubtypeResponse(*subtype)
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, responseData)
}

// DeleteProductSubtype deletes a product subtype
// @Summary      Delete a product subtype
// @Description  Delete a product subtype by its ID
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        id path int true "Product Subtype ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      404  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype/{id} [delete]
func (c *productSubtypeController) DeleteProductSubtype(ctx *gin.Context) {
	var params struct {
		ID int32 `uri:"id" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtype.DeleteProductSubtype(ctx, params.ID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "Product subtype deleted successfully"})
}

// AddProductSubtypeMapping adds a mapping between a product type and a product subtype
// @Summary      Add product subtype mapping
// @Description  Add a mapping between a product type and a product subtype
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        payload body product.ProductSubtypeMappingRequest true "Product subtype mapping details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype/mapping [post]
func (c *productSubtypeController) AddProductSubtypeMapping(ctx *gin.Context) {
	var req product.ProductSubtypeMappingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtype.AddProductSubtypeMapping(ctx, req.ProductTypeID, req.ProductSubtypeID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "Product subtype mapping added successfully"})
}

// RemoveProductSubtypeMapping removes a mapping between a product type and a product subtype
// @Summary      Remove product subtype mapping
// @Description  Remove a mapping between a product type and a product subtype
// @Tags         product subtype management
// @Accept       json
// @Produce      json
// @Param        payload body product.ProductSubtypeMappingRequest true "Product subtype mapping details"
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/subtype/mapping [delete]
func (c *productSubtypeController) RemoveProductSubtypeMapping(ctx *gin.Context) {
	var req product.ProductSubtypeMappingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtype.RemoveProductSubtypeMapping(ctx, req.ProductTypeID, req.ProductSubtypeID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "Product subtype mapping removed successfully"})
}

type productSubtypeRelationController struct{}

// GetProductSubtypeRelations retrieves all subtype relations for a product
// @Summary      Get product subtype relations
// @Description  Get all subtype relations for a specific product
// @Tags         product subtype relation management
// @Accept       json
// @Produce      json
// @Param        productId path int true "Product ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/{productId}/subtypes [get]
func (c *productSubtypeRelationController) GetProductSubtypeRelations(ctx *gin.Context) {
	var params struct {
		ProductID int32 `uri:"productId" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	subtypes, err := service.ProductSubtypeRelation.GetProductSubtypeRelations(ctx, params.ProductID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItems(ctx, response.ErrCodeSuccess, subtypes)
}

// AddProductSubtypeRelation adds a relation between a product and a product subtype
// @Summary      Add product subtype relation
// @Description  Add a relation between a product and a product subtype
// @Tags         product subtype relation management
// @Accept       json
// @Produce      json
// @Param        productId path int true "Product ID" example:1
// @Param        subtypeId path int true "Product Subtype ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/{productId}/subtype/{subtypeId} [post]
func (c *productSubtypeRelationController) AddProductSubtypeRelation(ctx *gin.Context) {
	var params struct {
		ProductID int32 `uri:"productId" binding:"required"`
		SubtypeID int32 `uri:"subtypeId" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtypeRelation.AddProductSubtypeRelation(ctx, params.ProductID, params.SubtypeID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "Product subtype relation added successfully"})
}

// RemoveProductSubtypeRelation removes a relation between a product and a product subtype
// @Summary      Remove product subtype relation
// @Description  Remove a relation between a product and a product subtype
// @Tags         product subtype relation management
// @Accept       json
// @Produce      json
// @Param        productId path int true "Product ID" example:1
// @Param        subtypeId path int true "Product Subtype ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/{productId}/subtype/{subtypeId} [delete]
func (c *productSubtypeRelationController) RemoveProductSubtypeRelation(ctx *gin.Context) {
	var params struct {
		ProductID int32 `uri:"productId" binding:"required"`
		SubtypeID int32 `uri:"subtypeId" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtypeRelation.RemoveProductSubtypeRelation(ctx, params.ProductID, params.SubtypeID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "Product subtype relation removed successfully"})
}

// RemoveAllProductSubtypeRelations removes all relations for a product
// @Summary      Remove all product subtype relations
// @Description  Remove all subtype relations for a specific product
// @Tags         product subtype relation management
// @Accept       json
// @Produce      json
// @Param        productId path int true "Product ID" example:1
// @Success      200  {object}  response.ResponseData
// @Failure      400  {object}  response.ErrorResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /product/{productId}/subtypes [delete]
func (c *productSubtypeRelationController) RemoveAllProductSubtypeRelations(ctx *gin.Context) {
	var params struct {
		ProductID int32 `uri:"productId" binding:"required"`
	}
	if err := ctx.ShouldBindUri(&params); err != nil {
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	err := service.ProductSubtypeRelation.RemoveAllProductSubtypeRelations(ctx, params.ProductID)
	if err != nil {
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, err.Error())
		return
	}

	// Sử dụng helper function mới để đảm bảo tính nhất quán
	response.SuccessResponseWithItem(ctx, response.ErrCodeSuccess, gin.H{"message": "All product subtype relations removed successfully"})
}
