package controllers

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/firemex/backend/config"
	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var errInstallationConfigured = errors.New("installation already configured")

// RegisterOrganization creates a new organization AND its admin user in one step
func RegisterOrganization(c *gin.Context) {
	var input struct {
		SetupKey  string `json:"setup_key"`
		OrgName   string `json:"org_name" binding:"required"`
		Sector    string `json:"sector" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Phone     string `json:"phone"`
		Country   string `json:"country"`
		AdminName string `json:"admin_name" binding:"required"`
		Password  string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	if input.Country != "" && !isValidPhoneForCountry(input.Phone, input.Country) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Contact number format mismatch"})
		return
	}

	// An installation-wide HA credential grants access to the same cameras
	// for every organization. Only the installation owner may create one.
	if config.C.HAToken != "" || config.C.SetupKey != "" || config.C.HAOS {
		supplied := sha256.Sum256([]byte(input.SetupKey))
		expected := sha256.Sum256([]byte(config.C.SetupKey))
		if len(config.C.SetupKey) < 32 || subtle.ConstantTimeCompare(supplied[:], expected[:]) != 1 {
			c.JSON(http.StatusForbidden, gin.H{"error": "A valid installation setup key is required"})
			return
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must fit within 72 bytes"})
		return
	}
	code := make([]byte, 12)
	if _, err := rand.Read(code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate organization code"})
		return
	}

	org := models.Organization{
		Name: input.OrgName, Code: "ORG-" + hex.EncodeToString(code), Sector: input.Sector,
		Email: input.Email, Phone: input.Phone, Country: input.Country,
	}
	err = database.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if config.C.HAOS {
			// Serialize first-run setup even if two valid requests arrive together.
			if err := tx.Exec("LOCK TABLE organizations IN SHARE ROW EXCLUSIVE MODE").Error; err != nil {
				return err
			}
			var count int64
			if err := tx.Unscoped().Model(&models.Organization{}).Count(&count).Error; err != nil {
				return err
			}
			if count != 0 {
				return errInstallationConfigured
			}
		}
		if err := tx.Create(&org).Error; err != nil {
			return err
		}
		return tx.Create(&models.User{
			Name: input.AdminName, Email: input.Email, Password: string(hashedPassword),
			Role: "admin", Status: "active", OrganizationID: &org.ID,
		}).Error
	})
	if errors.Is(err, errInstallationConfigured) {
		c.JSON(http.StatusConflict, gin.H{"error": "FireMeX is already configured. Sign in with your account."})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create organization and administrator"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Organization registered successfully!",
		"org_code": org.Code,
		"org": gin.H{
			"id":      org.ID,
			"name":    org.Name,
			"code":    org.Code,
			"sector":  org.Sector,
			"country": org.Country,
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

// GetOrganization returns the caller's own organisation.
//
// The join code is included for administrators only - see organizationResponse
// in me.go for why.
func GetOrganization(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}
	user, ok := currentUser(c)
	if !ok {
		return
	}

	var org models.Organization
	if err := database.DB.First(&org, orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	response := organizationResponse{
		ID:      org.ID,
		Name:    org.Name,
		Sector:  org.Sector,
		Email:   org.Email,
		Phone:   org.Phone,
		Country: org.Country,
	}
	if user.Role == "admin" {
		response.Code = org.Code
	}

	c.JSON(http.StatusOK, gin.H{"organization": response})
}

// UpdateOrganization lets an administrator edit their own organisation's
// details. Admin-only, and scoped to their own organisation.
//
// The join code is never editable: operators may already be holding it, and
// changing it would silently break their ability to request access.
func UpdateOrganization(c *gin.Context) {
	orgID, ok := currentOrgID(c)
	if !ok {
		return
	}

	var input struct {
		Name    string `json:"name" binding:"required"`
		Sector  string `json:"sector" binding:"required"`
		Email   string `json:"email" binding:"required,email"`
		Phone   string `json:"phone"`
		Country string `json:"country"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	var org models.Organization
	if err := database.DB.First(&org, orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	org.Name = input.Name
	org.Sector = input.Sector
	org.Email = input.Email
	org.Phone = input.Phone
	org.Country = input.Country

	if err := database.DB.Save(&org).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Organization updated",
		"organization": organizationResponse{
			ID:      org.ID,
			Name:    org.Name,
			Sector:  org.Sector,
			Email:   org.Email,
			Phone:   org.Phone,
			Country: org.Country,
			Code:    org.Code,
		},
	})
}
