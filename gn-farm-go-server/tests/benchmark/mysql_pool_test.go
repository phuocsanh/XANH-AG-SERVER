package main

import (
	"log"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	ID   uint
	Name string
}

func insertRecord(b *testing.B, db *gorm.DB) {
	user := User{Name: "Tipjs "}
	if err := db.Create(&user).Error; err != nil {
		b.Fatal(err)
	}
}

// func BenchmarkMaxOpenConns1(b *testing.B) {
// 	dsn := "root:root1234@tcp(127.0.0.1:33306)/shopdevgo?charset=utf8mb4&parseTime=True" //&loc=Local , theem local cao thi lay gio cua dia phuong

// 	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
// 		// SkipDefaultTransaction: false,
// 	})
// 	if err != nil {
// 		log.Fatalf("failed to connect database: %v", err)
// 	}
// 	// Check if the table exists
// 	if db.Migrator().HasTable(&User{}) {
// 		// Drop the table if it exists
// 		if err := db.Migrator().DropTable(&User{}); err != nil {
// 			// Handle error if you want
// 			// fmt.Println("Error dropping table:", err)
// 		}
// 	}
// 	// Tạo bảng nếu chưa có
// 	db.AutoMigrate(&User{})
// 	sqlDB, err := db.DB()
// 	if err != nil {
// 		log.Fatalf("failed to get sql.DB from gorm.DB: %v", err)
// 	}

// 	// Thiết lập các tham số kết nối
// 	sqlDB.SetMaxOpenConns(1)
// 	defer sqlDB.Close()

// 	b.RunParallel(func(pb *testing.PB) {
// 		for pb.Next() {
// 			insertRecord(b, db)
// 		}
// 	})
// }

// go test -bench=. -benchmem

func BenchmarkMaxOpenConns10(b *testing.B) {
	dsn := "root:root1234@tcp(127.0.0.1:33306)/shopdevgo?charset=utf8mb4&parseTime=True&loc=Local"

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		// SkipDefaultTransaction: false,
		// Logger:                 false,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	// Check if the table exists
	if db.Migrator().HasTable(&User{}) {
		// Drop the table if it exists
		if err := db.Migrator().DropTable(&User{}); err != nil {
			// Handle error if you want
			// fmt.Println("Error dropping table:", err)
		}
	}
	// Tạo bảng nếu chưa có
	db.AutoMigrate(&User{})

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get sql.DB from gorm.DB: %v", err)
	}

	// Thiết lập các tham số kết nối
	sqlDB.SetMaxOpenConns(10)
	defer sqlDB.Close()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			insertRecord(b, db)
		}
	})
}
