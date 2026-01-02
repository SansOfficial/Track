package database

import (
	"fmt"
	"log"
	"trace-server/config"
	"trace-server/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load config:", err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
		cfg.Database.Charset,
	)

	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = DB.AutoMigrate(
		&models.User{},
		&models.Worker{},
		&models.Order{},
		&models.Process{},
		&models.Product{},
		&models.OrderProduct{}, // Added OrderProduct
		&models.Customer{},
		&models.ScanLog{},
		&models.Category{},
		&models.CategoryAttribute{},
		&models.ProductAttributeValue{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// 初始化默认分类
	seedCategories()
}

// seedCategories 初始化默认产品分类
func seedCategories() {
	defaultCategories := []models.Category{
		{Name: "榻榻米", Icon: "🛏️", SortOrder: 1},
		{Name: "回弹棉", Icon: "🧶", SortOrder: 2},
		{Name: "软包", Icon: "🧱", SortOrder: 3},
		{Name: "木制品", Icon: "🪵", SortOrder: 4},
		{Name: "电地热", Icon: "🔥", SortOrder: 5},
	}

	for _, cat := range defaultCategories {
		var existing models.Category
		if err := DB.Where("name = ?", cat.Name).First(&existing).Error; err != nil {
			// 不存在则创建
			DB.Create(&cat)
		}
	}
}
