package models

import "gorm.io/gorm"

type Product struct {
	gorm.Model
	CategoryID      uint                    `json:"category_id"`
	Category        *Category               `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
	Name            string                  `json:"name"`
	Code            string                  `json:"code"`
	Image           string                  `json:"image"`
	AttributeValues []ProductAttributeValue `json:"attribute_values,omitempty" gorm:"foreignKey:ProductID"`
}
