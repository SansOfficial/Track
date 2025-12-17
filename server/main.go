package main

import (
	"fmt"
	"trace-server/database"
	"trace-server/handlers"
	"trace-server/middleware"
	"trace-server/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func main() {
	database.Connect()
	seedAdmin()

	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	api := r.Group("/api")
	{
		// Public Auth
		api.POST("/login", handlers.Login)

		// Public/Worker Routes
		api.POST("/scan", handlers.ScanQRCode)
		api.POST("/worker/login", handlers.LoginWorker)
		api.GET("/workers/:id", handlers.GetWorker) // Public for Station App Identifier Check

		// Worker Order Operations
		api.GET("/orders/:id", handlers.GetOrder) // Used by Worker to see details

		api.PUT("/orders/:id/status", handlers.UpdateOrderStatus) // Used by Worker to update status
		api.GET("/station/stats", handlers.GetStationStats)       // Public for Station Dashboard

		// Protected Admin Routes
		admin := api.Group("/")
		admin.Use(middleware.AuthMiddleware())
		{
			// Dashboard
			admin.GET("/dashboard/stats", handlers.GetDashboardStats)

			// Orders (Admin Operations)
			admin.POST("/orders", handlers.CreateOrder)
			admin.DELETE("/orders/:id", handlers.DeleteOrder)
			admin.PUT("/orders/:id", handlers.UpdateOrderDetails)
			admin.GET("/orders", handlers.GetOrders)

			// Products
			admin.POST("/products", handlers.CreateProduct)
			admin.GET("/products", handlers.GetProducts)
			admin.PUT("/products/:id", handlers.UpdateProduct)
			admin.DELETE("/products/:id", handlers.DeleteProduct)

			// Workers (Admin Management)
			admin.POST("/workers", handlers.CreateWorker)
			admin.PUT("/workers/:id", handlers.UpdateWorker)
			admin.DELETE("/workers/:id", handlers.DeleteWorker)
			admin.GET("/workers", handlers.GetWorkers)

			// Upload
			admin.POST("/upload", handlers.UploadFile)

			// Customers
			admin.GET("/customers", handlers.GetCustomers)
			admin.POST("/customers", handlers.CreateCustomer)
			admin.PUT("/customers/:id", handlers.UpdateCustomer)
			admin.DELETE("/customers/:id", handlers.DeleteCustomer)
		}
	}

	// Serve Uploaded Images
	r.Static("/uploads", "./uploads")

	// Serve Static Files (Frontend)
	r.Static("/assets", "./dist/assets")
	r.StaticFile("/favicon.ico", "./dist/favicon.ico")
	r.StaticFile("/", "./dist/index.html")

	// SPA Fallback: For any other route (not starting with /api), serve index.html
	r.NoRoute(func(c *gin.Context) {
		c.File("./dist/index.html")
	})

	r.Run(":8080")
}

func seedAdmin() {
	var user models.User
	result := database.DB.Where("username = ?", "admin").First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
			admin := models.User{
				Username: "admin",
				Password: string(hashedPassword),
				Role:     "admin",
			}
			if err := database.DB.Create(&admin).Error; err != nil {
				// Log error but don't crash, maybe it's a soft delete conflict
				fmt.Printf("Failed to seed admin: %v\n", err)
			} else {
				fmt.Println("Admin user seeded successfully.")
			}
		}
	}
	seedCustomers()
}

func seedCustomers() {
	// Seed customers from existing orders if they don't exist
	var orders []models.Order
	database.DB.Find(&orders)

	count := 0
	for _, order := range orders {
		if order.Phone == "" {
			continue
		}
		var customer models.Customer
		if err := database.DB.Where("phone = ?", order.Phone).First(&customer).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				newCustomer := models.Customer{
					Name:   order.CustomerName,
					Phone:  order.Phone,
					Remark: "导入自订单" + order.OrderNo,
				}
				database.DB.Create(&newCustomer)
				count++
			}
		}
	}
	if count > 0 {
		fmt.Printf("Imported %d customers from existing orders.\n", count)
	}
}
