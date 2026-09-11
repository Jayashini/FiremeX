package controllers

import (
	"net/http"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// The shapes below are what the frontend receives when it asks "who am I".
// They are built explicitly rather than returning models.User directly, so a
// field added to the model later cannot leak into an API response by accident.

type organizationResponse struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	Sector string `json:"sector"`
	Email  string `json:"email"`
	Phone  string `json:"phone"`
	// Code is the operator join code. Anyone holding it can request access to
	// the organisation, so it is only ever sent to administrators.
	Code string `json:"code,omitempty"`
}

type userResponse struct {
	ID           uint                  `json:"id"`
	Name         string                `json:"name"`
	Email        string                `json:"email"`
	Role         string                `json:"role"`
	Status       string                `json:"status"`
	MemberSince  string                `json:"member_since"`
	Organization *organizationResponse `json:"organization,omitempty"`
}

// buildUserResponse converts a user (with Organization preloaded) into the
// shape the frontend expects. Used by both login and GET /api/me so the two
// can never drift apart.
func buildUserResponse(user models.User) userResponse {
	response := userResponse{
		ID:          user.ID,
		Name:        user.Name,
		Email:       user.Email,
		Role:        user.Role,
		Status:      user.Status,
		MemberSince: user.CreatedAt.Format("2006-01-02"),
	}

	if user.Organization != nil {
		org := organizationResponse{
			ID:     user.Organization.ID,
			Name:   user.Organization.Name,
			Sector: user.Organization.Sector,
			Email:  user.Organization.Email,
			Phone:  user.Organization.Phone,
		}
		if user.Role == "admin" {
			org.Code = user.Organization.Code
		}
		response.Organization = &org
	}

	return response
}

// loadFullUser re-reads a user with their organisation attached.
func loadFullUser(id uint) (models.User, error) {
	var user models.User
	err := database.DB.Preload("Organization").First(&user, id).Error
	return user, err
}

// GetMe returns the logged-in user. The frontend calls this after a page
// refresh, when it has a token in storage but nothing else.
func GetMe(c *gin.Context) {
	user, ok := currentUser(c)
	if !ok {
		return
	}

	full, err := loadFullUser(user.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": buildUserResponse(full)})
}

// UpdateMe changes the display name of the logged-in user.
//
// Only the name is accepted. Role, status and organisation are deliberately
// not editable here - otherwise an operator could promote themselves to
// administrator with a single request.
func UpdateMe(c *gin.Context) {
	user, ok := currentUser(c)
	if !ok {
		return
	}

	var input struct {
		Name string `json:"name" binding:"required,min=2"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A name of at least 2 characters is required"})
		return
	}

	if err := database.DB.Model(&models.User{}).
		Where("id = ?", user.ID).
		Update("name", input.Name).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	full, err := loadFullUser(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reload profile"})
		return
	}

	// Both caches now hold the old name.
	c.Set("currentUser", full)
	forgetUser(full.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated",
		"user":    buildUserResponse(full),
	})
}

// ChangePassword updates the logged-in user's own password.
//
// The current password is required: a stolen token alone must not be enough to
// lock the real owner out of their account.
func ChangePassword(c *gin.Context) {
	user, ok := currentUser(c)
	if !ok {
		return
	}

	var input struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Current password and a new password of at least 6 characters are required",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	if input.NewPassword == input.CurrentPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "The new password must be different from the current one"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure the new password"})
		return
	}

	if err := database.DB.Model(&models.User{}).
		Where("id = ?", user.ID).
		Update("password", string(hashed)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	forgetUser(user.ID)

	// Tokens are stateless, so sessions issued before this change stay valid
	// until they expire. Say so rather than implying everything was signed out.
	c.JSON(http.StatusOK, gin.H{
		"message": "Password updated. Sessions already signed in stay valid until they expire.",
	})
}
