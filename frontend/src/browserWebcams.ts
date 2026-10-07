const STORAGE_KEY = 'firemex_browser_webcams'

function readMappings(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
	} catch {
		return {}
	}
}

export function rememberBrowserWebcam(cameraId: string, deviceId: string) {
	if (!cameraId || !deviceId) return
	const mappings = readMappings()
	mappings[cameraId] = deviceId
	localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings))
}

export function browserWebcamFor(cameraId: string) {
	return readMappings()[cameraId] ?? null
}

export function forgetBrowserWebcam(cameraId: string) {
	const mappings = readMappings()
	if (!(cameraId in mappings)) return
	delete mappings[cameraId]
	localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings))
}
