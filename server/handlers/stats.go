package handlers

import (
	"net/http"
	"time"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

func GetDashboardStats(c *gin.Context) {
	// 1. Status Distribution
	statusStats := make([]struct {
		Status string `json:"name"`
		Count  int64  `json:"value"`
	}, 0)
	database.DB.Model(&models.Order{}).Select("status, count(*) as count").Group("status").Scan(&statusStats)

	// Ensure colors for specific statuses (Frontend will handle mapping, but we give raw data)

	// 2. Trend Analysis
	period := c.DefaultQuery("period", "week")
	type DailyStat struct {
		Date    string  `json:"date"`
		Revenue float64 `json:"revenue"`
		Count   int64   `json:"count"`
	}
	trend := make([]DailyStat, 0)

	now := time.Now()
	var format string
	var loopCount int
	var stepDate func(int) time.Time

	switch period {
	case "month":
		// Last 30 days
		format = "01-02"
		loopCount = 30
		stepDate = func(i int) time.Time { return now.AddDate(0, 0, -i) }
	case "year":
		// Last 12 months
		format = "2006-01"
		loopCount = 12
		stepDate = func(i int) time.Time { return now.AddDate(0, -i, 0) }
	default: // "week"
		// Last 7 days
		format = "01-02"
		loopCount = 7
		stepDate = func(i int) time.Time { return now.AddDate(0, 0, -i) }
	}

	for i := loopCount - 1; i >= 0; i-- {
		date := stepDate(i)

		var startOfPeriod, endOfPeriod time.Time
		if period == "year" {
			// Month start/end
			startOfPeriod = time.Date(date.Year(), date.Month(), 1, 0, 0, 0, 0, date.Location())
			endOfPeriod = startOfPeriod.AddDate(0, 1, 0)
		} else {
			// Day start/end
			startOfPeriod = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
			endOfPeriod = startOfPeriod.Add(24 * time.Hour)
		}

		dateStr := date.Format(format)

		var revenue float64
		var count int64

		database.DB.Model(&models.Order{}).
			Where("created_at >= ? AND created_at < ?", startOfPeriod, endOfPeriod).
			Count(&count)

		database.DB.Model(&models.Order{}).
			Where("created_at >= ? AND created_at < ?", startOfPeriod, endOfPeriod).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&revenue)

		trend = append(trend, DailyStat{
			Date:    dateStr,
			Revenue: revenue,
			Count:   count,
		})
	}

	// 3. Top Products (Top 5)
	// 3. Top Products (Top 5)
	type ProductStat struct {
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}
	topProducts := make([]ProductStat, 0)
	database.DB.Table("order_products").
		Joins("JOIN products ON products.id = order_products.product_id").
		Joins("JOIN orders ON orders.id = order_products.order_id").
		Where("products.deleted_at IS NULL").
		Where("orders.deleted_at IS NULL").
		Select("products.name, count(order_products.order_id) as count").
		Group("products.id, products.name").
		Order("count desc").
		Limit(5).
		Scan(&topProducts)

	// 4. Top Customers (Active Users)
	type CustomerStat struct {
		Name        string  `json:"name"`
		Count       int64   `json:"count"`
		TotalAmount float64 `json:"total_amount"`
	}
	topCustomers := make([]CustomerStat, 0)
	database.DB.Model(&models.Order{}).
		Select("customer_name as name, count(*) as count, sum(amount) as total_amount").
		Where("customer_name != ''").
		Group("customer_name").
		Order("count desc").
		Limit(5).
		Scan(&topCustomers)

	// 5. Global Counts
	var total int64
	var completed int64
	var revenue float64
	database.DB.Model(&models.Order{}).Count(&total)
	database.DB.Model(&models.Order{}).Where("status = ?", "已完成").Count(&completed)
	database.DB.Model(&models.Order{}).Select("COALESCE(SUM(amount), 0)").Scan(&revenue)

	c.JSON(http.StatusOK, gin.H{
		"status_dist":   statusStats,
		"trend":         trend,
		"top_products":  topProducts,
		"top_customers": topCustomers,
		"summary": gin.H{
			"total":     total,
			"completed": completed,
			"revenue":   revenue,
		},
	})
}

// GetStationStats 获取工位大屏所需数据
func GetStationStats(c *gin.Context) {
	// 1. Today's Overview (Time Range)
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	// 2. Total Output Today (Distinct Orders Completed/Processed Today)
	// We count how many distinct processes were recorded today (meaning a step was finished)
	var todayOutput int64
	database.DB.Model(&models.Process{}).Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).Count(&todayOutput)

	// 3. Worker Leaderboard (Top 3 by Process Count Today)
	type WorkerStat struct {
		Name    string `json:"name"`
		Station string `json:"station"`
		Count   int64  `json:"count"`
	}
	leaderboard := make([]WorkerStat, 0)
	database.DB.Model(&models.Process{}).
		Select("workers.name, workers.station, count(*) as count").
		Joins("join workers on workers.id = processes.worker_id").
		Where("processes.created_at >= ? AND processes.created_at < ?", startOfDay, endOfDay).
		Group("workers.id, workers.name, workers.station").
		Order("count desc").
		Limit(3).
		Scan(&leaderboard)

	// 4. Station Progress (Breakdown by Station Today)
	stationStats := make([]struct {
		Station string `json:"name"`
		Count   int64  `json:"value"`
	}, 0)
	database.DB.Model(&models.Process{}).
		Select("station, count(*) as count").
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Group("station").
		Scan(&stationStats)

	// 5. Recent Logs (Real-time feed, mixed success/error)
	var recentLogs []models.ScanLog
	database.DB.Order("created_at desc").Limit(20).Find(&recentLogs)

	// 6. Recent Error Logs (Specifically for the error list)
	var errorLogs []models.ScanLog
	database.DB.Where("is_success = ?", false).Order("created_at desc").Limit(10).Find(&errorLogs)

	// 7. Upcoming Orders (Next 3 Days)
	var upcomingOrders []models.Order
	threeDaysLater := startOfDay.AddDate(0, 0, 3)
	database.DB.Preload("Products").
		Where("deadline >= ? AND deadline < ? AND status != ?", startOfDay, threeDaysLater, "已完成").
		Order("deadline asc, id asc").
		Find(&upcomingOrders)

	c.JSON(http.StatusOK, gin.H{
		"today_output":    todayOutput,
		"leaderboard":     leaderboard,
		"station_dist":    stationStats,
		"recent_logs":     recentLogs,
		"error_logs":      errorLogs,
		"upcoming_orders": upcomingOrders,
	})
}

// GetWorkerStats 获取工人工作量统计
func GetWorkerStats(c *gin.Context) {
	// 日期范围参数
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -7).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	workerID := c.Query("worker_id") // 可选，指定工人

	// 解析日期
	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)
	end = end.Add(24 * time.Hour) // 包含结束日期整天

	// 1. 按工人统计总工作量
	type WorkerTotal struct {
		WorkerID   uint   `json:"worker_id"`
		WorkerName string `json:"worker_name"`
		Station    string `json:"station"`
		Count      int64  `json:"count"`
	}
	workerTotals := make([]WorkerTotal, 0)
	query := database.DB.Model(&models.Process{}).
		Select("workers.id as worker_id, workers.name as worker_name, workers.station, count(*) as count").
		Joins("join workers on workers.id = processes.worker_id").
		Where("processes.created_at >= ? AND processes.created_at < ?", start, end).
		Group("workers.id, workers.name, workers.station").
		Order("count desc")

	if workerID != "" {
		query = query.Where("workers.id = ?", workerID)
	}
	query.Scan(&workerTotals)

	// 2. 按日期统计每日工作量
	type DailyWork struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
	}
	dailyWork := make([]DailyWork, 0)

	// 遍历日期范围
	for d := start; d.Before(end); d = d.AddDate(0, 0, 1) {
		nextDay := d.AddDate(0, 0, 1)
		dateStr := d.Format("01-02")

		var count int64
		q := database.DB.Model(&models.Process{}).
			Where("created_at >= ? AND created_at < ?", d, nextDay)
		if workerID != "" {
			q = q.Where("worker_id = ?", workerID)
		}
		q.Count(&count)

		dailyWork = append(dailyWork, DailyWork{
			Date:  dateStr,
			Count: count,
		})
	}

	// 3. 按工位统计
	type StationWork struct {
		Station string `json:"station"`
		Count   int64  `json:"count"`
	}
	stationWork := make([]StationWork, 0)
	stationQuery := database.DB.Model(&models.Process{}).
		Select("station, count(*) as count").
		Where("created_at >= ? AND created_at < ?", start, end).
		Group("station").
		Order("count desc")
	if workerID != "" {
		stationQuery = stationQuery.Where("worker_id = ?", workerID)
	}
	stationQuery.Scan(&stationWork)

	// 4. 工人详细日志 (最近50条)
	var recentLogs []models.Process
	logQuery := database.DB.Where("created_at >= ? AND created_at < ?", start, end).
		Order("created_at desc").
		Limit(50)
	if workerID != "" {
		logQuery = logQuery.Where("worker_id = ?", workerID)
	}
	logQuery.Find(&recentLogs)

	c.JSON(http.StatusOK, gin.H{
		"worker_totals": workerTotals,
		"daily_work":    dailyWork,
		"station_work":  stationWork,
		"recent_logs":   recentLogs,
		"date_range": gin.H{
			"start": startDate,
			"end":   endDate,
		},
	})
}
