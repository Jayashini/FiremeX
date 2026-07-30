package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB is a global variable that holds our database connection
var DB *gorm.DB

// ConnectDB initializes the database connection
func ConnectDB() {
	// 1. Define the connection string (Data Source Name)
	dsn := "host=localhost user=admin password=secretpassword dbname=firemex port=5432 sslmode=disable"

	// 2. Open the connection using GORM
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})

	// 3. Check if there was an error connecting
	if err != nil {
		log.Fatal("Failed to connect to the database! \n", err)
	}

	log.Println("Successfully connected to the database!")
}
