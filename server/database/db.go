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

	// 清理旧表结构（可以清空数据）
	// 删除旧的 categories 相关表
	if DB.Migrator().HasTable("product_attribute_values") {
		DB.Exec("DROP TABLE IF EXISTS product_attribute_values")
	}
	if DB.Migrator().HasTable("category_attributes") {
		DB.Exec("DROP TABLE IF EXISTS category_attributes")
	}
	if DB.Migrator().HasTable("categories") {
		DB.Exec("DROP TABLE IF EXISTS categories")
	}

	// 修复 order_products 表结构问题
	if DB.Migrator().HasTable("order_products") {
		var count int64
		DB.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_products' AND column_name = 'id' AND column_key = 'PRI'").Scan(&count)
		if count == 0 {
			log.Println("order_products table has incorrect structure, dropping and recreating...")
			DB.Exec("SET FOREIGN_KEY_CHECKS = 0")
			DB.Exec("DROP TABLE IF EXISTS order_products")
			DB.Exec("SET FOREIGN_KEY_CHECKS = 1")
		}
	}

	err = DB.AutoMigrate(
		&models.User{},
		&models.Worker{},
		&models.Order{},
		&models.Process{},
		&models.Product{},
		&models.ProductAttribute{},
		&models.OrderProduct{},
		&models.Customer{},
		&models.ScanLog{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// 初始化默认产品
	seedProducts()
}

// seedProducts 初始化默认产品
func seedProducts() {
	defaultProducts := []models.Product{
		{Name: "榻榻米垫", Code: "TTM-001", Icon: "🛏️", SortOrder: 1},
		{Name: "回弹棉", Code: "HTM-001", Icon: "🧶", SortOrder: 2},
		{Name: "软包", Code: "RB-001", Icon: "🧱", SortOrder: 3},
		{Name: "木制品", Code: "MZP-001", Icon: "🪵", SortOrder: 4},
		{Name: "电地热", Code: "DDR-001", Icon: "🔥", SortOrder: 5},
	}

	for _, prod := range defaultProducts {
		var existing models.Product
		if err := DB.Where("code = ?", prod.Code).First(&existing).Error; err != nil {
			// 不存在则创建
			DB.Create(&prod)
		}
	}
}
