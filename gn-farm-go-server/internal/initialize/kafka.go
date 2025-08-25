//####################################################################
// KAFKA INITIALIZATION - KHỞI TẠO KAFKA PRODUCER
// Package này chịu trách nhiệm khởi tạo Kafka producer cho message queue
// 
// Chức năng chính:
// - Thiết lập Kafka producer để gửi messages
// - Cấu hình connection tới Kafka brokers
// - Quản lý topics và message routing
// - Clean up resources khi shutdown
//
// Kafka được sử dụng cho:
// - Gửi OTP authentication messages
// - Event streaming cho microservices
// - Async processing cho heavy operations
// - Audit logging và monitoring events
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"log"

	"gn-farm-go-server/global"
	"github.com/segmentio/kafka-go"
)

// ===== BIẾN GLOBAL CHO KAFKA =====
// KafkaProducer - Instance của Kafka producer (hiện tại chưa sử dụng)
var KafkaProducer *kafka.Writer

// ===== KHỞI TẠO KAFKA PRODUCER =====
// InitKafka thiết lập Kafka producer để gửi messages tới Kafka cluster
// Producer này sử dụng để gửi OTP authentication messages
func InitKafka() {
	// ===== CẤU HÌNH KAFKA WRITER =====
	global.KafkaProducer = &kafka.Writer{
		Addr:     kafka.TCP("localhost:19094"),    // Địa chỉ Kafka broker
		Topic:    "otp-auth-topic",               // Topic cho OTP authentication
		Balancer: &kafka.LeastBytes{},            // Load balancer: chọn partition ít bytes nhất
	}
}

// ===== DỌN DọP KAFKA RESOURCES =====
// CloseKafka đóng Kafka producer và giải phóng resources
// Function này nên được gọi khi shutdown application
func CloseKafka() {
	if err := global.KafkaProducer.Close(); err != nil {
		log.Fatalf("Failed to close kafka producer: %v", err)
	}
}
