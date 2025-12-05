package models

import "gorm.io/gorm"

type Product struct {
	gorm.Model
	Name  string  `json:"name"`
	Code  string  `json:"code"`
	Price float64 `json:"price"`
	Image string  `json:"image"`
}
