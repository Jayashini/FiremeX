package controllers

import (
	"errors"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/internal/detection"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var Detector *detection.Worker

func DetectionStatus(c *gin.Context) {
	org, ok := currentOrgID(c)
	if !ok {
		return
	}
	var cameras []models.Camera
	if err := database.DB.WithContext(c.Request.Context()).Where("organization_id = ?", org).Find(&cameras).Error; err != nil {
		c.JSON(503, gin.H{"error": "Camera storage unavailable"})
		return
	}
	items := []detection.Status{}
	for _, cam := range cameras {
		items = append(items, Detector.Status(cam))
	}
	storage, discovery := Detector.Warnings()
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"cameras": items, "storage_warning": storage, "discovery_warning": discovery})
}
func ToggleDetection(c *gin.Context) {
	org, ok := currentOrgID(c)
	if !ok {
		return
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid camera ID"})
		return
	}
	var body struct {
		Enabled *bool `json:"ai_enabled"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Enabled == nil {
		c.JSON(400, gin.H{"error": "ai_enabled must be a boolean"})
		return
	}
	var camera models.Camera
	if err := database.DB.WithContext(c.Request.Context()).Where("id = ? AND organization_id = ?", id, org).First(&camera).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(404, gin.H{"error": "Camera not found"})
			return
		}
		c.JSON(503, gin.H{"error": "Camera storage unavailable"})
		return
	}
	if camera.SourceType == "browser" && *body.Enabled {
		c.JSON(400, gin.H{"error": "AI detection is unavailable for a browser-local webcam"})
		return
	}
	result := database.DB.WithContext(c.Request.Context()).Model(&models.Camera{}).Where("id = ? AND organization_id = ?", id, org).Update("ai_enabled", *body.Enabled)
	if result.Error != nil {
		c.JSON(503, gin.H{"error": "Camera storage unavailable"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "Camera not found"})
		return
	}
	Detector.Cancel(id)
	c.JSON(200, gin.H{"id": id, "ai_enabled": *body.Enabled})
}
