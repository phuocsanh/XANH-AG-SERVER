package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// TestCreateSalesInvoiceRequest - DTO để test tạo phiếu bán hàng
type TestCreateSalesInvoiceRequest struct {
	CustomerName    *string                      `json:"customer_name"`
	CustomerPhone   *string                      `json:"customer_phone"`
	CustomerEmail   *string                      `json:"customer_email"`
	CustomerAddress *string                      `json:"customer_address"`
	PaymentMethod   string                       `json:"payment_method"`
	DiscountAmount  *string                      `json:"discount_amount"`
	Notes           *string                      `json:"notes"`
	Items           []TestCreateSalesInvoiceItemRequest `json:"items"`
}

// TestCreateSalesInvoiceItemRequest - DTO để test thêm sản phẩm vào phiếu
type TestCreateSalesInvoiceItemRequest struct {
	ProductID       int32   `json:"product_id"`
	Quantity        int32   `json:"quantity"`
	UnitPrice       string  `json:"unit_price"`
	DiscountPercent *string `json:"discount_percent"`
	DiscountAmount  *string `json:"discount_amount"`
	Notes           *string `json:"notes"`
}

// stringPtr helper function
func stringPtr(s string) *string {
	return &s
}

// testSalesAPI - Test các API endpoints của sales
func testSalesAPI() {
	baseURL := "http://localhost:8002/v1"
	
	fmt.Println("=== TESTING SALES API ENDPOINTS ===")
	
	// Test 1: Tạo phiếu bán hàng mới
	fmt.Println("\n1. Testing CREATE Sales Invoice...")
	createReq := TestCreateSalesInvoiceRequest{
		CustomerName:    stringPtr("Nguyễn Văn A"),
		CustomerPhone:   stringPtr("0123456789"),
		CustomerEmail:   stringPtr("nguyenvana@email.com"),
		CustomerAddress: stringPtr("123 Đường ABC, Quận 1, TP.HCM"),
		PaymentMethod:   "CASH",
		DiscountAmount:  stringPtr("50000"),
		Notes:           stringPtr("Giao hàng buổi sáng"),
		Items: []TestCreateSalesInvoiceItemRequest{
			{
				ProductID:       1,
				Quantity:        10,
				UnitPrice:       "50000.00",
				DiscountPercent: stringPtr("10"),
				Notes:           stringPtr("Sản phẩm tươi"),
			},
			{
				ProductID:       2,
				Quantity:        5,
				UnitPrice:       "30000.00",
				DiscountAmount:  stringPtr("15000"),
				Notes:           stringPtr("Đóng gói cẩn thận"),
			},
		},
	}
	
	jsonData, _ := json.Marshal(createReq)
	resp, err := http.Post(baseURL+"/manage/sales/invoice", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ Error creating sales invoice: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Create Sales Invoice - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 2: Lấy danh sách phiếu bán hàng
	fmt.Println("\n2. Testing LIST Sales Invoices...")
	resp, err = http.Get(baseURL + "/sales/invoices?page=1&limit=10")
	if err != nil {
		fmt.Printf("❌ Error listing sales invoices: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ List Sales Invoices - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 3: Lấy chi tiết phiếu bán hàng
	fmt.Println("\n3. Testing GET Sales Invoice Details...")
	resp, err = http.Get(baseURL + "/sales/invoice/1")
	if err != nil {
		fmt.Printf("❌ Error getting sales invoice: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Get Sales Invoice - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 4: Tìm phiếu theo mã
	fmt.Println("\n4. Testing GET Sales Invoice by Code...")
	resp, err = http.Get(baseURL + "/manage/sales/invoice/code/SI-001")
	if err != nil {
		fmt.Printf("❌ Error getting sales invoice by code: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Get Sales Invoice by Code - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 5: Xác nhận phiếu bán hàng
	fmt.Println("\n5. Testing CONFIRM Sales Invoice...")
	confirmReq := map[string]interface{}{
		"checked_by_user_id": 1,
		"notes":              "Đã kiểm tra và xác nhận phiếu",
	}
	jsonData, _ = json.Marshal(confirmReq)
	resp, err = http.Post(baseURL+"/manage/sales/invoice/1/confirm", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ Error confirming sales invoice: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Confirm Sales Invoice - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 6: Đánh dấu đã giao hàng
	fmt.Println("\n6. Testing DELIVER Sales Invoice...")
	deliverReq := map[string]interface{}{
		"delivered_by_user_id": 1,
		"delivery_date":        time.Now().Format("2006-01-02T15:04:05Z07:00"),
		"notes":                "Đã giao hàng thành công",
	}
	jsonData, _ = json.Marshal(deliverReq)
	resp, err = http.Post(baseURL+"/manage/sales/invoice/1/deliver", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ Error delivering sales invoice: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Deliver Sales Invoice - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	// Test 7: Lấy danh sách sản phẩm trong phiếu
	fmt.Println("\n7. Testing GET Sales Invoice Items...")
	resp, err = http.Get(baseURL + "/manage/sales/invoice/1/items")
	if err != nil {
		fmt.Printf("❌ Error getting sales invoice items: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ Get Sales Invoice Items - Status: %d\n", resp.StatusCode)
		fmt.Printf("Response: %s\n", string(body))
	}
	
	fmt.Println("\n=== SALES API TESTING COMPLETED ===")
}

func main() {
	fmt.Println("Sales API Test Tool")
	fmt.Println("==================")
	fmt.Println("Đảm bảo server đang chạy trên http://localhost:8002")
	fmt.Println("Nhấn Enter để bắt đầu test...")
	
	var input string
	fmt.Scanln(&input)
	
	testSalesAPI()
}