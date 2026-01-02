package models

import "gorm.io/gorm"

// Category 产品分类
type Category struct {
	gorm.Model
	Name       string              `json:"name"`
	Icon       string              `json:"icon"`
	SortOrder  int                 `json:"sort_order"`
	Attributes []CategoryAttribute `json:"attributes" gorm:"foreignKey:CategoryID"`
	Products   []Product           `json:"products,omitempty" gorm:"foreignKey:CategoryID"`
}

// CategoryAttribute 分类属性定义
type CategoryAttribute struct {
	gorm.Model
	CategoryID uint   `json:"category_id"`
	Name       string `json:"name"`
	Type       string `json:"type"`    // text, number, select, textarea
	Options    string `json:"options"` // JSON 数组，用于 select 类型
	Required   bool   `json:"required"`
	SortOrder  int    `json:"sort_order"`
}

// ProductAttributeValue 产品属性值
type ProductAttributeValue struct {
	gorm.Model
	ProductID   uint   `json:"product_id"`
	AttributeID uint   `json:"attribute_id"`
	Value       string `json:"value"`
}
