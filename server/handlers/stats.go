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

	// 4. Global Counts
	var total int64
	var completed int64
	var revenue float64
	database.DB.Model(&models.Order{}).Count(&total)
	database.DB.Model(&models.Order{}).Where("status = ?", "已完成").Count(&completed)
	database.DB.Model(&models.Order{}).Select("COALESCE(SUM(amount), 0)").Scan(&revenue)

	c.JSON(http.StatusOK, gin.H{
		"status_dist":  statusStats,
		"trend":        trend,
		"top_products": topProducts,
		"summary": gin.H{
			"total":     total,
			"completed": completed,
			"revenue":   revenue,
		},
	})
}
