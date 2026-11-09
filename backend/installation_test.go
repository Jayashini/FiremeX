package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/controllers"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

func TestHAOSOwnerSetup(t *testing.T) {
	db := demoDB(t)
	oldConfig, oldDB := config.C, database.DB
	t.Cleanup(func() { config.C, database.DB = oldConfig, oldDB })
	database.DB = db
	config.C = config.Config{HAOS: true, SetupKey: strings.Repeat("s", 32)}

	router := gin.New()
	router.POST("/register/organization", controllers.RegisterOrganization)
	register := func(email, key string) int {
		body := `{"org_name":"Test Site","sector":"Testing","email":"` + email +
			`","admin_name":"Owner","password":"test-password","setup_key":"` + key + `"}`
		req := httptest.NewRequest(http.MethodPost, "/register/organization", strings.NewReader(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}

	if status := register("owner@example.invalid", ""); status != http.StatusForbidden {
		t.Fatalf("unapproved registration returned %d", status)
	}
	if status := register("owner@example.invalid", config.C.SetupKey); status != http.StatusCreated {
		t.Fatalf("owner setup returned %d", status)
	}
	if status := register("second@example.invalid", config.C.SetupKey); status != http.StatusConflict {
		t.Fatalf("repeated setup returned %d", status)
	}
	var owners int64
	if err := db.Model(&models.User{}).Where("role = ? AND status = ?", "admin", "active").Count(&owners).Error; err != nil || owners != 1 {
		t.Fatalf("active administrators = %d, error = %v", owners, err)
	}
}

func TestUserManagementRejectsSQLShapedID(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		orgID := uint(1)
		c.Set("currentUser", models.User{OrganizationID: &orgID})
	})
	router.PATCH("/users/:id/approve", controllers.ApproveUser)
	router.DELETE("/users/:id/deny", controllers.DenyUser)
	router.PATCH("/users/:id/revoke", controllers.RevokeUser)
	for _, endpoint := range []struct{ method, action string }{
		{http.MethodPatch, "approve"},
		{http.MethodDelete, "deny"},
		{http.MethodPatch, "revoke"},
	} {
		req := httptest.NewRequest(endpoint.method, "/users/1=1/"+endpoint.action, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "Invalid user ID") {
			t.Fatalf("%s returned %d: %s", endpoint.action, w.Code, w.Body.String())
		}
	}
}
