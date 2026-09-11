package controllers

import (
	"net/http"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

// Every handler here is admin-only (see main.go) AND scoped to the caller's
// own organisation. When a record belongs to another organisation we answer
// 404 rather than 403, so an administrator cannot use these endpoints to
// discover that an account exists somewhere else in the system.

// GetAllUsers returns this organisation's users, split into active and pending
func GetAllUsers(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}

	var activeUsers []models.User
	var pendingUsers []models.User

	database.DB.Preload("Organization").
		Where("organization_id = ? AND status = ?", orgID, "active").
		Find(&activeUsers)

	database.DB.Preload("Organization").
		Where("organization_id = ? AND status = ?", orgID, "pending").
		Find(&pendingUsers)

	c.JSON(http.StatusOK, gin.H{
		"active":  activeUsers,
		"pending": pendingUsers,
	})
}

// ApproveUser changes a pending user's status to active
func ApproveUser(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	id := c.Param("id")

	var user models.User
	if err := database.DB.Where("organization_id = ?", orgID).First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not in pending status"})
		return
	}

	user.Status = "active"
	database.DB.Save(&user)
	forgetUser(user.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "User approved successfully",
		"user":    user,
	})
}

// DenyUser deletes a pending user from the database
func DenyUser(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	id := c.Param("id")

	var user models.User
	if err := database.DB.Where("organization_id = ?", orgID).First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only deny pending users"})
		return
	}

	// Permanently delete (not soft delete) since they were never approved
	database.DB.Unscoped().Delete(&user)
	forgetUser(user.ID)

	c.JSON(http.StatusOK, gin.H{"message": "User denied and removed"})
}

// RevokeUser changes an active user's status to revoked
func RevokeUser(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	id := c.Param("id")

	var user models.User
	if err := database.DB.Where("organization_id = ?", orgID).First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only revoke active users"})
		return
	}

	// Don't allow revoking admin users
	if user.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot revoke an admin user"})
		return
	}

	user.Status = "revoked"
	database.DB.Save(&user)
	forgetUser(user.ID)

	c.JSON(http.StatusOK, gin.H{"message": "User access revoked"})
}
