package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/firemex/backend/controllers"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/middleware"
	"github.com/firemex/backend/models"
	"github.com/gin-contrib/cors"
)

func main() {
	// 1. Connect to the Database
	log.Println("Starting FiremeX backend...")
	database.ConnectDB()

	// 2. Run the AutoMigrate for all models
	err := database.DB.AutoMigrate(&models.Organization{}, &models.User{})
	if err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}
	log.Println("Database migration completed!")

	// 3. Initialize the Gin web framework
	router := gin.Default()

	// 3.1 CORS Configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// 4. Test Route
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong! FiremeX API is running."})
	})

	// 5. Public Authentication Routes
	router.POST("/login", controllers.Login)

	// 5.1 Public Registration Routes
	router.POST("/register/organization", controllers.RegisterOrganization)
	router.POST("/register/operator", controllers.RegisterOperator)

	// 6. Protected Routes (Require a valid JWT token)
	protected := router.Group("/api")
	protected.Use(middleware.RequireAuth)
	{
		protected.GET("/dashboard", func(c *gin.Context) {
			userID, _ := c.Get("userID")
			c.JSON(200, gin.H{
				"message": "Welcome to the secret FiremeX dashboard!",
				"userID":  userID,
			})
		})
	}

	// 7. Admin-Only Routes (Require JWT + Admin role)
	admin := protected.Group("/")
	admin.Use(middleware.RequireAdmin)
	{
		admin.GET("/users", controllers.GetAllUsers)
		admin.PATCH("/users/:id/approve", controllers.ApproveUser)
		admin.DELETE("/users/:id/deny", controllers.DenyUser)
		admin.PATCH("/users/:id/revoke", controllers.RevokeUser)
	}

	// 8. Start the server
	log.Println("Server is running on port 8080...")
	router.Run(":8080")
}
