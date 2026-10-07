package controllers

import (
	"errors"
	"io"
	"net/http"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/internal/cameras"
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

// BrowserCameraFrame accepts one webcam snapshot from an authenticated page
// and runs it through the same detector and incident store as server cameras.
func BrowserCameraFrame(c *gin.Context) {
	org, ok := currentOrgID(c)
	if !ok {
		return
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid camera ID"})
		return
	}
	var camera models.Camera
	if err := database.DB.WithContext(c.Request.Context()).Where("id = ? AND organization_id = ?", id, org).First(&camera).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Camera not found"})
			return
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Camera storage unavailable"})
		return
	}
	if camera.SourceType != "browser" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Camera does not accept browser frames"})
		return
	}
	if !camera.AiEnabled {
		c.JSON(http.StatusConflict, gin.H{"error": "AI detection is disabled for this camera"})
		return
	}
	if !config.C.DetectionEnabled {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI detection is disabled"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cameras.MaxBytes)
	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Camera frame exceeds the upload limit"})
		return
	}
	frame, err := cameras.NewFrame(data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Camera frame is not a valid image"})
		return
	}
	status := Detector.ProcessBrowserFrame(c.Request.Context(), camera, frame)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"status": status})
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
