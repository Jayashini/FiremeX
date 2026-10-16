package models

import "time"

// IncidentResponseAction preserves who took each response step, even if the
// user's profile later changes. Only successful status changes create a row.
type IncidentResponseAction struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	IncidentID     uint      `json:"incident_id" gorm:"not null;index"`
	OrganizationID uint      `json:"-" gorm:"not null;index"`
	ActorID        uint      `json:"actor_id" gorm:"not null"`
	ActorName      string    `json:"actor_name" gorm:"not null"`
	ActorRole      string    `json:"actor_role" gorm:"not null"`
	Status         string    `json:"status" gorm:"not null"`
	Note           string    `json:"note"`
	BlockerReason  string    `json:"blocker_reason"`
	CreatedAt      time.Time `json:"created_at" gorm:"not null"`
}
