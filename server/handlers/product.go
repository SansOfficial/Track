package handlers

import (
	"net/http"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

// GetProducts 获取所有产品（含属性定义）
func GetProducts(c *gin.Context) {
	q := c.Query("q")
	var products []models.Product
	query := database.DB.Model(&models.Product{}).Preload("Attributes").Order("sort_order ASC")

	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("name LIKE ? OR code LIKE ?", wildcard, wildcard)
	}

	query.Find(&products)
	c.JSON(http.StatusOK, products)
}

// CreateProduct 创建产品
func CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if product.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品名称不能为空"})
		return
	}

	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, product)
}

// UpdateProduct 更新产品
func UpdateProduct(c *gin.Context) {
	var product models.Product
	if err := database.DB.First(&product, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}

	var input models.Product
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	product.Name = input.Name
	product.Code = input.Code
	product.Icon = input.Icon
	product.Image = input.Image
	product.SortOrder = input.SortOrder

	database.DB.Save(&product)
	c.JSON(http.StatusOK, product)
}

// DeleteProduct 删除产品
func DeleteProduct(c *gin.Context) {
	var product models.Product
	if err := database.DB.First(&product, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}

	// 检查是否有订单使用此产品
	var count int64
	database.DB.Model(&models.OrderProduct{}).Where("product_id = ?", product.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该产品已绑定订单，无法删除"})
		return
	}

	// 删除产品及其属性定义
	database.DB.Where("product_id = ?", product.ID).Delete(&models.ProductAttribute{})
	database.DB.Delete(&product)
	c.JSON(http.StatusOK, gin.H{"message": "产品已删除"})
}

// CreateProductAttribute 添加产品属性
func CreateProductAttribute(c *gin.Context) {
	productID := c.Param("id")

	var product models.Product
	if err := database.DB.First(&product, productID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}

	var attr models.ProductAttribute
	if err := c.ShouldBindJSON(&attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr.ProductID = product.ID

	if attr.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "属性名称不能为空"})
		return
	}

	if err := database.DB.Create(&attr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attr)
}

// DeleteProductAttribute 删除产品属性
func DeleteProductAttribute(c *gin.Context) {
	attrID := c.Param("attrId")

	var attr models.ProductAttribute
	if err := database.DB.First(&attr, attrID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "属性不存在"})
		return
	}

	database.DB.Delete(&attr)
	c.JSON(http.StatusOK, gin.H{"message": "属性已删除"})
}
