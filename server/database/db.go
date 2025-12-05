package database

import (
	"log"
	"trace-server/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	var err error
	DB, err = gorm.Open(sqlite.Open("trace.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = DB.AutoMigrate(&models.User{}, &models.Worker{}, &models.Order{}, &models.Process{}, &models.Product{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
}
