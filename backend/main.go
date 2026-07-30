package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/firemex/backend/controllers"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/middleware"
	"github.com/firemex/backend/models"
)

func main() {
	// 1. Connect to the Database
	log.Println("Starting FiremeX backend...")
	database.ConnectDB()

	// 2. Run the AutoMigrate
	err := database.DB.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}
	log.Println("Database migration completed!")

	// 3. Initialize the Gin web framework
	router := gin.Default()

	// 4. Test Route
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong! FiremeX API is running."})
	})

	// 5. Authentication Routes
	router.POST("/register", controllers.Register)
	router.POST("/login", controllers.Login)

	// 6. Protected Routes (Require a valid JWT token)
	protected := router.Group("/api")
	protected.Use(middleware.RequireAuth) // Attach the Security Guard!
	{
		// This route is now protected!
		protected.GET("/dashboard", func(c *gin.Context) {
			userID, _ := c.Get("userID")
			c.JSON(200, gin.H{
				"message": "Welcome to the secret FiremeX dashboard!",
				"userID":  userID,
			})
		})
	}

	// 7. Start the server
	log.Println("Server is running on port 8080...")
	router.Run(":8080")
}
