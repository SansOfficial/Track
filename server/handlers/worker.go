package handlers

import (
	"net/http"
	"strconv"
	"trace-server/database"
	"trace-server/models"

	"github.com/gin-gonic/gin"
)

func CreateWorker(c *gin.Context) {
	var worker models.Worker
	if err := c.ShouldBindJSON(&worker); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if worker.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "工人姓名不能为空"})
		return
	}

	if err := database.DB.Create(&worker).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, worker)
}

func UpdateWorker(c *gin.Context) {
	id := c.Param("id")
	var worker models.Worker
	if err := database.DB.First(&worker, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	var input models.Worker
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "工人姓名不能为空"})
		return
	}

	worker.Name = input.Name
	worker.Station = input.Station
	worker.Phone = input.Phone
	worker.ScannerCode = input.ScannerCode

	database.DB.Save(&worker)
	c.JSON(http.StatusOK, worker)
}

func GetWorkers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	offset := (page - 1) * pageSize

	var workers []models.Worker
	var total int64
	query := database.DB.Model(&models.Worker{})

	// Filters
	station := c.Query("station")
	if station != "" {
		query = query.Where("station = ?", station)
	}

	q := c.Query("q")
	if q != "" {
		wildcard := "%" + q + "%"
		query = query.Where("name LIKE ? OR phone LIKE ?", wildcard, wildcard)
	}

	query.Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&workers)

	c.JSON(http.StatusOK, gin.H{
		"data":  workers,
		"total": total,
		"page":  page,
	})
}

func GetWorker(c *gin.Context) {
	var worker models.Worker
	if err := database.DB.First(&worker, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}
	c.JSON(http.StatusOK, worker)
}

func LoginWorker(c *gin.Context) {
	var input struct {
		Phone string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var worker models.Worker
	if err := database.DB.Where("phone = ?", input.Phone).First(&worker).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	c.JSON(http.StatusOK, worker)
}

// WeChat-related authentication functions have been removed.
// Workers now use the Station mode or direct LoginWorker API.

func DeleteWorker(c *gin.Context) {
	id := c.Param("id")
	var worker models.Worker
	if err := database.DB.First(&worker, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	if err := database.DB.Delete(&worker).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete worker"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Worker deleted successfully"})
}
