package models

import "gorm.io/gorm"

// Product 产品（原分类，现直接作为可绑定订单的产品）
type Product struct {
	gorm.Model
	Name       string             `json:"name"`
	Code       string             `json:"code"`       // 产品编号
	Icon       string             `json:"icon"`       // 图标 emoji
	Image      string             `json:"image"`      // 产品图片
	SortOrder  int                `json:"sort_order"` // 排序
	Attributes []ProductAttribute `json:"attributes" gorm:"foreignKey:ProductID"`
}

// ProductAttribute 产品属性定义
type ProductAttribute struct {
	gorm.Model
	ProductID uint   `json:"product_id"`
	Name      string `json:"name"`
	Type      string `json:"type"`    // text, number, select, textarea
	Options   string `json:"options"` // JSON 数组，用于 select 类型
	Required  bool   `json:"required"`
	SortOrder int    `json:"sort_order"`
}
