package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/firemex/backend/config"
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
	haURL := config.C.HAURL
	haToken := config.C.HAToken

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

// GetCameras fetches all cameras for the user's organization
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
	id := c.Param("id")

	var camera models.Camera
	if err := database.DB.Where("organization_id = ?", orgID).First(&camera, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Camera not found"})
		return
	}

	if err := database.DB.Delete(&camera).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete camera"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Camera deleted successfully"})
}

// StreamCamera proxies the Home Assistant MJPEG stream to avoid CORS issues in browser
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

	client := &http.Client{}
	resp, err := client.Do(req)
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

	image, contentType, err := cachedSnapshot(entityID)
	if err != nil {
		log.Printf("snapshot %s: %v", entityID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	// Every request must reach Home Assistant, never a cached copy - otherwise
	// the "live" feed freezes on the first frame.
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Data(http.StatusOK, contentType, image)
}

// FetchSnapshot pulls a single frame from Home Assistant.
//
// Exported so the detection loop can call it directly in the next phase
// instead of going back out through HTTP.
func FetchSnapshot(entityID string) ([]byte, string, error) {
	reqURL := fmt.Sprintf("%s/api/camera_proxy/%s", config.C.HAURL, entityID)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("invalid Home Assistant address")
	}
	req.Header.Set("Authorization", "Bearer "+config.C.HAToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("could not reach Home Assistant: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, "", fmt.Errorf("Home Assistant returned %d: %s",
			resp.StatusCode, strings.TrimSpace(string(body)))
	}

	// 10 MB ceiling so a misbehaving camera cannot exhaust memory.
	data, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, "", fmt.Errorf("could not read the image: %w", err)
	}
	if len(data) == 0 {
		return nil, "", fmt.Errorf("Home Assistant returned an empty image - the camera may not support snapshots")
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}
	return data, contentType, nil
}

// ---------------------------------------------------------------- snapshot cache

type snapshotEntry struct {
	data        []byte
	contentType string
	fetchedAt   time.Time
	err         error
}

var (
	snapshotMu    sync.Mutex
	snapshotCache = map[string]*snapshotEntry{}
	snapshotBusy  = map[string]chan struct{}{}
)

// snapshotTTL is how long a frame is reused before a new one is fetched.
// One second matches what a monitoring wall needs; the detection loop will
// ask far less often than that.
const snapshotTTL = time.Second

// cachedSnapshot returns a recent frame, fetching a new one only when the
// cached frame has aged out.
//
// It exists because of two things that bite in practice:
//
//  1. Several tiles, several operators and several browser tabs all want the
//     same camera. Without this, every one of them is a separate round trip
//     to Home Assistant for an identical picture.
//
//  2. Some cameras are slow. A generic RTSP camera makes Home Assistant start
//     ffmpeg, wait for a keyframe and encode a JPEG, which can take seconds.
//     Asking again before the last answer arrives piles requests up until
//     Home Assistant, and then everything else, grinds to a halt.
//
// So only one fetch per camera is ever in flight. Everyone who asks while it
// is running waits for it and shares the result.
func cachedSnapshot(entityID string) ([]byte, string, error) {
	for {
		snapshotMu.Lock()

		if entry, ok := snapshotCache[entityID]; ok && time.Since(entry.fetchedAt) < snapshotTTL {
			snapshotMu.Unlock()
			return entry.data, entry.contentType, entry.err
		}

		if busy, running := snapshotBusy[entityID]; running {
			snapshotMu.Unlock()
			<-busy // someone else is already fetching - wait, then re-check
			continue
		}

		done := make(chan struct{})
		snapshotBusy[entityID] = done
		snapshotMu.Unlock()

		data, contentType, err := FetchSnapshot(entityID)

		snapshotMu.Lock()
		snapshotCache[entityID] = &snapshotEntry{
			data:        data,
			contentType: contentType,
			fetchedAt:   time.Now(),
			err:         err,
		}
		delete(snapshotBusy, entityID)
		snapshotMu.Unlock()
		close(done)

		return data, contentType, err
	}
}
