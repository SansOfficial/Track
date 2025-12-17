package models

import "gorm.io/gorm"

type Worker struct {
	gorm.Model
	Name        string `json:"name"`
	Station     string `json:"station"` // e.g., "MaterialLoading", "Production", "Assembly"
	Phone       string `json:"phone"`
	ScannerCode string `json:"scanner_code" gorm:"unique"` // e.g. "XL1#"
}
