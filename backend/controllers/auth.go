package controllers

import (
	"net/http"
	"time"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Login verifies credentials and gives the user a JWT ticket
// sessionLifetime is how long a login lasts. The JWT expiry and the cookie
// max-age are both derived from it so the two can never drift apart.
const sessionLifetime = 24 * time.Hour

func Login(c *gin.Context) {
	// 1. Create a struct to catch the login request (only needs email and password)
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// 2. Search the database for a user with this email
	var user models.User
	if err := database.DB.Preload("Organization").Where("email = ?", input.Email).First(&user).Error; err != nil {
		// We purposefully give a vague error so hackers don't know if the email exists
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// 3. Compare the typed password with the scrambled password in the database
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// 3.5 Check if the user's account is approved
	if user.Status == "pending" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your account is pending administrator approval"})
		return
	}
	if user.Status == "revoked" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your account access has been revoked"})
		return
	}

	// 4. Create the JWT digital ticket
	// We store their User ID and when the ticket expires (e.g., in 24 hours)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": time.Now().Add(sessionLifetime).Unix(),
	})

	// 5. Sign the ticket with our secret key
	tokenString, err := token.SignedString(config.C.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// 6. Send the token back to the frontend!
	// The same token also goes out as a cookie.
	//
	// The camera feed is an <img> tag pointed at /api/cameras/stream/... and an
	// image request cannot carry an Authorization header, so without this the
	// stream is the one endpoint the browser can never authenticate against.
	//
	//   HttpOnly      JavaScript cannot read it, so an XSS bug cannot steal it
	//   SameSiteStrict another site cannot embed the feed using this session
	//   secure=false   required over plain http; must become true behind HTTPS
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(config.SessionCookie, tokenString, int(sessionLifetime.Seconds()), "/", "", false, true)

	// The user is returned alongside the token so the frontend knows which
	// screens to show without an extra round trip. This is for display only -
	// permission is always re-checked server-side on every request.
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   tokenString,
		"user":    buildUserResponse(user),
	})
}

// Logout clears the session cookie.
//
// The JWT itself is stateless and stays valid until it expires - this only
// removes the browser's copy. It is deliberately a public route so that an
// already-expired session can still be cleaned up.
func Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(config.SessionCookie, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Signed out"})
}
