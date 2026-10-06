package main

import (
	"context"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/internal/detection"
	"github.com/firemex/backend/internal/incidents"
	"github.com/firemex/backend/internal/inference"
	"log"
	"net/http"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

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
	// Order matters: a table is created after the tables it points at, so
	// Incident - which references both Camera and User - comes last.
	err := database.DB.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Camera{},
		&models.Incident{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}
	log.Println("Database migration completed!")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	controllers.Snapshots = cameras.New(config.C.HAURL, config.C.HAToken, config.C.SnapshotTTL)
	controllers.IncidentStore = &incidents.Store{DB: database.DB, Evidence: &incidents.Evidence{Dir: filepath.Join(config.C.DataDir, "evidence"), MaxBytes: config.C.EvidenceMaxBytes}, Cooldown: config.C.IncidentCooldown, Retention: config.C.EvidenceRetention}
	controllers.Detector = detection.New(database.DB, controllers.Snapshots, inference.New(config.C.ModelURL, config.C.ModelTimeout), controllers.IncidentStore, config.C)
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); controllers.Detector.Run(ctx) }()

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
		protected.GET("/incidents", controllers.GetIncidents)
		protected.GET("/incidents/:id", controllers.GetIncident)
		protected.GET("/incidents/:id/snapshot", controllers.IncidentSnapshot)
		protected.GET("/detection/status", controllers.DetectionStatus)
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
		admin.PATCH("/cameras/:id/detection", controllers.ToggleDetection)

		// Settings page: organisation details and dependency health
		admin.PATCH("/organization", controllers.UpdateOrganization)
		admin.GET("/system/status", controllers.GetSystemStatus)
	}

	// 8. Start the server
	log.Println("Server is running on port " + config.C.Port + "...")
	server := &http.Server{Addr: ":" + config.C.Port, Handler: router, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("server failed: %v", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	server.Shutdown(shutdown)
	select {
	case <-workerDone:
	case <-shutdown.Done():
		log.Println("worker shutdown timed out")
	}

}
