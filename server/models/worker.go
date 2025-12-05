package models

import "gorm.io/gorm"

type Worker struct {
	gorm.Model
	Name     string `json:"name"`
	Station  string `json:"station"` // e.g., "MaterialLoading", "Production", "Assembly"
	Phone    string `json:"phone"`
	OpenID   string `json:"openid"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}
