package controllers

import (
	"fmt"
	"math/rand"
	"net/http"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// RegisterOrganization creates a new organization AND its admin user in one step
func RegisterOrganization(c *gin.Context) {
	var input struct {
		OrgName   string `json:"org_name" binding:"required"`
		Sector    string `json:"sector" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Phone     string `json:"phone"`
		AdminName string `json:"admin_name" binding:"required"`
		Password  string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// 1. Generate a unique org code like ORG-384
	orgCode := fmt.Sprintf("ORG-%d", 100+rand.Intn(900))

	// Make sure the code is unique
	var existingOrg models.Organization
	for database.DB.Where("code = ?", orgCode).First(&existingOrg).Error == nil {
		orgCode = fmt.Sprintf("ORG-%d", 100+rand.Intn(900))
	}

	// 2. Create the organization
	org := models.Organization{
		Name:   input.OrgName,
		Code:   orgCode,
		Sector: input.Sector,
		Email:  input.Email,
		Phone:  input.Phone,
	}

	if err := database.DB.Create(&org).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create organization"})
		return
	}

	// 3. Hash the admin password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// 4. Create the admin user linked to this organization
	adminUser := models.User{
		Name:           input.AdminName,
		Email:          input.Email,
		Password:       string(hashedPassword),
		Role:           "admin",
		Status:         "active",
		OrganizationID: &org.ID,
	}

	if err := database.DB.Create(&adminUser).Error; err != nil {
		// If user creation fails, clean up the org we just created
		database.DB.Unscoped().Delete(&org)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Organization registered successfully!",
		"org_code": orgCode,
		"org": gin.H{
			"id":     org.ID,
			"name":   org.Name,
			"code":   org.Code,
			"sector": org.Sector,
		},
	})
}

// RegisterOperator creates a new operator user linked to an existing organization
func RegisterOperator(c *gin.Context) {
	var input struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		OrgCode  string `json:"org_code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// 1. Find the organization by its code
	var org models.Organization
	if err := database.DB.Where("code = ?", input.OrgCode).First(&org).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization code not found. Check with your administrator."})
		return
	}

	// 2. Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// 3. Create the operator user as "pending"
	user := models.User{
		Name:           input.Name,
		Email:          input.Email,
		Password:       string(hashedPassword),
		Role:           "operator",
		Status:         "pending",
		OrganizationID: &org.ID,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already registered"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Operator registration request submitted! Pending admin approval.",
	})
}
