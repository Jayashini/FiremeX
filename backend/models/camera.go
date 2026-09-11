package models

import (
	"gorm.io/gorm"
)

// Camera is a camera an organisation has chosen to monitor.
//
// It is a POINTER to a camera in Home Assistant, not a copy of it. Home
// Assistant holds the address, protocol and credentials; FiremeX holds only
// the entity id and the organisation's own labels for it. That separation is
// what lets FiremeX work with any camera Home Assistant supports without
// knowing anything about the hardware.
type Camera struct {
	gorm.Model

	// EntityID is the Home Assistant entity, e.g. "camera.laptop_webcam".
	// This is the only link between the two systems.
	EntityID string `json:"entity_id" gorm:"not null"`

	// DisplayName and Zone are the customer's own words - "Loading Bay",
	// "Warehouse A" - shown to operators instead of the raw entity id.
	DisplayName string `json:"display_name" gorm:"not null"`
	Zone        string `json:"zone"`

	// AiEnabled marks a camera for fire and smoke detection. Nothing reads it
	// yet; the detection loop will use it to decide which cameras to sample,
	// so a customer can monitor a camera without paying the cost of analysing
	// it (a car park may not need fire detection, a stockroom does).
	AiEnabled bool `json:"ai_enabled" gorm:"default:false"`

	// Which organisation owns this camera. Every camera query filters on it -
	// this field is the whole of FiremeX's multi-tenant separation.
	OrganizationID uint          `json:"organization_id" gorm:"not null"`
	Organization   *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}
