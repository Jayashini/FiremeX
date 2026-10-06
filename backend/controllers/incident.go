package controllers

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/internal/incidents"
	"github.com/firemex/backend/internal/inference"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"strconv"
	"time"
)

var IncidentStore *incidents.Store

func positive(raw string) (uint, error) {
	n, e := strconv.ParseUint(raw, 10, 32)
	if e != nil || n == 0 {
		return 0, fmt.Errorf("expected a positive integer")
	}
	return uint(n), nil
}
func incidentDTO(row models.Incident) gin.H {
	var result gin.H
	b, _ := json.Marshal(row)
	json.Unmarshal(b, &result)
	ds := []inference.Detection{}
	if row.Detections != "" {
		json.Unmarshal([]byte(row.Detections), &ds)
	}
	if ds == nil {
		ds = []inference.Detection{}
	}
	result["detections"] = ds
	state := row.EvidenceStatus
	if row.EvidenceExpiresAt != nil && !time.Now().Before(*row.EvidenceExpiresAt) {
		state = "expired"
	}
	has := row.SnapshotFile != "" && (state == "available" || state == "unannotated")
	if has {
		if _, err := IncidentStore.Evidence.Read(row.SnapshotFile); err != nil {
			has = false
			state = "missing"
		}
	}
	result["evidence_status"] = state
	result["has_snapshot"] = has
	result["snapshot_url"] = nil
	if has {
		result["snapshot_url"] = fmt.Sprintf("/api/incidents/%d/snapshot", row.ID)
	}
	return result
}
func GetIncidents(c *gin.Context) {
	org, ok := currentOrgID(c)
	if !ok {
		return
	}
	page, err := positive(c.DefaultQuery("page", "1"))
	if err != nil || page > 100000 {
		c.JSON(400, gin.H{"error": "Invalid page"})
		return
	}
	size, err := positive(c.DefaultQuery("page_size", "25"))
	if err != nil || size > 100 {
		c.JSON(400, gin.H{"error": "Invalid page_size (1..100)"})
		return
	}
	q := database.DB.WithContext(c.Request.Context()).Model(&models.Incident{}).Where("organization_id = ?", org)
	if raw := c.Query("camera_id"); raw != "" {
		id, e := positive(raw)
		if e != nil {
			c.JSON(400, gin.H{"error": "Invalid camera_id"})
			return
		}
		q = q.Where("camera_id = ?", id)
	}
	if v := c.Query("class"); v != "" {
		if v != "fire" && v != "smoke" {
			c.JSON(400, gin.H{"error": "Invalid class"})
			return
		}
		q = q.Where("class = ?", v)
	}
	if v := c.Query("status"); v != "" {
		if !models.ValidIncidentStatus(v) {
			c.JSON(400, gin.H{"error": "Invalid status"})
			return
		}
		q = q.Where("status = ?", v)
	}
	if v := c.Query("search"); v != "" {
		if len(v) > 200 {
			c.JSON(400, gin.H{"error": "Search too long"})
			return
		}
		q = q.Where("(camera_name ILIKE ? OR zone ILIKE ?)", "%"+v+"%", "%"+v+"%")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		c.JSON(503, gin.H{"error": "Incident storage unavailable"})
		return
	}
	rows := []models.Incident{}
	if err := q.Order("created_at DESC, id DESC").Limit(int(size)).Offset(int((page - 1) * size)).Find(&rows).Error; err != nil {
		c.JSON(503, gin.H{"error": "Incident storage unavailable"})
		return
	}
	var latestID uint
	if err := database.DB.WithContext(c.Request.Context()).Model(&models.Incident{}).Where("organization_id = ?", org).Select("COALESCE(MAX(id),0)").Scan(&latestID).Error; err != nil {
		c.JSON(503, gin.H{"error": "Incident storage unavailable"})
		return
	}
	items := []gin.H{}
	for _, r := range rows {
		items = append(items, incidentDTO(r))
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"latest_id": latestID, "incidents": items, "total": total, "page": page, "page_size": size})
}
func findIncident(c *gin.Context) (models.Incident, bool) {
	var row models.Incident
	org, ok := currentOrgID(c)
	if !ok {
		return row, false
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid incident ID"})
		return row, false
	}
	err = database.DB.WithContext(c.Request.Context()).Where("organization_id = ? AND id = ?", org, id).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(404, gin.H{"error": "Incident not found"})
		} else {
			c.JSON(503, gin.H{"error": "Incident storage unavailable"})
		}
		return row, false
	}
	return row, true
}
func GetIncident(c *gin.Context) {
	r, ok := findIncident(c)
	if ok {
		c.Header("Cache-Control", "no-store")
		c.JSON(200, incidentDTO(r))
	}
}
func IncidentSnapshot(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	r, ok := findIncident(c)
	if !ok {
		return
	}
	if r.EvidenceStatus == "expired" || (r.EvidenceExpiresAt != nil && !time.Now().Before(*r.EvidenceExpiresAt)) {
		c.JSON(410, gin.H{"error": "Evidence expired"})
		return
	}
	if r.SnapshotFile == "" || (r.EvidenceStatus != "available" && r.EvidenceStatus != "unannotated") {
		c.JSON(404, gin.H{"error": "Evidence unavailable"})
		return
	}
	b, err := IncidentStore.Evidence.Read(r.SnapshotFile)
	if err != nil {
		c.JSON(404, gin.H{"error": "Evidence unavailable"})
		return
	}
	c.Data(200, "image/jpeg", b)
}
