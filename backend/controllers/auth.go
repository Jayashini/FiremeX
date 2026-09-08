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
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	})

	// 5. Sign the ticket with our secret key
	tokenString, err := token.SignedString(config.C.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// 6. Send the token back to the frontend!
	// The user is returned alongside the token so the frontend knows which
	// screens to show without an extra round trip. This is for display only -
	// permission is always re-checked server-side on every request.
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   tokenString,
		"user":    buildUserResponse(user),
	})
}
