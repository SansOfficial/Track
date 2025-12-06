package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

func CreateOrder(c *gin.Context) {
	var input struct {
		models.Order
		ProductIDs []uint `json:"product_ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validation
	if input.CustomerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "客户姓名不能为空"})
		return
	}
	if input.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "联系电话不能为空"})
		return
	}
	if input.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "订单金额必须大于0"})
		return
	}
	if len(input.ProductIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须选择至少一个产品"})
		return
	}

	order := input.Order
	order.Status = "待下料"

	// Associate Products
	// Associate Products
	if len(input.ProductIDs) > 0 {
		var products []models.Product
		database.DB.Find(&products, input.ProductIDs)
		order.Products = products
	}

	// Generate Order No: ORD-YYYYMMDDHHMMSS-XXXXXX (Standardized Time + Random)
	now := time.Now()
	timestamp := now.Format("20060102150405")
	micro := now.Nanosecond() / 1000         // Microseconds for precision
	randomPart := rand.Intn(900000) + 100000 // 6 digit random
	order.OrderNo = fmt.Sprintf("ORD-%s-%06d-%d", timestamp, micro%1000000, randomPart)
	// Simplified: ORD-YYYYMMDDHHMMSS-RANDOM
	order.OrderNo = fmt.Sprintf("ORD-%s-%06d", timestamp, randomPart)

	// Also use the same for QRCode or keep ID based?
	// The previous code generated QRCode AFTER creates using ID.
	// We can keep that or use OrderNo. User said "Order No needs to be stored".
	// Let's set QRCode to OrderNo as well (it's unique), or keep the old "ORDER-{ID}" logic?
	// The prompt implies OrderNo is the main identifier.
	// But let's stick to the existing QRCode logic "ORDER-{ID}" unless asked to change.
	// Actually, having two identifiers might be confusing.
	// But `OrderNo` is display friendly.

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Generate QR Code as URL for direct deep link
	// Note: Replace with actual domain configured in WeChat Admin
	order.QRCode = fmt.Sprintf("https://tatami.domain/scan?id=%d", order.ID)
	database.DB.Save(&order)

	c.JSON(http.StatusOK, order)
}

func GetOrders(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	offset := (page - 1) * pageSize

	var orders []models.Order
	var total int64 // This will be the filtered total for pagination

	// Base query for list
	query := database.DB.Model(&models.Order{}).Preload("Products")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// Search query
	q := c.Query("q")
	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ?", wildcard, wildcard, wildcard)
	}

	query.Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&orders)

	// Global Stats (Unfiltered)
	var globalTotal int64
	var completed int64
	var pending int64
	var revenue float64

	database.DB.Model(&models.Order{}).Count(&globalTotal)
	database.DB.Model(&models.Order{}).Where("status = ?", "已完成").Count(&completed)
	database.DB.Model(&models.Order{}).Where("status = ?", "待下料").Count(&pending)

	type Result struct {
		TotalAmount float64
	}
	var result Result
	database.DB.Model(&models.Order{}).Select("sum(amount) as total_amount").Scan(&result)
	revenue = result.TotalAmount

	c.JSON(http.StatusOK, gin.H{
		"data":  orders,
		"total": total,
		"page":  page,
		"stats": gin.H{
			"total":     globalTotal,
			"completed": completed,
			"pending":   pending,
			"revenue":   revenue,
		},
	})
}

func GetOrder(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func UpdateOrderStatus(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	var input struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	order.Status = input.Status
	database.DB.Save(&order)
	c.JSON(http.StatusOK, order)
}

func ScanQRCode(c *gin.Context) {
	// Worker scans QR code
	var input struct {
		QRCode   string `json:"qr_code"`
		WorkerID uint   `json:"worker_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse Order ID from QR Code (assuming "ORDER-{ID}")
	// Parse Order ID from QR Code
	// Support both "ORDER-{ID}" and "URL?id={ID}" formats
	var orderID uint
	if n, _ := fmt.Sscanf(input.QRCode, "ORDER-%d", &orderID); n != 1 {
		// Try parsing as URL or just check for "id="
		// Simple parsing: verify if it contains "id="
		// In a real app we might parse URL properly, here we hack it slightly for robustness
		// Or simply scan for id=%d
		// Note: Sscanf might not work well with full URL if not exact match.
		// Let's use string manipulation or RegEx? Stick to naive approach for now
		// Assuming the URL ends with id={ID} or contains id={ID}

		// A simple way used often: extract digits
		// But let's be more specific
		// Let's try to unmarshal url
		// Actually, just looping is easiest if formats vary.

		// Let's just try to parse "id=%d" from the string manually if "ORDER-" fails.
		// Or use URL parsing if it looks like a URL.

		// Simplified approach: check if we can scan id=%d from the tail or find query param
		// Given: https://tatami.domain/scan?id=123
		var id int
		if _, err := fmt.Sscanf(input.QRCode, "https://tatami.domain/scan?id=%d", &id); err == nil {
			orderID = uint(id)
		} else {
			// Fallback for generic parsing if domain changes
			// ...
		}
	}

	var order models.Order
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	var worker models.Worker
	if err := database.DB.First(&worker, input.WorkerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	// Logic to update order status based on worker's station.
	// Status flow: 待下料 -> 待裁面 -> 待封面 -> 待送货 -> 已完成
	newStatus := order.Status

	switch worker.Station {
	case "下料": // Material Loading
		if order.Status == "待下料" {
			newStatus = "待裁面"
		}
	case "裁面": // Surface Cutting
		if order.Status == "待裁面" {
			newStatus = "待封面"
		}
	case "封面": // Covering
		if order.Status == "待封面" {
			newStatus = "待送货"
		}
	case "送货": // Delivery
		if order.Status == "待送货" {
			newStatus = "已完成"
		}
	}

	order.Status = newStatus
	database.DB.Save(&order)

	// Log the process
	process := models.Process{
		OrderID:  order.ID,
		Station:  worker.Station,
		Status:   "Completed",
		WorkerID: worker.ID,
	}
	database.DB.Create(&process)

	c.JSON(http.StatusOK, gin.H{"message": "Order updated", "order": order})
}

func DeleteOrder(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	// Soft delete
	database.DB.Delete(&order)
	c.JSON(http.StatusOK, gin.H{"message": "Order deleted"})
}

func UpdateOrderDetails(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	var input models.Order
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.CustomerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "客户姓名不能为空"})
		return
	}
	if input.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "联系电话不能为空"})
		return
	}
	if input.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "订单金额必须大于0"})
		return
	}

	// Update fields
	order.CustomerName = input.CustomerName
	order.Phone = input.Phone
	order.Amount = input.Amount
	order.Specs = input.Specs
	order.Remark = input.Remark
	// Note: We typically don't update Status or QRCode here as they have specific flows

	database.DB.Save(&order)
	c.JSON(http.StatusOK, order)
}
