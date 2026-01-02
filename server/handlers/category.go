package handlers

import (
	"net/http"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

// GetCategories 获取所有分类（含属性定义）
func GetCategories(c *gin.Context) {
	var categories []models.Category
	database.DB.Preload("Attributes").Order("sort_order ASC").Find(&categories)
	c.JSON(http.StatusOK, categories)
}

// CreateCategory 创建分类
func CreateCategory(c *gin.Context) {
	var category models.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if category.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "分类名称不能为空"})
		return
	}

	if err := database.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, category)
}

// UpdateCategory 更新分类
func UpdateCategory(c *gin.Context) {
	var category models.Category
	if err := database.DB.First(&category, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	var input models.Category
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category.Name = input.Name
	category.Icon = input.Icon
	category.SortOrder = input.SortOrder

	database.DB.Save(&category)
	c.JSON(http.StatusOK, category)
}

// DeleteCategory 删除分类
func DeleteCategory(c *gin.Context) {
	var category models.Category
	if err := database.DB.First(&category, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	// 检查是否有产品使用此分类
	var count int64
	database.DB.Model(&models.Product{}).Where("category_id = ?", category.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该分类下有产品，无法删除"})
		return
	}

	// 删除分类及其属性定义
	database.DB.Where("category_id = ?", category.ID).Delete(&models.CategoryAttribute{})
	database.DB.Delete(&category)
	c.JSON(http.StatusOK, gin.H{"message": "分类已删除"})
}

// CreateCategoryAttribute 添加分类属性
func CreateCategoryAttribute(c *gin.Context) {
	categoryID := c.Param("id")

	var category models.Category
	if err := database.DB.First(&category, categoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	var attr models.CategoryAttribute
	if err := c.ShouldBindJSON(&attr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr.CategoryID = category.ID

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

// DeleteCategoryAttribute 删除分类属性
func DeleteCategoryAttribute(c *gin.Context) {
	attrID := c.Param("attrId")

	var attr models.CategoryAttribute
	if err := database.DB.First(&attr, attrID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "属性不存在"})
		return
	}

	// 删除相关的产品属性值
	database.DB.Where("attribute_id = ?", attr.ID).Delete(&models.ProductAttributeValue{})
	database.DB.Delete(&attr)

	c.JSON(http.StatusOK, gin.H{"message": "属性已删除"})
}
