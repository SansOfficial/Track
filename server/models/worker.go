package models

import "gorm.io/gorm"

type Worker struct {
	gorm.Model
	Name    string `json:"name"`
	Station string `json:"station"` // e.g., "MaterialLoading", "Production", "Assembly"
	Phone   string `json:"phone"`
}
