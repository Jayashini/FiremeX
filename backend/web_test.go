package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/firemex/backend/middleware"
	"github.com/gin-gonic/gin"
)

func TestIngressUI(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(`<script src="/assets/app.js"></script>`), 0600); err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.Use(middleware.RequireIngress)
	if err := mountUI(router, dir); err != nil {
		t.Fatal(err)
	}
	router.POST("/login", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	const prefix = "/api/hassio_ingress/test_token"
	for _, tc := range []struct {
		name, method, path, peer, prefix, writeHeader string
		status                                        int
	}{
		{"deep link", "GET", "/FiremeX/admin/dashboard", "172.30.32.2:5000", prefix, "", 200},
		{"missing API", "GET", "/api/missing", "172.30.32.2:5000", prefix, "", 404},
		{"forged proxy", "GET", "/", "192.168.1.10:5000", prefix, "", 403},
		{"invalid prefix", "GET", "/", "172.30.32.2:5000", "//example.com", "", 403},
		{"unguarded write", "POST", "/login", "172.30.32.2:5000", prefix, "", 403},
		{"same origin write", "POST", "/login", "172.30.32.2:5000", prefix, "1", 204},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.RemoteAddr = tc.peer
			req.Header.Set("X-Ingress-Path", tc.prefix)
			req.Header.Set("X-Forwarded-For", "172.30.32.2")
			req.Header.Set("X-FireMeX-Request", tc.writeHeader)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != tc.status {
				t.Fatalf("status = %d, want %d", w.Code, tc.status)
			}
			if tc.status == 200 && !strings.Contains(w.Body.String(), prefix+"/assets/app.js") {
				t.Fatal("deep link did not point to assets under Ingress")
			}
		})
	}
}
