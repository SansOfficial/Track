package models

import (
	"time"

	"gorm.io/gorm"
)

type Order struct {
	gorm.Model
	CustomerName  string         `json:"customer_name"`
	Phone         string         `json:"phone"`
	Amount        float64        `json:"amount"`
	Specs         string         `json:"specs"` // JSON string or comma-separated
	Remark        string         `json:"remark"`
	Status        string         `json:"status"`   // "Pending", "In Progress", "Completed", "Delivered"
	Deadline      *time.Time     `json:"deadline"` // Estimated Completion Date
	OrderNo       string         `json:"order_no"`
	QRCode        string         `json:"qr_code"`
	OrderProducts []OrderProduct `json:"order_products" gorm:"foreignKey:OrderID"`
	Processes     []Process      `json:"processes"`
}

type Process struct {
	gorm.Model
	OrderID     uint      `json:"order_id"`
	Station     string    `json:"station"`
	Status      string    `json:"status"` // "Pending", "In Progress", "Completed"
	WorkerID    uint      `json:"worker_id"`
	CompletedAt time.Time `json:"completed_at"`
}
