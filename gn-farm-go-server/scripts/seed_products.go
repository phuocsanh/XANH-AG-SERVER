package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"gn-farm-go-server/internal/database"

	_ "github.com/lib/pq"
)

type ProductData struct {
	Name                string                 `json:"product_name"`
	Price               string                 `json:"product_price"`
	Thumbnail           string                 `json:"product_thumb"`
	Pictures           []string               `json:"product_pictures"`
	Videos             []string               `json:"product_videos"`
	Description        string                 `json:"product_description"`
	Slug               string                 `json:"product_slug"`
	Type               int32                  `json:"product_type"`
	SubTypes          []int32                `json:"sub_product_type"`
	Discount          string                 `json:"discount"`
	DiscountedPrice   string                 `json:"product_discounted_price"`
	Status            int32                  `json:"product_status"`
	Quantity          int32                  `json:"product_quantity"`
	RatingsAverage    float64                `json:"product_ratings_average"`
	Attributes        map[string]interface{} `json:"product_attributes"`
	Variations        map[string]interface{} `json:"product_variations"`
	IsDraft           bool                   `json:"is_draft"`
	IsPublished       bool                   `json:"is_published"`
}

func main() {
	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	// Connect to database
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		"localhost", 5432, "postgres", "123456", "GO_GN_FARM")

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	queries := database.New(db)
	ctx := context.Background()

	// Seed products
	if err := seedProducts(ctx, queries); err != nil {
		log.Fatal("Failed to seed products:", err)
	}

	fmt.Println("Successfully seeded 200 products!")
}

func seedProducts(ctx context.Context, queries *database.Queries) error {
	products := generateProductData()

	for i, product := range products {
		// Convert attributes to JSON
		attributesJSON, err := json.Marshal(product.Attributes)
		if err != nil {
			return fmt.Errorf("failed to marshal attributes for product %d: %v", i, err)
		}

		// Convert variations to JSON (not used in current implementation)

		// Generate slug from name if not provided
		slug := product.Slug
		if slug == "" {
			slug = strings.ToLower(strings.ReplaceAll(product.Name, " ", "-"))
		}

		// Create product
		params := database.CreateProductParams{
			ProductName:            product.Name,
			ProductPrice:           product.Price,
			ProductThumb:           product.Thumbnail,
			ProductPictures:        product.Pictures,
			ProductVideos:          product.Videos,
			ProductDescription:     sql.NullString{String: product.Description, Valid: product.Description != ""},
			ProductSlug:            sql.NullString{String: slug, Valid: true},
			ProductType:            product.Type,
			SubProductType:         product.SubTypes,
			ProductDiscountedPrice: calculateDiscountedPrice(product.Price, product.Discount),
			ProductQuantity:        sql.NullInt32{Int32: product.Quantity, Valid: true},
			ProductStatus:          sql.NullInt32{Int32: product.Status, Valid: true},
			ProductRatingsAverage:  sql.NullString{String: fmt.Sprintf("%.1f", product.RatingsAverage), Valid: true},
			ProductAttributes:      attributesJSON,
			Discount:               sql.NullString{String: product.Discount, Valid: product.Discount != ""},
			IsDraft:                sql.NullBool{Bool: product.IsDraft, Valid: true},
			IsPublished:            sql.NullBool{Bool: product.IsPublished, Valid: true},
		}

		_, err = queries.CreateProduct(ctx, params)
		if err != nil {
			return fmt.Errorf("failed to create product %d: %v", i, err)
		}

		if (i+1)%20 == 0 {
			fmt.Printf("Created %d products...\n", i+1)
		}
	}

	return nil
}

func calculateDiscountedPrice(price, discount string) string {
	// Simple calculation - in real app you'd parse and calculate properly
	return price // For now, just return original price
}

func generateSlug(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, " ", "-"))
}

func generateProductData() []ProductData {
	var products []ProductData

	// 1. Sản phẩm Nấm (40 sản phẩm)
	mushroomNames := []string{
		"Nấm Rơm Tươi", "Nấm Bào Ngư Trắng", "Nấm Kim Châm", "Nấm Đông Cô", "Nấm Mỡ",
		"Nấm Hương Tươi", "Nấm Đùi Gà", "Nấm Linh Chi", "Nấm Mối", "Nấm Mèo",
	}
	mushroomImages := []string{
		"https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500",
		"https://images.unsplash.com/photo-1518864677427-aca22d1e7e4e?w=500",
		"https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=500",
	}

	for i := 0; i < 40; i++ {
		name := mushroomNames[i%len(mushroomNames)]
		if i >= len(mushroomNames) {
			name = fmt.Sprintf("%s %d", name, i/len(mushroomNames)+1)
		}

		price := 30000 + rand.Intn(100000) // 30k-130k
		discount := rand.Intn(30)             // 0-30% giảm giá
		discountedPrice := int(float64(price) * (1 - float64(discount)/100))
		
		products = append(products, ProductData{
			Name:            name,
			Type:            1, // Loại 1: Nấm
			SubTypes:        []int32{int32((i % 3) + 1)},
			Price:           fmt.Sprintf("%.2f", float64(price)),
			DiscountedPrice: fmt.Sprintf("%.2f", float64(discountedPrice)),
			Discount:        fmt.Sprintf("%d", discount),
			Description:     fmt.Sprintf("%s tươi ngon, giàu dinh dưỡng, xuất xứ từ vùng trồng đảm bảo", name),
			Slug:            generateSlug(name),
			Thumbnail:       mushroomImages[rand.Intn(len(mushroomImages))],
			Pictures:        []string{mushroomImages[rand.Intn(len(mushroomImages))]},
			Videos:          []string{},
			Status:          1, // 1: Active
			Quantity:        int32(rand.Intn(100) + 10), // 10-110 sản phẩm
			RatingsAverage:  4.0 + rand.Float64() * 1.5, // 4.0 - 5.5
			IsDraft:         false,
			IsPublished:     true,
			Attributes: map[string]interface{}{
				"origin":      []string{"Đà Lạt", "Sapa", "Tam Đảo"}[rand.Intn(3)],
				"weight":      fmt.Sprintf("%dg", (rand.Intn(10)+5)*100), // 500g-1500g
				"freshness":   []string{"Mới thu hoạch", "Bảo quản lạnh"}[rand.Intn(2)],
				"storage":     "Bảo quản nơi khô ráo, thoáng mát",
				"expiry":      fmt.Sprintf("%d ngày", rand.Intn(14)+3), // 3-17 ngày
				"organic":     rand.Intn(2) == 1,
			},
			Variations: map[string]interface{}{
				"sizes": []string{"Nhỏ", "Vừa", "Lớn"},
				"colors": []string{"Trắng", "Nâu", "Vàng"},
			},
		})
	}

	// 2. Sản phẩm Phân bón (30 sản phẩm)
	fertilizerNames := []string{
		"Phân Hữu Cơ Vi Sinh", "Phân Trùn Quế", "Phân Gà Xử Lý", "Phân Bò Hoai Mục", "Phân Dơi",
		"Phân Hữu Cơ Tổng Hợp", "Phân Cá Hữu Cơ", "Phân Bón Lá", "Phân Nở Chậm", "Phân Hữu Cơ Khoáng",
	}
	fertilizerImages := []string{
		"https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=500",
		"https://images.unsplash.com/photo-1586771107445-d3ca888129ce?w=500",
		"https://images.unsplash.com/photo-1618221195710-fff6df6fc3a7?w=500",
	}

	for i := 0; i < 30; i++ {
		name := fertilizerNames[i%len(fertilizerNames)]
		if i >= len(fertilizerNames) {
			name = fmt.Sprintf("%s %d", name, i/len(fertilizerNames)+1)
		}

		products = append(products, ProductData{
			Name: name,
			Type: 2, // Loại 2: Phân bón
			SubTypes: []int32{int32((i % 4) + 1)},
			Price:    fmt.Sprintf("%d", 50000+rand.Intn(200000)), // 50k-250k
			Discount: fmt.Sprintf("%d", rand.Intn(25)),           // 0-25% giảm giá
			Description: fmt.Sprintf("%s chất lượng cao, cung cấp dinh dưỡng cân đối cho cây trồng", name),
			Pictures: []string{
				fertilizerImages[rand.Intn(len(fertilizerImages))],
			},
			Attributes: map[string]interface{}{
				"origin":      []string{"Việt Nam", "Nhật Bản", "Hàn Quốc", "Mỹ"}[rand.Intn(4)],
				"weight":      fmt.Sprintf("%dkg", (rand.Intn(5)+1)), // 1-5kg
				"organic":     rand.Intn(2) == 1,
				"usage":       "Pha loãng với nước tưới quanh gốc cây",
				"effect_time": fmt.Sprintf("%d tháng", rand.Intn(6)+1), // 1-6 tháng
			},
		})
	}

	// 3. Sản phẩm Thuốc bảo vệ thực vật (30 sản phẩm)
	pesticideNames := []string{
		"Thuốc Trừ Sâu Sinh Học", "Thuốc Diệt Cỏ", "Thuốc Trừ Nấm", "Thuốc Trừ Sâu Hữu Cơ",
		"Thuốc Diệt Ốc", "Thuốc Kích Thích Sinh Trưởng", "Thuốc Trừ Rầy", "Thuốc Xua Đuổi Côn Trùng",
		"Thuốc Trừ Bệnh Đạo Ôn", "Thuốc Trừ Sâu Vi Sinh",
	}
	pesticideImages := []string{
		"https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500",
		"https://images.unsplash.com/photo-1592919505780-998a4a8cef16?w=500",
		"https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500",
	}

	pestTypes := []string{"Sâu", "Bệnh", "Cỏ dại", "Chuột", "Ốc bươu vàng"}
	targetPlants := []string{"Lúa", "Rau màu", "Cây ăn quả", "Hoa cây cảnh", "Cây công nghiệp"}

	for i := 0; i < 30; i++ {
		name := pesticideNames[i%len(pesticideNames)]
		if i >= len(pesticideNames) {
			name = fmt.Sprintf("%s %d", name, i/len(pesticideNames)+1)
		}

		pestType := pestTypes[rand.Intn(len(pestTypes))]
		targetPlant := targetPlants[rand.Intn(len(targetPlants))]

		products = append(products, ProductData{
			Name: name,
			Type: 3, // Loại 3: Thuốc bảo vệ thực vật
			SubTypes: []int32{int32((i % 5) + 1)},
			Price:    fmt.Sprintf("%d", 30000+rand.Intn(200000)), // 30k-230k
			Discount: fmt.Sprintf("%d", rand.Intn(20)),           // 0-20% giảm giá
			Description: fmt.Sprintf("%s hiệu quả cao, an toàn cho cây trồng và môi trường", name),
			Pictures: []string{
				pesticideImages[rand.Intn(len(pesticideImages))],
			},
			Attributes: map[string]interface{}{
				"origin":       []string{"Việt Nam", "Nhật Bản", "Hàn Quốc", "Mỹ", "Thái Lan"}[rand.Intn(5)],
				"volume":       fmt.Sprintf("%dml", (rand.Intn(10)+1)*100), // 100-1000ml
				"pest_type":    pestType,
				"target_plant": targetPlant,
				"frequency":    fmt.Sprintf("%d lần/vụ", rand.Intn(5)+1), // 1-5 lần/vụ
				"safety_level": []string{"Độc hại", "Cảnh báo", "Cẩn thận", "An toàn"}[rand.Intn(4)],
				"expiry_date":  fmt.Sprintf("%d/%d", rand.Intn(12)+1, 2025+rand.Intn(3)), // 1-12/2025-2027
			},
		})
	}

	return products
}