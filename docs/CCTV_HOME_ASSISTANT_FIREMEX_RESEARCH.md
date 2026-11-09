# Research: Connecting a CCTV Camera to FireMeX through Home Assistant

**Project:** FireMeX  
**Research period:** 19/10/2026 - 25/10/2026  
**Research topic:** How an EZVIZ-compatible CCTV camera should provide its feed to Home Assistant and how FireMeX should obtain images for fire and smoke detection

## 1. Research Objective

The purpose of this research was to understand the complete camera workflow required by FireMeX. The selected camera is EZVIZ-compatible, so the primary plan is to register it through Home Assistant's built-in EZVIZ integration and then allow the FireMeX Go backend to retrieve camera images from Home Assistant for AI detection.

The proposed workflow should:

- Support the selected EZVIZ-compatible IP CCTV camera.
- Use the EZVIZ integration as the primary connection between the camera and Home Assistant.
- Allow Home Assistant to manage the camera connection.
- Avoid exposing the camera password directly to the FireMeX frontend.
- Give the Go backend a reliable way to retrieve individual images.
- Send each selected image to the Python fire-and-smoke model.
- Create FireMeX incidents and alerts when a hazard is detected.

## 2. How an IP CCTV Camera Provides Video

Most network CCTV cameras provide one or more of the following interfaces:

| Interface | Purpose |
| --- | --- |
| RTSP | Supplies a continuous live video stream over the local network. |
| HTTP snapshot URL | Returns one JPEG image whenever the URL is requested. |
| ONVIF | Provides a standard method for discovering and controlling compatible IP cameras and locating their media profiles. |
| Vendor API | Provides features specific to the camera manufacturer. |

An RTSP address commonly has a structure similar to:

```text
rtsp://camera-user:camera-password@192.168.1.50:554/stream
```

The exact path depends on the camera manufacturer. The address and credentials should be tested on the local network before configuring Home Assistant.

For Home Assistant compatibility, an H.264 stream is generally the safest choice. Some ONVIF cameras use H.265 by default, which may prevent Home Assistant from identifying a usable camera entity unless an H.264 profile is enabled.

## 3. Primary Plan: Add the Camera through the EZVIZ Integration

Home Assistant has a built-in **EZVIZ integration** that uses the EZVIZ account API to discover and manage devices. For video, the integration uses the camera's local IP address and RTSP server, so the camera and the device running Home Assistant must be able to communicate over the local network.

### 3.1 Prepare the EZVIZ camera

The camera should first be registered and confirmed as working in the EZVIZ mobile application. Its local RTSP server must then be enabled:

1. Open the EZVIZ mobile application.
2. Select the profile icon.
3. Go to **Settings > LAN Live View > Start Scanning**.
4. Select the required camera.
5. Open the gear icon and select **Local Server Settings**.
6. Enable RTSP.

The camera verification code, which is usually printed near the camera's QR code or included in its manual, may be required as the RTSP password. The camera's local IP address should remain reachable from Home Assistant; reserving its address in the router can prevent the integration from breaking after an IP-address change.

### 3.2 Add EZVIZ to Home Assistant

The proposed setup process in Home Assistant is:

1. Go to **Settings > Devices & services**.
2. Select **Add Integration**.
3. Search for and select **EZVIZ**.
4. Sign in using the EZVIZ account credentials.
5. Complete the setup for each discovered camera.
6. Supply the camera verification code/RTSP password if requested.
7. Confirm that Home Assistant creates a usable camera entity.
8. Record the entity ID, such as `camera.main_entrance`, for registration in FireMeX.

The Home Assistant documentation states that EZVIZ authentication requires a normal EZVIZ account with two-step verification disabled. Accounts that only use Google, Facebook, TikTok, or another OAuth provider are not supported by this integration.

### 3.3 Select the EZVIZ stream

The EZVIZ integration normally selects a stream automatically. If stream selection is required, its FFmpeg arguments can identify the desired channel:

```text
/Streaming/Channels/101  # main, higher-resolution stream
/Streaming/Channels/102  # lower-resolution substream
```

The main stream may provide better evidence quality, while the substream may reduce network traffic and AI-processing time. The final selection should be tested using the actual camera, Home Assistant host, and detection computer.

### 3.4 Verify the Home Assistant camera entity

Before connecting FireMeX, the camera entity should be checked in the Home Assistant dashboard. The live image should load consistently, and a current snapshot should be available through Home Assistant's authenticated camera-proxy endpoint.

## 4. Fallback Methods for Adding the Camera

### 4.1 ONVIF Integration

ONVIF is suitable when the camera supports ONVIF Profile S. Home Assistant may discover the camera automatically, or it can be added manually from **Settings > Devices & services > Add Integration > ONVIF**.

The setup normally requires:

- The camera's local IP address.
- The ONVIF port.
- A camera username and password.
- At least one compatible H.264 video profile.
- The Home Assistant FFmpeg integration.

A dedicated camera user should be created for Home Assistant instead of using the camera's main administrator account.

### 4.2 Generic Camera Integration

The Generic Camera integration is suitable when the RTSP or snapshot URL is already known. Home Assistant requires at least one of the following:

- A still-image URL.
- A stream-source URL, such as an RTSP address.

If only an RTSP stream is available, Home Assistant can use its stream and FFmpeg support to generate camera images.

### 4.3 FFmpeg Support

FFmpeg allows Home Assistant to read and process video streams. It can also be used outside Home Assistant to check whether the RTSP stream is reachable:

```bash
ffmpeg -i "rtsp://camera-user:camera-password@camera-address/stream" -an -f null -
```

If UDP transport is unreliable, RTSP over TCP can be tested instead. Network access, credentials, stream paths, video codecs, and firewall rules should be checked when a stream cannot be opened.

## 5. Proposed System Workflow

```mermaid
flowchart LR
    A[EZVIZ-compatible CCTV camera] -->|Register and configure| B[EZVIZ account<br/>and mobile app]
    B -->|Cloud discovery and control| C[Home Assistant<br/>EZVIZ integration]
    A -->|Local RTSP video| C
    C --> D[Home Assistant camera entity]
    D -->|Camera entity| E[Home Assistant camera proxy]
    E -->|Authenticated JPEG request| F[FireMeX Go backend]
    F -->|Multipart image request| G[Python detection service]
    G --> H[Fire/smoke AI model]
    H -->|Prediction| G
    G -->|JSON detection result| F
    F --> I{Hazard detected?}
    I -->|No| J[Continue monitoring]
    I -->|Yes| K[Store incident and evidence]
    K --> L[Create alert]
    L --> M[Display in FireMeX frontend]
```

The proposed workflow should operate as follows:

1. The EZVIZ-compatible camera is registered and tested in the EZVIZ mobile application.
2. Local RTSP access is enabled through the EZVIZ LAN Live View settings.
3. The EZVIZ integration is added to Home Assistant using the EZVIZ account.
4. Home Assistant discovers the camera and creates an entity such as `camera.main_entrance`.
5. The camera entity reads the EZVIZ camera's RTSP stream over the local network.
6. The FireMeX administrator registers the Home Assistant entity ID in FireMeX.
7. The Go backend requests a JPEG snapshot from the Home Assistant camera-proxy API.
8. Home Assistant reads the camera stream and returns the image to Go.
9. Go validates the image type, size, and dimensions.
10. Go sends the image to the Python detection service.
11. Python runs the frame through the fire-and-smoke model.
12. Python returns the predicted label, confidence value, and bounding box to Go as JSON.
13. Go checks the response and applies the configured confidence thresholds.
14. If a hazard is found, Go stores the incident and evidence and creates an alert.
15. The FireMeX frontend obtains the incident and alert from the Go API.

## 6. Retrieving an Image from Home Assistant

Home Assistant exposes camera images through its camera-proxy endpoint:

```text
GET /api/camera_proxy/{camera_entity_id}
```

An example request for `camera.main_entrance` is:

```text
GET http://home-assistant-address:8123/api/camera_proxy/camera.main_entrance
Authorization: Bearer <HOME_ASSISTANT_TOKEN>
```

The expected successful response is an image, normally JPEG data. The Go backend should make this request on the server side so the Home Assistant token is not exposed to the browser.

The proposed FireMeX environment settings are:

```env
HA_URL=http://localhost:8123
HA_TOKEN=<long-lived-access-token>
```

The token should be stored in a local environment file or secret-management system and must not be committed to Git.

## 7. Why FireMeX Should Request Snapshots

The AI model normally analyses one image at a time rather than processing an unlimited live stream directly. Therefore, the Go backend should periodically request a current camera snapshot and send only the selected frame to Python.

This approach provides the following benefits:

- Go controls the detection interval.
- The Python service receives bounded individual requests.
- Multiple cameras can be scheduled fairly.
- Invalid or repeated frames can be rejected before inference.
- Detection failures do not interrupt the live camera connection in Home Assistant.
- Evidence can be linked to the exact frame that produced an incident.

The selected detection interval should balance detection speed against camera, network, CPU, and model load.

## 8. Proposed Data Flow between FireMeX and the Python Model

Go should send the Home Assistant snapshot to Python using a multipart HTTP request:

```text
POST http://python-model:8100/detect
Content-Type: multipart/form-data
```

Proposed fields:

| Field | Type | Description |
| --- | --- | --- |
| `image` | File | Current JPEG or PNG camera frame |
| `threshold` | Number | Minimum detection confidence |
| `annotate` | Boolean | Whether an image with detection boxes is required |

An example model response is:

```json
{
  "hazard": true,
  "detections": [
    {
      "label": "fire",
      "confidence": 0.87,
      "box": {
        "x1": 145.0,
        "y1": 92.0,
        "x2": 402.0,
        "y2": 371.0
      }
    }
  ],
  "model_version": "model-version-or-hash"
}
```

Go should verify the returned label, confidence value, bounding-box coordinates, and model version before creating an incident.

## 9. Security Considerations

- The CCTV camera and Home Assistant should remain on a trusted local network.
- The EZVIZ RTSP server should only be reachable from the trusted local network.
- A dedicated EZVIZ account should be considered for the Home Assistant integration.
- Disabling two-step verification reduces account protection, so the EZVIZ account should use a unique, strong password and minimal exposure.
- A separate, limited camera account should be used where possible.
- Camera credentials should not be placed in frontend code or committed files.
- The Home Assistant token should only be available to the Go backend.
- Home Assistant and FireMeX should use HTTPS when communication crosses an untrusted network.
- Camera entity access should be restricted to the correct FireMeX organization.
- Uploaded images should have size and dimension limits before AI processing.
- Saved evidence should have access control and a retention period.

## 10. Possible Problems and Proposed Checks

| Problem | Checks or proposed handling |
| --- | --- |
| EZVIZ camera is not discovered | Confirm that the camera is online in the EZVIZ app and that the EZVIZ account was added correctly. |
| EZVIZ authentication fails | Use a direct EZVIZ account rather than an OAuth login and confirm that two-step verification is disabled. |
| RTSP password is rejected | Use the camera verification code printed near the QR code or supplied in the manual. |
| Camera entity has no live stream | Enable RTSP through EZVIZ LAN Live View and confirm that Home Assistant can reach the camera's local IP. |
| Main stream is too slow | Test the lower-resolution `/Streaming/Channels/102` substream. |
| EZVIZ integration is unsuitable | Try ONVIF or Generic Camera as a fallback using the local RTSP stream. |
| Home Assistant reports no usable camera | Enable an H.264 camera profile and confirm that FFmpeg is available. |
| RTSP stream does not open | Test the address with FFmpeg and try RTSP over TCP. |
| Camera entity has no snapshot | Configure a still-image URL or allow Home Assistant/FFmpeg to generate one from the stream. |
| Camera proxy returns 401 | Check the long-lived access token and authorization header. |
| Camera proxy returns 404 | Confirm the Home Assistant camera entity ID. |
| Snapshot is old | Review the camera source, snapshot caching, and capture interval. |
| FireMeX cannot reach Home Assistant | Check `HA_URL`, container networking, ports, and firewall rules. |
| Python model is unavailable | Apply a timeout, record the failure, and retry later. |
| Detection result is invalid | Reject the result and avoid creating a false incident. |

## 11. Research Conclusion

The primary FireMeX camera plan should use Home Assistant's EZVIZ integration as the connection layer between the selected EZVIZ-compatible CCTV camera and the Go backend. The camera should first be configured in the EZVIZ app, local RTSP should be enabled, and the EZVIZ integration should then expose the camera as a Home Assistant entity.

ONVIF and Generic Camera should remain fallback options if the built-in EZVIZ integration cannot provide a stable camera entity. FireMeX only needs the working Home Assistant entity ID and authenticated camera-proxy access, regardless of which fallback created the entity.

The complete proposed flow is:

```text
EZVIZ camera -> EZVIZ app and local RTSP -> Home Assistant EZVIZ integration
             -> Home Assistant camera entity -> authenticated snapshot
             -> FireMeX Go backend -> Python model -> incident and alert
```

This design separates camera compatibility, application logic, and AI inference into clear components. Implementation and testing should confirm the chosen camera's codec, RTSP path, Home Assistant entity, snapshot freshness, detection interval, network performance, and security settings.

## 12. Research References

- [Home Assistant EZVIZ integration](https://www.home-assistant.io/integrations/ezviz)
- [Home Assistant Generic Camera integration](https://www.home-assistant.io/integrations/generic/)
- [Home Assistant ONVIF integration](https://www.home-assistant.io/integrations/onvif/)
- [Home Assistant FFmpeg integration](https://www.home-assistant.io/integrations/ffmpeg/)
- [Home Assistant Camera entity developer documentation](https://developers.home-assistant.io/docs/core/entity/camera/)
- [Go `net/http` package](https://pkg.go.dev/net/http)
- [FastAPI file uploads](https://fastapi.tiangolo.com/tutorial/request-files/)
