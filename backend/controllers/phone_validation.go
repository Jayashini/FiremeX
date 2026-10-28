package controllers

import (
	"strings"

	"github.com/nyaruka/phonenumbers"
	"golang.org/x/text/language"
	"golang.org/x/text/language/display"
)

var countryNames = display.Regions(language.English)

var countryNameAliases = map[string]string{
	"czech republic": "CZ",
	"south korea":    "KR",
	"taiwan":         "TW",
	"turkey":         "TR",
}

func countryRegionCode(country string) string {
	normalizedCountry := strings.TrimSpace(country)
	if region, ok := countryNameAliases[strings.ToLower(normalizedCountry)]; ok {
		return region
	}

	for region := range phonenumbers.GetSupportedRegions() {
		if strings.EqualFold(countryNames.Name(language.MustParseRegion(region)), normalizedCountry) {
			return region
		}
	}

	return ""
}

func isValidPhoneForCountry(phone, country string) bool {
	region := countryRegionCode(country)
	if region == "" {
		return false
	}

	number, err := phonenumbers.Parse(phone, region)
	return err == nil && phonenumbers.IsValidNumberForRegion(number, region)
}
