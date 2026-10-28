package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func alertDTO(row models.Alert) gin.H {
	return gin.H{
		"id": row.ID, "incident_id": row.IncidentID,
		"incident_reference": fmt.Sprintf("INC-%04d", row.IncidentID),
		"organization_id":    row.OrganizationID, "class": row.HazardClass,
		"confidence": row.Confidence, "camera_name": row.CameraName, "zone": row.Zone,
		"created_at": row.CreatedAt, "acknowledged_at": row.AcknowledgedAt,
		"acknowledged_by_id":   row.AcknowledgedByID,
		"acknowledged_by_name": row.AcknowledgedByName,
		"acknowledged_by_role": row.AcknowledgedByRole,
	}
}

func GetAlerts(c *gin.Context) {
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
	var after uint64
	cursor := c.Query("after_id") != ""
	if raw := c.Query("after_id"); raw != "" {
		after, err = strconv.ParseUint(raw, 10, 32)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid after_id"})
			return
		}
	}
	filter := c.Query("acknowledged")
	if filter != "" && filter != "true" && filter != "false" {
		c.JSON(400, gin.H{"error": "Invalid acknowledged filter"})
		return
	}
	base := database.DB.WithContext(c.Request.Context()).Model(&models.Alert{}).Where("organization_id = ?", org)
	var total, unacknowledged int64
	var latestID uint
	if err := base.Count(&total).Error; err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	if err := base.Where("acknowledged_at IS NULL").Count(&unacknowledged).Error; err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	if err := base.Select("COALESCE(MAX(id),0)").Scan(&latestID).Error; err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	query := database.DB.WithContext(c.Request.Context()).Model(&models.Alert{}).Where("organization_id = ?", org)
	if filter == "true" {
		query = query.Where("acknowledged_at IS NOT NULL")
	}
	if filter == "false" {
		query = query.Where("acknowledged_at IS NULL")
	}
	if cursor {
		query = query.Where("id > ?", after)
	}
	var filtered int64
	if err := query.Count(&filtered).Error; err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	rows := []models.Alert{}
	order, offset := "id DESC", int((page-1)*size)
	if cursor {
		order, offset = "id ASC", 0
	}
	if err := query.Order(order).Limit(int(size)).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	items := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		items = append(items, alertDTO(row))
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"alerts": items, "total": total, "unacknowledged": unacknowledged, "filtered_total": filtered, "latest_id": latestID, "page": page, "page_size": size})
}

func AcknowledgeAlert(c *gin.Context) {
	user, ok := currentUser(c)
	if !ok {
		return
	}
	if !incidentResponderRole(user.Role) {
		c.JSON(403, gin.H{"error": "Only administrators and operators can acknowledge notifications"})
		return
	}
	id, err := positive(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid alert ID"})
		return
	}
	var row models.Alert
	err = database.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND organization_id = ?", id, *user.OrganizationID).First(&row).Error; err != nil {
			return err
		}
		if row.AcknowledgedAt == nil {
			now := time.Now().UTC()
			result := tx.Model(&models.Alert{}).Where("id = ? AND organization_id = ? AND acknowledged_at IS NULL", id, *user.OrganizationID).Updates(map[string]any{"acknowledged_at": now, "acknowledged_by_id": user.ID, "acknowledged_by_name": user.Name, "acknowledged_by_role": user.Role})
			if result.Error != nil {
				return result.Error
			}
			if err := tx.First(&row, id).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(404, gin.H{"error": "Alert not found"})
		return
	}
	if err != nil {
		c.JSON(503, gin.H{"error": "Alert storage unavailable"})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, alertDTO(row))
}
