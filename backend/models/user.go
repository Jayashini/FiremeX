package models

import (
	"gorm.io/gorm"
)

// User represents the structure of our users table in the database
type User struct {
	gorm.Model
	Name     string `json:"name" gorm:"not null"`
	Email    string `json:"email" gorm:"unique;not null"`
	Password string `json:"password" gorm:"not null"`
	Role     string `json:"role" gorm:"default:'user'"` // Can be 'admin' or 'user'
}
