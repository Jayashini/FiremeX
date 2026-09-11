package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/controllers"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/middleware"
	"github.com/firemex/backend/models"
	"github.com/gin-contrib/cors"
)

func main() {
	// 0. Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found or failed to load. Using default environment variables.")
	}

	// 0.1 Load all settings into config.C.
	// This must happen after godotenv.Load() and before anything reads config.
	config.Load()

	// 1. Connect to the Database
	log.Println("Starting FiremeX backend...")
	database.ConnectDB()

	// 2. Run the AutoMigrate for all models
	err := database.DB.AutoMigrate(&models.Organization{}, &models.User{}, &models.Camera{})
	if err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}
	log.Println("Database migration completed!")

	// 3. Initialize the Gin web framework
	router := gin.Default()

	// 3.1 CORS Configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     config.C.CORSOrigins,
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

	// Public so an already-expired session can still clear its cookie.
	router.POST("/logout", controllers.Logout)

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

		// Camera routes for authenticated users
		protected.GET("/cameras", controllers.GetCameras)
		protected.GET("/cameras/stream/:entity_id", controllers.StreamCamera)
		// Single still frame. Used by the dashboard, because MJPEG does not
		// work for RTSP cameras, and by the detection loop later.
		protected.GET("/cameras/snapshot/:entity_id", controllers.SnapshotCamera)

		// The logged-in user's own account (profile page)
		protected.GET("/me", controllers.GetMe)
		protected.PATCH("/me", controllers.UpdateMe)
		protected.POST("/me/password", controllers.ChangePassword)

		// Read-only view of the caller's organisation.
		// The join code is included for admins only - see me.go.
		protected.GET("/organization", controllers.GetOrganization)
	}

	// 7. Admin-Only Routes (Require JWT + Admin role)
	admin := protected.Group("/")
	admin.Use(middleware.RequireAdmin)
	{
		admin.GET("/users", controllers.GetAllUsers)
		admin.PATCH("/users/:id/approve", controllers.ApproveUser)
		admin.DELETE("/users/:id/deny", controllers.DenyUser)
		admin.PATCH("/users/:id/revoke", controllers.RevokeUser)

		// Camera management routes for admins
		admin.GET("/cameras/available", controllers.GetAvailableCameras)
		admin.POST("/cameras", controllers.AddCamera)
		admin.DELETE("/cameras/:id", controllers.DeleteCamera)

		// Settings page: organisation details and dependency health
		admin.PATCH("/organization", controllers.UpdateOrganization)
		admin.GET("/system/status", controllers.GetSystemStatus)
	}

	// 8. Start the server
	log.Println("Server is running on port " + config.C.Port + "...")
	router.Run(":" + config.C.Port)
}
