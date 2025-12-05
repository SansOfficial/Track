package models

import "gorm.io/gorm"

type User struct {
	gorm.Model
	Username string `json:"username" gorm:"unique"`
	Password string `json:"password"`
	Role     string `json:"role"` // "admin", "worker" (though workers might not need login if using QR)
}
