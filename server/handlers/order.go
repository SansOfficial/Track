package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"time"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

// CreateOrder 创建新订单
func CreateOrder(c *gin.Context) {
	var input struct {
		models.Order
		ProductIDs []uint `json:"product_ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 验证必填项
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
	order.Status = "待下料" // 初始状态

	// 关联产品
	if len(input.ProductIDs) > 0 {
		var products []models.Product
		database.DB.Find(&products, input.ProductIDs)
		order.Products = products
	}

	// 生成订单号: ORD-YYYYMMDDHHMMSS-RANDOM
	now := time.Now()
	timestamp := now.Format("20060102150405")
	randomPart := rand.Intn(900000) + 100000 // 6位随机数
	order.OrderNo = fmt.Sprintf("ORD-%s-%06d", timestamp, randomPart)

	// 保存到数据库
	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 生成用于扫码的 URL
	// 注意：使用 localhost 以适配本地工位机模式
	order.QRCode = fmt.Sprintf("http://localhost:8080/scan?id=%d", order.ID)
	database.DB.Save(&order)

	c.JSON(http.StatusOK, order)
}

// GetOrders 获取订单列表（支持筛选和搜索）
func GetOrders(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	offset := (page - 1) * pageSize

	var orders []models.Order
	var total int64

	// 基础查询
	query := database.DB.Model(&models.Order{}).Preload("Products")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 搜索功能
	q := c.Query("q")
	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ?", wildcard, wildcard, wildcard)
	}

	query.Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&orders)

	// 全局统计（不受筛选影响）
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

// GetOrder 获取单个订单详情
func GetOrder(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}
	c.JSON(http.StatusOK, order)
}

// UpdateOrderStatus 更新订单状态 (仅状态)
func UpdateOrderStatus(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
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

// ScanQRCode 处理扫码逻辑
func ScanQRCode(c *gin.Context) {
	// 工人扫描二维码
	var input struct {
		QRCode   string `json:"qr_code"`
		WorkerID uint   `json:"worker_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 解析订单 ID
	var orderID uint

	// 1. 尝试解析 "ORDER-{ID}" 格式 (模拟器默认格式)
	if n, _ := fmt.Sscanf(input.QRCode, "ORDER-%d", &orderID); n != 1 {
		// 2. 尝试解析 URL 格式 (http://.../?id={ID})
		// 使用正则提取 id 参数，比全匹配更健壮
		re := regexp.MustCompile(`[?&]id=(\d+)`)
		matches := re.FindStringSubmatch(input.QRCode)

		if len(matches) > 1 {
			id, _ := strconv.Atoi(matches[1])
			orderID = uint(id)
		} else {
			// 解析失败
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的二维码格式"})
			return
		}
	}

	// 查找订单
	var order models.Order
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}

	// 查找工人
	var worker models.Worker
	if err := database.DB.First(&worker, input.WorkerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "工人不存在"})
		return
	}

	// 根据工位更新状态
	// 流程: 待下料 -> 待裁面 -> 待封面 -> 待送货 -> 待收款 -> 已完成
	newStatus := order.Status

	switch worker.Station {
	case "下料":
		if order.Status == "待下料" {
			newStatus = "待裁面"
		}
	case "裁面":
		if order.Status == "待裁面" {
			newStatus = "待封面"
		}
	case "封面":
		if order.Status == "待封面" {
			newStatus = "待送货"
		}
	case "送货", "运货":
		if order.Status == "待送货" {
			newStatus = "待收款"
		}
	case "收款":
		if order.Status == "待收款" {
			newStatus = "已完成"
		}
	}

	// 如果状态有变化，执行更新
	if newStatus != order.Status {
		order.Status = newStatus
		database.DB.Save(&order)

		// 记录操作日志
		process := models.Process{
			OrderID:  order.ID,
			Station:  worker.Station,
			Status:   "Completed",
			WorkerID: worker.ID,
		}
		database.DB.Create(&process)

		c.JSON(http.StatusOK, gin.H{
			"message":     "操作成功",
			"order":       order,
			"prev_status": order.Status, // 返回旧状态以便区分
			"new_status":  newStatus,
		})
	} else {
		// 状态无变化（可能是重复扫描或流程不对）
		c.JSON(http.StatusOK, gin.H{
			"message": "状态未更新 (可能流程不符)",
			"order":   order,
		})
	}
}

// DeleteOrder 删除订单
func DeleteOrder(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}

	// 软删除
	database.DB.Delete(&order)
	c.JSON(http.StatusOK, gin.H{"message": "订单已删除"})
}

// UpdateOrderDetails 更新订单详情 (管理员编辑)
func UpdateOrderDetails(c *gin.Context) {
	var order models.Order
	if err := database.DB.First(&order, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
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

	// 更新字段
	order.CustomerName = input.CustomerName
	order.Phone = input.Phone
	order.Amount = input.Amount
	order.Specs = input.Specs
	order.Remark = input.Remark

	database.DB.Save(&order)
	c.JSON(http.StatusOK, order)
}
