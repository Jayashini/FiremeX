package middleware

import (
	"net/http"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

// RequireAdmin checks if the authenticated user has the 'admin' role.
// This middleware must be used AFTER RequireAuth (JWT middleware).
func RequireAdmin(c *gin.Context) {
	// 1. Get the userID that was set by the JWT middleware
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		c.Abort()
		return
	}

	// 2. Convert the userID to a float64 (JWT stores numbers as float64)
	userIDFloat, ok := userIDValue.(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID format"})
		c.Abort()
		return
	}
	userID := uint(userIDFloat)

	// 3. Look up this user in the database
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		c.Abort()
		return
	}

	// 4. Check if they are an admin
	if user.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		c.Abort()
		return
	}

	// 5. Store the full user object for controllers to use
	c.Set("currentUser", user)

	// 6. Allow the request to continue
	c.Next()
}
