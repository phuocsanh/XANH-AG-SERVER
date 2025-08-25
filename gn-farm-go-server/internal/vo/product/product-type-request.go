package product

// ProductTypeRequest đại diện cho yêu cầu tạo loại sản phẩm
type ProductTypeRequest struct {
	Name        string `json:"name" example:"Organic Vegetables"`
	Description string `json:"description" example:"All types of organic vegetables"`
	ImageURL    string `json:"imageUrl" example:"https://example.com/images/organic-vegetables.jpg"`
}

// ProductSubtypeRequest đại diện cho yêu cầu tạo loại phụ sản phẩm
type ProductSubtypeRequest struct {
	Name        string `json:"name" example:"Leafy Greens"`
	Description string `json:"description" example:"Leafy green vegetables"`
}

// ProductSubtypeMappingRequest đại diện cho yêu cầu ánh xạ loại phụ sản phẩm với loại sản phẩm
type ProductSubtypeMappingRequest struct {
	ProductTypeID    int32 `json:"productTypeId" example:"1"`
	ProductSubtypeID int32 `json:"productSubtypeId" example:"1"`
}

