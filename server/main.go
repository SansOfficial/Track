package main

import (
	"trace-server/database"
	"trace-server/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	database.Connect()

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
		// Auth
		api.POST("/login", handlers.Login)

		// Orders
		api.POST("/orders", handlers.CreateOrder)
		api.DELETE("/orders/:id", handlers.DeleteOrder)
		api.PUT("/orders/:id", handlers.UpdateOrderDetails)
		api.GET("/orders", handlers.GetOrders)
		api.GET("/orders/:id", handlers.GetOrder)
		api.PUT("/orders/:id/status", handlers.UpdateOrderStatus)

		// Products
		api.POST("/products", handlers.CreateProduct)
		api.GET("/products", handlers.GetProducts)
		api.PUT("/products/:id", handlers.UpdateProduct)
		api.DELETE("/products/:id", handlers.DeleteProduct)

		// Workers
		api.POST("/workers", handlers.CreateWorker)
		api.PUT("/workers/:id", handlers.UpdateWorker)
		api.GET("/workers", handlers.GetWorkers)
		api.POST("/worker/login", handlers.LoginWorker) // Keep for manual testing if needed
		api.POST("/auth/wechat", handlers.WeChatLogin)
		api.POST("/auth/wechat/phone", handlers.WeChatPhoneLogin)
		api.POST("/worker/bind", handlers.BindWorker)
		api.POST("/worker/profile", handlers.UpdateProfile)

		// Public/Mini Program
		api.POST("/scan", handlers.ScanQRCode)

		// Dashboard Stats
		api.GET("/dashboard/stats", handlers.GetDashboardStats)
	}

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
