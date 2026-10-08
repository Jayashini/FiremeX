import { getCountries, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryAliases: Record<string, CountryCode> = {
	'czech republic': 'CZ',
	'south korea': 'KR',
	taiwan: 'TW',
	turkey: 'TR',
}

function getCountryCode(country: string): CountryCode | undefined {
	const normalizedCountry = country.trim().toLocaleLowerCase('en')
	const alias = countryAliases[normalizedCountry]
	if (alias) return alias

	return getCountries().find(
		region => regionNames.of(region)?.toLocaleLowerCase('en') === normalizedCountry
	)
}

export function isValidPhoneForCountry(phone: string, country: string): boolean {
	const countryCode = getCountryCode(country)
	if (!countryCode) return false

	const parsedPhone = parsePhoneNumberFromString(phone, countryCode)
	return parsedPhone?.isValid() === true && parsedPhone.country === countryCode
}
