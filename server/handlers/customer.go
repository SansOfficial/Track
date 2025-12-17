package handlers

import (
	"net/http"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

// GetCustomers 获取客户列表
func GetCustomers(c *gin.Context) {
	var customers []models.Customer
	query := database.DB.Model(&models.Customer{})

	// Search
	q := c.Query("q")
	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("name LIKE ? OR phone LIKE ?", wildcard, wildcard)
	}

	query.Find(&customers)
	c.JSON(http.StatusOK, customers)
}

// CreateCustomer 创建客户
func CreateCustomer(c *gin.Context) {
	var customer models.Customer
	if err := c.ShouldBindJSON(&customer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if phone already exists
	var count int64
	database.DB.Model(&models.Customer{}).Where("phone = ?", customer.Phone).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该手机号已存在"})
		return
	}

	if err := database.DB.Create(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, customer)
}

// UpdateCustomer 更新客户
func UpdateCustomer(c *gin.Context) {
	var customer models.Customer
	if err := database.DB.First(&customer, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户不存在"})
		return
	}

	var input models.Customer
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	customer.Name = input.Name
	customer.Phone = input.Phone
	customer.Address = input.Address
	customer.Remark = input.Remark

	if err := database.DB.Save(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, customer)
}

// DeleteCustomer 删除客户
func DeleteCustomer(c *gin.Context) {
	var customer models.Customer
	if err := database.DB.First(&customer, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "客户不存在"})
		return
	}

	database.DB.Delete(&customer)
	c.JSON(http.StatusOK, gin.H{"message": "客户已删除"})
}
