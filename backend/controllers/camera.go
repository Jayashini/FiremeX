package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

// HAState represents state item returned from Home Assistant /api/states
type HAState struct {
	EntityID   string                 `json:"entity_id"`
	State      string                 `json:"state"`
	Attributes map[string]interface{} `json:"attributes"`
}

// GetAvailableCameras fetches all camera entities from Home Assistant API
func GetAvailableCameras(c *gin.Context) {
	haURL := os.Getenv("HA_URL")
	haToken := os.Getenv("HA_TOKEN")

	if haURL == "" {
		haURL = "http://localhost:8123"
	}

	req, err := http.NewRequest("GET", haURL+"/api/states", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create HA request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+haToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to connect to Home Assistant: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{"error": "Home Assistant returned non-200 status"})
		return
	}

	var states []HAState
	if err := json.NewDecoder(resp.Body).Decode(&states); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse HA response"})
		return
	}

	// Filter for camera.* entities
	var cameras []gin.H
	for _, s := range states {
		if len(s.EntityID) >= 7 && s.EntityID[:7] == "camera." {
			friendlyName, _ := s.Attributes["friendly_name"].(string)
			if friendlyName == "" {
				friendlyName = s.EntityID
			}
			cameras = append(cameras, gin.H{
				"entity_id":     s.EntityID,
				"friendly_name": friendlyName,
				"state":         s.State,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"cameras": cameras})
}

// AddCamera saves a new camera into PostgreSQL linked to the user's organization
func AddCamera(c *gin.Context) {
	var input struct {
		EntityID    string `json:"entity_id" binding:"required"`
		DisplayName string `json:"display_name" binding:"required"`
		Zone        string `json:"zone"`
		AiEnabled   bool   `json:"ai_enabled"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get logged-in user
	userIDFloat, _ := c.Get("userID")
	userID := uint(userIDFloat.(float64))

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	var orgID uint
	if user.OrganizationID != nil {
		orgID = *user.OrganizationID
	} else {
		// Fallback for primary system admin without org
		orgID = 1
	}

	camera := models.Camera{
		EntityID:       input.EntityID,
		DisplayName:    input.DisplayName,
		Zone:           input.Zone,
		AiEnabled:      input.AiEnabled,
		OrganizationID: orgID,
	}

	if err := database.DB.Create(&camera).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add camera: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Camera added successfully", "camera": camera})
}

// GetCameras fetches all cameras for the user's organization
func GetCameras(c *gin.Context) {
	userIDFloat, _ := c.Get("userID")
	userID := uint(userIDFloat.(float64))

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	var cameras []models.Camera
	if user.OrganizationID != nil {
		database.DB.Where("organization_id = ?", *user.OrganizationID).Find(&cameras)
	} else {
		// System admin gets all cameras
		database.DB.Find(&cameras)
	}

	c.JSON(http.StatusOK, gin.H{"cameras": cameras})
}

// DeleteCamera removes a camera record from DB
func DeleteCamera(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.Camera{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete camera"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Camera deleted successfully"})
}

// StreamCamera proxies the Home Assistant MJPEG stream to avoid CORS issues in browser
func StreamCamera(c *gin.Context) {
	entityID := c.Param("entity_id")
	haURL := os.Getenv("HA_URL")
	haToken := os.Getenv("HA_TOKEN")

	if haURL == "" {
		haURL = "http://localhost:8123"
	}

	reqURL := fmt.Sprintf("%s/api/camera_proxy_stream/%s", haURL, entityID)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+haToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to connect to HA stream: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "multipart/x-mixed-replace; boundary=--frame"
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	c.Stream(func(w io.Writer) bool {
		buf := make([]byte, 4096)
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
		}
		return err == nil
	})
}
