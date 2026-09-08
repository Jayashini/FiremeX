package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/database"
	"github.com/gin-gonic/gin"
)

// GetSystemStatus reports whether the pieces FiremeX depends on are reachable.
//
// This exists for support: when someone says "the camera feed is black", the
// first question is whether Home Assistant is reachable at all, and this
// answers it without anyone opening a terminal.
func GetSystemStatus(c *gin.Context) {
	// Admin-only route, but call this so an account with no organisation is
	// refused here for the same reason it is everywhere else.
	if _, ok := currentOrgID(c); !ok {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"database":       databaseStatus(),
		"home_assistant": homeAssistantStatus(),
		"detection":      gin.H{"ok": false, "detail": "Not connected yet"},
	})
}

func databaseStatus() gin.H {
	sqlDB, err := database.DB.DB()
	if err != nil {
		return gin.H{"ok": false, "detail": "No connection pool"}
	}
	if err := sqlDB.Ping(); err != nil {
		return gin.H{"ok": false, "detail": "Not responding"}
	}
	return gin.H{"ok": true, "detail": "Connected"}
}

func homeAssistantStatus() gin.H {
	if config.C.HAToken == "" {
		return gin.H{"ok": false, "detail": "No access token configured"}
	}

	request, err := http.NewRequest("GET", config.C.HAURL+"/api/", nil)
	if err != nil {
		return gin.H{"ok": false, "detail": "Invalid Home Assistant address"}
	}
	request.Header.Set("Authorization", "Bearer "+config.C.HAToken)

	// Short timeout: this runs while someone is looking at a settings page.
	client := &http.Client{Timeout: 3 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return gin.H{"ok": false, "detail": "Unreachable at " + config.C.HAURL}
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		return gin.H{"ok": true, "detail": "Connected"}
	case http.StatusUnauthorized, http.StatusForbidden:
		return gin.H{"ok": false, "detail": "Access token rejected"}
	default:
		return gin.H{"ok": false, "detail": fmt.Sprintf("Returned HTTP %d", response.StatusCode)}
	}
}
