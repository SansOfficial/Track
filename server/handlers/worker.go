package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	worker.OpenID = input.OpenID
	// We don't update Avatar/Nickname here usually, but we could. For now let's stick to admin fields.

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

func WeChatLogin(c *gin.Context) {
	var input struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Real WeChat API Call
	// Used constants defined below
	appID := AppID
	appSecret := AppSecret

	url := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code", appID, appSecret, input.Code)

	resp, err := http.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call WeChat API"})
		return
	}
	defer resp.Body.Close()

	var wechatResp struct {
		OpenID     string `json:"openid"`
		SessionKey string `json:"session_key"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&wechatResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode WeChat response"})
		return
	}

	if wechatResp.ErrCode != 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("WeChat API Error: %s", wechatResp.ErrMsg)})
		return
	}

	openid := wechatResp.OpenID

	var worker models.Worker
	if err := database.DB.Where("open_id = ?", openid).First(&worker).Error; err != nil {
		// Not bound yet, return openid
		c.JSON(http.StatusOK, gin.H{"bound": false, "openid": openid})
		return
	}

	c.JSON(http.StatusOK, gin.H{"bound": true, "worker": worker})
}

func BindWorker(c *gin.Context) {
	var input struct {
		WorkerID uint   `json:"worker_id"`
		OpenID   string `json:"openid"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var worker models.Worker
	if err := database.DB.First(&worker, input.WorkerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	worker.OpenID = input.OpenID
	if input.Nickname != "" {
		worker.Nickname = input.Nickname
	}
	if input.Avatar != "" {
		worker.Avatar = input.Avatar
	}
	database.DB.Save(&worker)

	c.JSON(http.StatusOK, worker)
}

const (
	AppID     = "wxa47a69291fa47902"
	AppSecret = "61aaed56aa9eb75751e9982f3fd7fe50"
)

func getAccessToken() (string, error) {
	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s", AppID, AppSecret)
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("WeChat Token Error: %s", result.ErrMsg)
	}
	return result.AccessToken, nil
}

func WeChatPhoneLogin(c *gin.Context) {
	var input struct {
		Code   string `json:"code"`
		OpenID string `json:"openid"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Get Access Token
	accessToken, err := getAccessToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 2. Get Phone Number
	url := fmt.Sprintf("https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=%s", accessToken)
	reqBody, _ := json.Marshal(map[string]string{"code": input.Code})
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call WeChat Phone API"})
		return
	}
	defer resp.Body.Close()

	var phoneResp struct {
		ErrCode   int    `json:"errcode"`
		ErrMsg    string `json:"errmsg"`
		PhoneInfo struct {
			PhoneNumber string `json:"phoneNumber"`
		} `json:"phone_info"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&phoneResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode Phone response"})
		return
	}
	if phoneResp.ErrCode != 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("WeChat Phone Error: %s", phoneResp.ErrMsg)})
		return
	}

	phone := phoneResp.PhoneInfo.PhoneNumber

	// 3. Find Worker
	var worker models.Worker
	if err := database.DB.Where("phone = ?", phone).First(&worker).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "您不是授权工人，请联系管理员"})
		return
	}

	// 4. Bind OpenID if provided
	if input.OpenID != "" {
		worker.OpenID = input.OpenID
		database.DB.Save(&worker)
	}

	c.JSON(http.StatusOK, gin.H{"worker": worker})
}

func UpdateProfile(c *gin.Context) {
	var input struct {
		WorkerID uint   `json:"worker_id"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var worker models.Worker
	if err := database.DB.First(&worker, input.WorkerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Worker not found"})
		return
	}

	worker.Nickname = input.Nickname
	worker.Avatar = input.Avatar
	database.DB.Save(&worker)

	c.JSON(http.StatusOK, worker)
}

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
