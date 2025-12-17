package models

import "gorm.io/gorm"

type ScanLog struct {
	gorm.Model
	WorkerID    uint   `json:"worker_id"`
	WorkerName  string `json:"worker_name"`
	Station     string `json:"station"`
	Content     string `json:"content"` // The raw QR code or parsed relevant part
	IsSuccess   bool   `json:"is_success"`
	Message     string `json:"message"` // Error message or Success details
	ScannerCode string `json:"scanner_code"`
	OrderID     uint   `json:"order_id"`
}
