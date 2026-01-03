package models

import "gorm.io/gorm"

// OrderProduct represents the link between an order and a product,
// storing specific dimensions and pricing for that instance.
type OrderProduct struct {
	gorm.Model
	OrderID   uint     `json:"order_id"`
	Order     *Order   `json:"-" gorm:"foreignKey:OrderID"`
	ProductID uint     `json:"product_id"`
	Product   *Product `json:"product" gorm:"foreignKey:ProductID"`

	// Dynamic Attributes
	Length     float64 `json:"length"`      // e.g. cm
	Width      float64 `json:"width"`       // e.g. cm
	Height     float64 `json:"height"`      // e.g. cm
	Quantity   int     `json:"quantity"`    // Number of items with these specs
	Unit       string  `json:"unit"`        // 计量单位: 块、平米、个等
	UnitPrice  float64 `json:"unit_price"`  // Price per unit
	TotalPrice float64 `json:"total_price"` // Quantity * UnitPrice

	// 额外属性值 (JSON 格式，如 {"颜色": "红色", "材质": "棉麻"})
	ExtraAttrs string `json:"extra_attrs"`
}
