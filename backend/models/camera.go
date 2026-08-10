package models

import (
	"gorm.io/gorm"
)

// Camera represents a camera entity registered from Home Assistant
type Camera struct {
	gorm.Model
	EntityID       string        `json:"entity_id" gorm:"not null"`
	DisplayName    string        `json:"display_name" gorm:"not null"`
	Zone           string        `json:"zone"`
	AiEnabled      bool          `json:"ai_enabled" gorm:"default:false"`
	OrganizationID uint          `json:"organization_id" gorm:"not null"`
	Organization   *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}
