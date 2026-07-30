package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// NOTE: This must perfectly match the secret key in auth.go!
var jwtSecret = []byte("super_secret_firemex_key_123")

// RequireAuth is the Security Guard that runs before our private routes
func RequireAuth(c *gin.Context) {
	// 1. Look for the "Authorization" header in the incoming request
	authHeader := c.GetHeader("Authorization")

	// 2. If it's empty, kick them out immediately
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		c.Abort() // Stop the request from going any further
		return
	}

	// 3. The token usually comes in as "Bearer eyJhbGci...", so we split it to just get the token part
	tokenString := strings.Split(authHeader, "Bearer ")
	if len(tokenString) < 2 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
		c.Abort()
		return
	}

	// 4. Parse and Verify the Holographic Signature of the token
	token, err := jwt.Parse(tokenString[1], func(token *jwt.Token) (interface{}, error) {
		// Ensure the signing method is what we expect (HS256)
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("Unexpected signing method")
		}
		return jwtSecret, nil
	})

	// 5. If the token is fake or expired, kick them out
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		c.Abort()
		return
	}

	// 6. If the token is real, extract the User ID ("sub") we hid inside it
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Pass the User ID along to the next function so we know exactly who is logged in!
		c.Set("userID", claims["sub"])
	}

	// 7. Open the gate! Let the request continue to the controller.
	c.Next()
}
