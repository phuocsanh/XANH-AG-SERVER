package product

import (
	"gn-farm-go-server/internal/database"
)

// ProductSubtypeResponse là đối tượng response cho product subtype
type ProductSubtypeResponse struct {
	ID          int32   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

// ToProductSubtypeResponse chuyển đổi từ database model sang response object
func ToProductSubtypeResponse(subtype database.ProductSubtype) ProductSubtypeResponse {
	var description *string
	if subtype.Description.Valid {
		desc := subtype.Description.String
		description = &desc
	}

	return ProductSubtypeResponse{
		ID:          subtype.ID,
		Name:        subtype.Name,
		Description: description,
		CreatedAt:   subtype.CreatedAt.Format("2006-01-02T15:04:05.999999Z"),
		UpdatedAt:   subtype.UpdatedAt.Format("2006-01-02T15:04:05.999999Z"),
	}
}

// ToProductSubtypeResponses chuyển đổi slice của database model sang slice của response object
func ToProductSubtypeResponses(subtypes []database.ProductSubtype) []ProductSubtypeResponse {
	responses := make([]ProductSubtypeResponse, len(subtypes))
	for i, subtype := range subtypes {
		responses[i] = ToProductSubtypeResponse(subtype)
	}
	return responses
}
