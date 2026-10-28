package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIsValidPhoneForCountry(t *testing.T) {
	tests := []struct {
		name    string
		country string
		phone   string
		want    bool
	}{
		{name: "US number for US", country: "United States", phone: "+1 202 555 0123", want: true},
		{name: "Sri Lankan number for Sri Lanka", country: "Sri Lanka", phone: "+94 77 123 4567", want: true},
		{name: "UK number for UK", country: "United Kingdom", phone: "+44 20 7946 0018", want: true},
		{name: "national Sri Lankan format", country: "Sri Lanka", phone: "0771234567", want: true},
		{name: "Sri Lankan number for US", country: "United States", phone: "+94 77 123 4567"},
		{name: "US number for Sri Lanka", country: "Sri Lanka", phone: "+1 202 555 0123"},
		{name: "malformed phone", country: "United States", phone: "not a phone"},
		{name: "empty phone", country: "United States"},
		{name: "unknown country", country: "Atlantis", phone: "+1 202 555 0123"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isValidPhoneForCountry(test.phone, test.country); got != test.want {
				t.Errorf("isValidPhoneForCountry(%q, %q) = %v, want %v", test.phone, test.country, got, test.want)
			}
		})
	}
}

func TestRegisterOrganizationRejectsPhoneCountryMismatchBeforeDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/register/organization", RegisterOrganization)

	body := `{"org_name":"Phone Validation Test","sector":"Industrial","email":"test@example.com","phone":"+94 77 123 4567","country":"United States","admin_name":"Test Admin","password":"password"}`
	request := httptest.NewRequest(http.MethodPost, "/register/organization", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}

	var payload map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if payload["error"] != "Contact number format mismatch" {
		t.Errorf("error = %q, want %q", payload["error"], "Contact number format mismatch")
	}
}
