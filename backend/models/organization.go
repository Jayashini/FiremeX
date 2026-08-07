package models

import (
	"gorm.io/gorm"
)

// Organization represents a company/entity registered on FiremeX
type Organization struct {
	gorm.Model
	Name   string `json:"name" gorm:"not null"`
	Code   string `json:"code" gorm:"unique;not null"`
	Sector string `json:"sector" gorm:"not null"`
	Email  string `json:"email" gorm:"not null"`
	Phone  string `json:"phone"`
}
