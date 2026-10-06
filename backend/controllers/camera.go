// Camera handling for FiremeX.
//
// FiremeX never talks to a camera directly. Home Assistant owns every camera,
// whatever it is - a laptop webcam, an RTSP CCTV camera, an ONVIF unit - and
// FiremeX reads them back out of Home Assistant. That is what makes the
// product work with equipment a customer already has: if Home Assistant can
// see it, FiremeX can monitor it.
//
// The flow:
//
//	GetAvailableCameras  ask Home Assistant what cameras exist
//	AddCamera            save the ones this organisation wants to monitor
//	GetCameras           list what was saved
//	SnapshotCamera       fetch one picture, for the dashboard and later the detector
//	StreamCamera         MJPEG passthrough - only works for MJPEG-native cameras
//	DeleteCamera         stop monitoring one
//
// Every handler is scoped to the caller's organisation, so one customer can
// never see or touch another customer's cameras.
package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/internal/cameras"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

// HAState is one entity from Home Assistant's /api/states response.
//
// Home Assistant returns EVERY entity it knows about - lights, sensors,
// switches, cameras - in one list. We only care about three fields, so the
// rest of each entry is ignored rather than modelled.
type HAState struct {
	EntityID   string                 `json:"entity_id"`
	State      string                 `json:"state"`
	Attributes map[string]interface{} `json:"attributes"`
}

// GetAvailableCameras lists the cameras Home Assistant can see.
//
// This is what fills the dropdown on the Add Device page. It reads live from
// Home Assistant rather than from our database, because the point is to show
// cameras the organisation has NOT added yet.
//
// Admin-only: choosing what to monitor is an administrator's job.
func GetAvailableCameras(c *gin.Context) {
	// The address and token come from configuration, never from source code.
	// The token is powerful - it can control everything in Home Assistant -
	// so it lives only on the server and is never sent to a browser.
	haURL := config.C.HAURL
	haToken := config.C.HAToken

	req, err := http.NewRequest("GET", haURL+"/api/states", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create HA request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+haToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := haClient.Do(req)
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

	// Home Assistant names entities as "<domain>.<name>", so every camera -
	// regardless of which integration created it - starts with "camera.".
	// That single rule is why FiremeX works with any camera type without
	// knowing anything about the hardware.
	var cameras []gin.H
	for _, s := range states {
		if len(s.EntityID) >= 7 && s.EntityID[:7] == "camera." {
			// friendly_name is what the user typed in Home Assistant. Fall
			// back to the raw entity id so the dropdown is never blank.
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

// AddCamera records that this organisation wants to monitor a camera.
//
// Note what is NOT stored: no address, no credentials, no stream URL. Only the
// Home Assistant entity id plus the organisation's own labels. Home Assistant
// remains the single place where camera connection details live, so changing a
// camera's password never requires touching FiremeX.
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

	orgID, ok := currentOrgID(c)
	if !ok {
		return
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

// GetCameras lists the cameras this organisation has added.
//
// Available to operators as well as admins - watching cameras is the
// operator's whole job. The organisation filter is what keeps one customer's
// camera list invisible to another.
func GetCameras(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}

	var cameras []models.Camera
	database.DB.Where("organization_id = ?", orgID).Find(&cameras)

	c.JSON(http.StatusOK, gin.H{"cameras": cameras})
}

// DeleteCamera removes a camera record from DB.
// A camera belonging to another organisation answers 404, not 403, so this
// endpoint cannot be used to find out which camera ids exist elsewhere.
func DeleteCamera(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid camera ID"})
		return
	}

	var camera models.Camera
	if err := database.DB.Where("organization_id = ? AND id = ?", orgID, id).First(&camera).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Camera not found"})
		return
	}

	if err := database.DB.Delete(&camera).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete camera"})
		return
	}

	if Detector != nil {
		Detector.Cancel(id)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Camera deleted successfully"})
}

// StreamCamera proxies Home Assistant's MJPEG stream.
//
// MJPEG is just "one JPEG after another down a single connection", which an
// <img> tag can display directly. It works well for cameras that already
// produce JPEGs.
//
// It does NOT work for an RTSP camera: Home Assistant answers with MJPEG
// headers, fails to transcode, and closes the connection a moment later - a
// black tile. SnapshotCamera below is what the dashboard actually uses.
// This is kept for MJPEG-native cameras and because it is cheap to leave.
//
// Why proxy at all instead of letting the browser talk to Home Assistant?
// Two reasons: the browser has no Home Assistant token and should never be
// given one, and a cross-origin video request would be blocked anyway.
func StreamCamera(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	entityID := c.Param("entity_id")

	// Only proxy cameras this organisation has actually added. Without this
	// check any logged-in user could stream any Home Assistant camera simply
	// by guessing its entity id.
	var camera models.Camera
	if err := database.DB.Where("organization_id = ? AND entity_id = ?", orgID, entityID).
		First(&camera).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Camera not found"})
		return
	}

	haURL := config.C.HAURL
	haToken := config.C.HAToken

	reqURL := fmt.Sprintf("%s/api/camera_proxy_stream/%s", haURL, entityID)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+haToken)

	resp, err := haStreamClient.Do(req)
	if err != nil {
		log.Printf("stream %s: could not reach Home Assistant: %v", entityID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to connect to HA stream: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// Home Assistant answering at all is not the same as Home Assistant
	// answering with video. Without this check an error page is proxied
	// through as if it were a stream: the browser shows a black tile and our
	// own log still says 200, because our response was fine.
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		log.Printf("stream %s: Home Assistant returned %d: %s", entityID, resp.StatusCode, strings.TrimSpace(string(body)))
		c.JSON(http.StatusBadGateway, gin.H{
			"error": fmt.Sprintf("Home Assistant returned %d for this camera", resp.StatusCode),
		})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	log.Printf("stream %s: streaming, content-type %q", entityID, contentType)
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

// SnapshotCamera returns one still image from a camera.
//
// Why this exists alongside StreamCamera: MJPEG only works for cameras that
// already speak it. An RTSP camera has to be decoded and re-encoded frame by
// frame, and Home Assistant does not do that reliably - it answers with MJPEG
// headers and then closes the connection a moment later, which shows up as a
// black tile.
//
// A still image works for every camera type Home Assistant supports. It is
// also the shape the detection service needs later: one frame at a time.
func SnapshotCamera(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	entityID := c.Param("entity_id")

	// Same ownership rule as the stream: only cameras this organisation added.
	var camera models.Camera
	if err := database.DB.Where("organization_id = ? AND entity_id = ?", orgID, entityID).
		First(&camera).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Camera not found"})
		return
	}

	frame, err := Snapshots.Get(c.Request.Context(), entityID)
	if err != nil {
		log.Printf("snapshot %s: %v", entityID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	// Every request must reach Home Assistant, never a cached copy - otherwise
	// the "live" feed freezes on the first frame.
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Data(http.StatusOK, frame.ContentType, frame.Data)
}

// Shared by HTTP preview and the detector. Initialized after config.Load.
var Snapshots *cameras.Service
var haClient = &http.Client{Timeout: 10 * time.Second}
var haStreamClient = &http.Client{Transport: &http.Transport{ResponseHeaderTimeout: 10 * time.Second}}
