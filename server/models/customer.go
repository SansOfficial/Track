package models

import (
	"gorm.io/gorm"
)

type Customer struct {
	gorm.Model
	Name    string `json:"name"`
	Phone   string `json:"phone" gorm:"unique"` // Phone should be unique
	Address string `json:"address"`
	Remark  string `json:"remark"`
}
