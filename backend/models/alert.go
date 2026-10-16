package models

import "time"

// Alert is the persisted in-app notification for one incident.
type Alert struct {
	ID               uint       `json:"id" gorm:"primaryKey"`
	IncidentID       uint       `json:"incident_id" gorm:"not null;uniqueIndex"`
	Incident         Incident   `json:"-" gorm:"foreignKey:IncidentID"`
	OrganizationID   uint       `json:"organization_id" gorm:"not null;index:idx_alert_org_id,priority:1"`
	HazardClass      string     `json:"class" gorm:"not null"`
	Confidence       float64    `json:"confidence" gorm:"not null"`
	CameraName       string     `json:"camera_name" gorm:"not null"`
	Zone             string     `json:"zone"`
	CreatedAt        time.Time  `json:"created_at" gorm:"not null"`
	AcknowledgedAt   *time.Time `json:"acknowledged_at"`
	AcknowledgedByID *uint      `json:"acknowledged_by_id"`
	AcknowledgedBy   *User      `json:"-" gorm:"foreignKey:AcknowledgedByID"`
}
