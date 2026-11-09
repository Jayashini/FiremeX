package main

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/firemex/backend/middleware"
	"github.com/gin-gonic/gin"
)

func mountUI(router *gin.Engine, dir string) error {
	index, err := os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		return fmt.Errorf("read FireMeX UI: %w", err)
	}

	render := func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		page := index
		if prefix := middleware.IngressPrefix(c); prefix != "" {
			page = bytes.ReplaceAll(page, []byte(`src="/`), []byte(`src="`+prefix+"/"))
			page = bytes.ReplaceAll(page, []byte(`href="/`), []byte(`href="`+prefix+"/"))
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", page)
	}

	router.GET("/", render)
	router.GET("/FiremeX", render)
	router.GET("/FiremeX/*page", render)
	router.StaticFile("/logo.png", filepath.Join(dir, "logo.png"))
	router.StaticFile("/warehouse_fire.png", filepath.Join(dir, "warehouse_fire.png"))
	router.Static("/assets", filepath.Join(dir, "assets"))
	return nil
}
