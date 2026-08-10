# FiremeX Camera Integration - Implementation Details

This document outlines all the development work completed to integrate Home Assistant cameras into the FiremeX platform.

## 1. Backend Implementation (Go/Gin)

### Environment & Authentication
*   Implemented `godotenv` in `main.go` to load secrets securely from `.env`.
*   Added `HA_URL` (default: `http://localhost:8123`) and `HA_TOKEN` (Long-Lived Access Token) for communicating with Home Assistant.

### Database Model
Created the `Camera` model in `models/camera.go` using GORM. The model is scoped to an organization to support multi-tenancy.

```go
type Camera struct {
	gorm.Model
	EntityID       string        `json:"entity_id" gorm:"not null"`
	DisplayName    string        `json:"display_name" gorm:"not null"`
	Zone           string        `json:"zone"`
	AiEnabled      bool          `json:"ai_enabled" gorm:"default:false"`
	OrganizationID uint          `json:"organization_id" gorm:"not null"`
	Organization   *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}
```

### API Endpoints
Implemented 5 RESTful endpoints in `controllers/camera.go` under the `/api/cameras` group (protected by `RequireAuth` and `RequireAdmin` middleware where appropriate).

1.  **`GET /api/cameras/available`**: 
    *   Acts as a proxy to Home Assistant's `/api/states`.
    *   Filters the HA state list to only return entities starting with `camera.`.
    *   Used to populate the dropdown when adding a new device.
2.  **`POST /api/cameras`**: 
    *   Accepts `entity_id`, `display_name`, `zone`, and `ai_enabled`.
    *   Saves the camera configuration to PostgreSQL linked to the current user's `OrganizationID`.
3.  **`GET /api/cameras`**: 
    *   Retrieves all configured cameras from Postgres for the user's organization.
4.  **`DELETE /api/cameras/:id`**: 
    *   Removes a camera configuration from Postgres.
5.  **`GET /api/cameras/stream/:entity_id`**:
    *   **Core Feature:** Proxies the MJPEG stream from Home Assistant.
    *   Requests `GET /api/camera_proxy_stream/:entity_id` from HA using the Bearer Token.
    *   Uses Gin's `c.Stream()` to pipe the incoming byte chunks continuously to the frontend using `multipart/x-mixed-replace`.
    *   **Crucial:** This bypasses browser CORS restrictions that would occur if the frontend tried to hit port `8123` directly.

## 2. Frontend Implementation (Preact/Vite)

### AddDevice.tsx (`/FiremeX/admin/livefeed/add-device`)
*   Added logic to fetch from `/api/cameras/available` on mount to populate the camera selection dropdown.
*   Implemented form state for Display Name, Zone selection, and AI features.
*   Added `POST` request logic using the JWT token (`localStorage.getItem('firemex_token')`).
*   Handled loading states and error messages gracefully.

### Livefeed.tsx (`/FiremeX/admin/livefeed`)
*   Added `fetchCameras()` to pull the saved configurations from Postgres on mount.
*   Updated the UI to map over the returned cameras and render a grid of video feeds.
*   **Video Rendering:** Instead of an `<img src="" />` hitting Home Assistant directly, the `src` attribute is pointed to our backend proxy:
    ```tsx
    <img src={`http://localhost:8080/api/cameras/stream/${camera.entity_id}`} />
    ```
*   Added a Delete feature (trash icon) to remove cameras.

### Routing & Bug Fixes
*   Fixed a bug where JWT tokens were being requested as `'token'` instead of `'firemex_token'` (matching the `Login.tsx` state).
*   Corrected navigation paths across `AddDevice.tsx` and `Livefeed.tsx` to include the required `/FiremeX` route prefix (e.g., `/FiremeX/admin/livefeed`).

## 3. Home Assistant Configuration
*   Modified `homeassistant_config/configuration.yaml` to include a demo camera platform. This allows us to test the video proxy stream without needing physical hardware connected during initial development.
    ```yaml
    camera:
      - platform: demo
    ```
