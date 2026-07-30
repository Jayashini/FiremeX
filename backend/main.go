package main

import (
	"log"

	"github.com/gin-gonic/gin"

	// These imports tell Go to grab the code from the folders we just made!
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
)

func main() {
	// 1. Connect to the Database
	log.Println("Starting FiremeX backend...")
	database.ConnectDB()

	// 2. Run the AutoMigrate (This creates the users table in Postgres!)
	err := database.DB.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}
	log.Println("Database migration completed!")

	// 3. Initialize the Gin web framework (starts our HTTP router)
	router := gin.Default()

	// 4. Create a simple test route so we know the server is working
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong! FiremeX API is running.",
		})
	})

	// 5. Start the server on port 8080
	log.Println("Server is running on port 8080...")
	router.Run(":8080")
}
