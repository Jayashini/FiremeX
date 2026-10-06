package middleware

import (
	"fmt"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"math"
	"net/http"
	"strings"

	"github.com/firemex/backend/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// extractToken finds the login token on a request.
//
// Two places, in order:
//
//  1. The Authorization header. Every fetch() call in the frontend sends this.
//  2. The session cookie. This exists for <img> and <video> tags - the browser
//     attaches cookies to those automatically, but a tag has no way to set a
//     header, so the camera stream could not authenticate any other way.
func extractToken(c *gin.Context) string {
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		parts := strings.SplitN(authHeader, "Bearer ", 2)
		if len(parts) < 2 {
			return ""
		}
		return strings.TrimSpace(parts[1])
	}

	if cookie, err := c.Cookie(config.SessionCookie); err == nil {
		return cookie
	}

	return ""
}

// RequireAuth is the Security Guard that runs before our private routes
func RequireAuth(c *gin.Context) {
	// 1. Find the token, from the header or the cookie
	tokenString := extractToken(c)

	// 2. If there isn't one, kick them out immediately
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		c.Abort() // Stop the request from going any further
		return
	}

	// 3. Parse and Verify the Holographic Signature of the token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Ensure the signing method is what we expect (HS256)
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("Unexpected signing method")
		}
		return config.C.JWTSecret, nil
	})

	// 4. If the token is fake or expired, kick them out
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		c.Abort()
		return
	}

	// 5. If the token is real, extract the User ID ("sub") we hid inside it
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Pass the User ID along to the next function so we know exactly who is logged in!
		c.Set("userID", claims["sub"])
	}

	// Resolve account state centrally on every protected request, including images.
	value, exists := c.Get("userID")
	id, valid := value.(float64)
	if !exists || !valid || math.IsNaN(id) || math.IsInf(id, 0) || id <= 0 || math.Trunc(id) != id || id > 9007199254740991 {
		c.AbortWithStatusJSON(401, gin.H{"error": "Invalid user ID"})
		return
	}
	var user models.User
	if err := database.DB.WithContext(c.Request.Context()).First(&user, uint(id)).Error; err != nil {
		c.AbortWithStatusJSON(401, gin.H{"error": "User not found"})
		return
	}
	if user.Status != "active" || user.OrganizationID == nil || *user.OrganizationID == 0 {
		c.AbortWithStatusJSON(403, gin.H{"error": "An active organization account is required"})
		return
	}
	c.Set("currentUser", user)

	c.Next()
}
