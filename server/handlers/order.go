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
	"gorm.io/gorm"
)

// CreateOrder 创建新订单
func CreateOrder(c *gin.Context) {
	type OrderItemInput struct {
		ProductID uint    `json:"product_id"`
		Length    float64 `json:"length"`
		Width     float64 `json:"width"`
		Height    float64 `json:"height"`
		Quantity  int     `json:"quantity"`
		Unit      string  `json:"unit"` // 计量单位
		UnitPrice float64 `json:"unit_price"`
	}

	var input struct {
		models.Order
		Items       []OrderItemInput `json:"items"`
		DeadlineStr string           `json:"deadline_str"`
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
	if len(input.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须选择至少一个产品"})
		return
	}

	order := input.Order
	order.Status = "待下料" // 初始状态

	if input.DeadlineStr != "" {
		// Assuming format YYYY-MM-DD
		t, err := time.Parse("2006-01-02", input.DeadlineStr)
		if err == nil {
			order.Deadline = &t
		}
	}

	// 关联产品 (使用 OrderProduct)
	if len(input.Items) > 0 {
		var orderProducts []models.OrderProduct
		for _, item := range input.Items {
			// Calculate total price for this line item
			total := item.UnitPrice * float64(item.Quantity)
			op := models.OrderProduct{
				ProductID:  item.ProductID,
				Length:     item.Length,
				Width:      item.Width,
				Height:     item.Height,
				Quantity:   item.Quantity,
				Unit:       item.Unit,
				UnitPrice:  item.UnitPrice,
				TotalPrice: total,
			}
			orderProducts = append(orderProducts, op)
		}
		order.OrderProducts = orderProducts
	}

	// OrderNo generation logic...
	now := time.Now()
	timestamp := now.Format("20060102150405")
	randomPart := rand.Intn(900000) + 100000 // 6位随机数
	order.OrderNo = fmt.Sprintf("ORD-%s-%06d", timestamp, randomPart)

	// Check if customer exists, if not create
	var existingCustomer models.Customer
	if err := database.DB.Where("phone = ?", order.Phone).First(&existingCustomer).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			newCustomer := models.Customer{
				Name:  order.CustomerName,
				Phone: order.Phone,
			}
			database.DB.Create(&newCustomer)
		}
	} else {
		// Update name if different? Optional. Let's just create if missing for now.
	}

	// 保存到数据库
	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 生成用于扫码的标识符（不含域名，方便跨网络测试）
	order.QRCode = fmt.Sprintf("ORDER-%d", order.ID)
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
	query := database.DB.Model(&models.Order{}).
		Preload("OrderProducts").
		Preload("OrderProducts.Product").
		Preload("OrderProducts.Product.AttributeValues.Attribute")
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
	if err := database.DB.
		Preload("OrderProducts").
		Preload("OrderProducts.Product").
		Preload("OrderProducts.Product.Category").
		Preload("OrderProducts.Product.AttributeValues.Attribute").
		First(&order, c.Param("id")).Error; err != nil {
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
		QRCode      string `json:"qr_code"`
		WorkerID    uint   `json:"worker_id"`
		ScannerCode string `json:"scanner_code"` // 新增：扫码枪代码前缀
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
	// 优先使用 ScannerCode 查找
	if input.ScannerCode != "" {
		if err := database.DB.Where("scanner_code = ?", input.ScannerCode).First(&worker).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "无效的扫码枪代码: " + input.ScannerCode})
			return
		}
	} else if input.WorkerID > 0 {
		// 兼容旧模式：使用 WorkerID
		if err := database.DB.First(&worker, input.WorkerID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "工人不存在"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未提供工人身份信息"})
		return
	}

	// Helper to log scan
	logScan := func(success bool, msg string) {
		log := models.ScanLog{
			WorkerID:    worker.ID,
			WorkerName:  worker.Name,
			Station:     worker.Station,
			Content:     input.QRCode,
			ScannerCode: input.ScannerCode,
			IsSuccess:   success,
			Message:     msg,
			OrderID:     order.ID,
		}
		database.DB.Create(&log)
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

		// 记录操作日志 (Process)
		process := models.Process{
			OrderID:     order.ID,
			Station:     worker.Station,
			Status:      "Completed",
			WorkerID:    worker.ID,
			CompletedAt: time.Now(),
		}
		database.DB.Create(&process)

		logScan(true, fmt.Sprintf("订单 %s 状态更新为 %s", order.OrderNo, newStatus))

		c.JSON(http.StatusOK, gin.H{
			"message":     "操作成功",
			"order":       order,
			"prev_status": order.Status, // 返回旧状态以便区分
			"new_status":  newStatus,
		})
	} else {
		// 状态无变化（可能是重复扫描或流程不对）
		msg := fmt.Sprintf("状态未更新: 当前状态 %s, 工位 %s 不匹配或无需流转", order.Status, worker.Station)
		logScan(false, msg)

		c.JSON(http.StatusOK, gin.H{
			"message": msg,
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

	type OrderItemInput struct {
		ProductID uint    `json:"product_id"`
		Length    float64 `json:"length"`
		Width     float64 `json:"width"`
		Height    float64 `json:"height"`
		Quantity  int     `json:"quantity"`
		Unit      string  `json:"unit"`
		UnitPrice float64 `json:"unit_price"`
	}

	var input struct {
		CustomerName string           `json:"customer_name"`
		Phone        string           `json:"phone"`
		Address      string           `json:"address"`
		Amount       float64          `json:"amount"`
		Specs        string           `json:"specs"`
		Remark       string           `json:"remark"`
		DeadlineStr  string           `json:"deadline_str"`
		Items        []OrderItemInput `json:"items"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.CustomerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "客户姓名不能为空"})
		return
	}

	// 更新订单基本信息
	order.CustomerName = input.CustomerName
	order.Phone = input.Phone
	order.Address = input.Address
	order.Amount = input.Amount
	order.Specs = input.Specs
	order.Remark = input.Remark

	if input.DeadlineStr != "" {
		t, err := time.Parse("2006-01-02", input.DeadlineStr)
		if err == nil {
			order.Deadline = &t
		}
	}

	// 如果提供了产品明细，则更新
	if len(input.Items) > 0 {
		// 删除旧的产品明细
		database.DB.Where("order_id = ?", order.ID).Delete(&models.OrderProduct{})

		// 创建新的产品明细
		var totalAmount float64 = 0
		for _, item := range input.Items {
			op := models.OrderProduct{
				OrderID:    order.ID,
				ProductID:  item.ProductID,
				Length:     item.Length,
				Width:      item.Width,
				Height:     item.Height,
				Quantity:   item.Quantity,
				Unit:       item.Unit,
				UnitPrice:  item.UnitPrice,
				TotalPrice: item.UnitPrice * float64(item.Quantity),
			}
			database.DB.Create(&op)
			totalAmount += op.TotalPrice
		}
		order.Amount = totalAmount
	}

	database.DB.Save(&order)

	// 重新加载完整订单数据返回
	database.DB.Preload("OrderProducts").Preload("OrderProducts.Product").First(&order, order.ID)
	c.JSON(http.StatusOK, order)
}
