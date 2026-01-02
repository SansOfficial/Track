package handlers

import (
	"net/http"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

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
	if product.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品编号不能为空"})
		return
	}

	// 验证分类存在
	if product.CategoryID > 0 {
		var category models.Category
		if err := database.DB.First(&category, product.CategoryID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "分类不存在"})
			return
		}
	}

	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, product)
}

func GetProducts(c *gin.Context) {
	q := c.Query("q")
	categoryID := c.Query("category_id")
	var products []models.Product
	query := database.DB.Model(&models.Product{}).Preload("Category").Preload("AttributeValues.Attribute")

	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("name LIKE ? OR code LIKE ?", wildcard, wildcard)
	}

	query.Find(&products)
	c.JSON(http.StatusOK, products)
}

func UpdateProduct(c *gin.Context) {
	var product models.Product
	if err := database.DB.First(&product, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var input models.Product
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品名称不能为空"})
		return
	}
	if input.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品编号不能为空"})
		return
	}

	product.Name = input.Name
	product.Code = input.Code
	product.Image = input.Image

	database.DB.Save(&product)
	c.JSON(http.StatusOK, product)
}

func DeleteProduct(c *gin.Context) {
	var product models.Product
	if err := database.DB.First(&product, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	// Check if product is associated with any orders
	var count int64
	database.DB.Table("order_products").Where("product_id = ? AND deleted_at IS NULL", product.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该产品已绑定订单，无法删除"})
		return
	}

	database.DB.Delete(&product)
	c.JSON(http.StatusOK, gin.H{"message": "Product deleted"})
}
