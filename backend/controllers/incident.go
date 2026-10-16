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
	"gorm.io/gorm/clause"
	"strconv"
	"strings"
	"time"
)

var IncidentStore *incidents.Store

var errNotIncidentResponder = errors.New("only the user who acknowledged the notification can update this incident")

func incidentResponderRole(role string) bool { return role == "admin" || role == "operator" }

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

func incidentDetailDTO(db *gorm.DB, row models.Incident, user models.User) (gin.H, error) {
	result := incidentDTO(row)
	var alert models.Alert
	if err := db.Where("incident_id = ? AND organization_id = ?", row.ID, row.OrganizationID).First(&alert).Error; err != nil {
		return nil, err
	}
	var actions []models.IncidentResponseAction
	if err := db.Where("incident_id = ? AND organization_id = ?", row.ID, row.OrganizationID).Order("id ASC").Find(&actions).Error; err != nil {
		return nil, err
	}
	result["acknowledged_at"] = alert.AcknowledgedAt
	result["alert_id"] = alert.ID
	result["acknowledged_by_id"] = alert.AcknowledgedByID
	result["acknowledged_by_name"] = alert.AcknowledgedByName
	result["acknowledged_by_role"] = alert.AcknowledgedByRole
	result["can_respond"] = incidentResponderRole(user.Role) && alert.AcknowledgedByID != nil && *alert.AcknowledgedByID == user.ID
	result["response_actions"] = actions
	return result, nil
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
		user, valid := currentUser(c)
		if !valid {
			return
		}
		dto, err := incidentDetailDTO(database.DB.WithContext(c.Request.Context()), r, user)
		if err != nil {
			c.JSON(503, gin.H{"error": "Incident response details unavailable"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(200, dto)
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

type incidentStatusRequest struct {
	Status        string `json:"status"`
	Note          string `json:"note"`
	BlockerReason string `json:"blocker_reason"`
}

func UpdateIncidentStatus(c *gin.Context) {
	user, ok := currentUser(c)
	if !ok {
		return
	}
	if !incidentResponderRole(user.Role) {
		c.JSON(403, gin.H{"error": "Only administrators and operators can update incidents"})
		return
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid incident ID"})
		return
	}
	var request incidentStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": "Invalid status request"})
		return
	}
	request.Note = strings.TrimSpace(request.Note)
	request.BlockerReason = strings.TrimSpace(request.BlockerReason)
	if !models.ValidIncidentStatus(request.Status) || len(request.Note) > 2000 || len(request.BlockerReason) > 2000 ||
		(request.Status == models.IncidentStatusResolved && request.Note == "") ||
		(request.BlockerReason != "" && request.Status != models.IncidentStatusUnresolved) {
		c.JSON(400, gin.H{"error": "Invalid status, note or blocker reason"})
		return
	}
	var row models.Incident
	err = database.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND organization_id = ?", id, *user.OrganizationID).First(&row).Error; err != nil {
			return err
		}
		var alert models.Alert
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("incident_id = ? AND organization_id = ?", id, *user.OrganizationID).First(&alert).Error; err != nil {
			return err
		}
		if alert.AcknowledgedByID == nil || *alert.AcknowledgedByID != user.ID {
			return errNotIncidentResponder
		}
		now := time.Now().UTC()
		values := map[string]any{"status": request.Status, "response_updated_by_id": user.ID, "response_updated_at": now, "blocker_reason": request.BlockerReason}
		if request.Status == models.IncidentStatusResolved {
			values["resolve_note"] = request.Note
			values["resolved_by_id"] = user.ID
			values["resolved_at"] = now
		} else {
			values["resolve_note"] = ""
			values["resolved_by_id"] = nil
			values["resolved_at"] = nil
		}
		if err := tx.Model(&row).Updates(values).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.IncidentResponseAction{IncidentID: id, OrganizationID: *user.OrganizationID, ActorID: user.ID, ActorName: user.Name, ActorRole: user.Role, Status: request.Status, Note: request.Note, BlockerReason: request.BlockerReason, CreatedAt: now}).Error; err != nil {
			return err
		}
		row = models.Incident{}
		return tx.First(&row, id).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(404, gin.H{"error": "Incident not found"})
		return
	}
	if errors.Is(err, errNotIncidentResponder) {
		c.JSON(403, gin.H{"error": errNotIncidentResponder.Error()})
		return
	}
	if err != nil {
		c.JSON(503, gin.H{"error": "Incident storage unavailable"})
		return
	}
	c.Header("Cache-Control", "no-store")
	dto, err := incidentDetailDTO(database.DB.WithContext(c.Request.Context()), row, user)
	if err != nil {
		c.JSON(503, gin.H{"error": "Incident response details unavailable"})
		return
	}
	c.JSON(200, dto)
}
