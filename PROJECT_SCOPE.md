# Project Scope: AI Fire & Smoke Detection Incident Management System

## 1. Project Overview
The goal of this project is to build an automated, scalable system that watches CCTV footage using an AI computer vision model to detect fire or smoke. When detected, the system will alert operators and organization admins through a custom-built Security Operations Center (SOC) dashboard. The system focuses on incident state management and real-time alerts without the overhead of processing live video feeds on the web backend.

## 2. System Architecture & Core Pillars

### Pillar A: AI Vision Agent
- **Video Ingestion:** The AI agent will connect to existing CCTV streams (provided via Home Assistant or direct RTSP).
- **Processing:** The agent will sample the video stream at a low framerate (e.g., 1-3 FPS) to conserve compute resources.
- **Detection & Extraction:** The AI model will analyze frames for fire and smoke. Upon a positive detection, it will capture the specific frame (image snapshot) showing the threat.
- **Alert Transmission:** The agent will push the alert metadata (Camera ID, Timestamp) along with the captured image to a Cloud endpoint (e.g., Cloud Storage + Webhook).

### Pillar B: Custom Backend (Incident Management)
- **Decoupled Architecture:** A standalone backend, completely independent of Home Assistant.
- **Alert Ingestion:** Receives the alert payload and image from the Cloud.
- **State Management:** Logs the event in a database and manages the lifecycle of the incident (States: `New`, `Ongoing`, `Resolved`).
- **Real-time Communication:** Pushes the alert instantly to connected operator dashboards (e.g., via WebSockets).
- **Image Request Handling (Option A):** Processes requests from operators to fetch the most recent image from a specific camera and routes that request back to the AI Agent/Home Assistant.

### Pillar C: Operator Dashboard (Frontend)
- **Alert Center:** A real-time web interface for operators.
- **Incident View:** Displays the initial detection snapshot, camera details, and timestamp.
- **Incident Tracking:** Provides UI controls for operators to update the status of the fire (e.g., mark as `Ongoing` or `Resolved`).
- **On-Demand Updates:** Includes a "Request Current Image" feature that pulls the most recent still image from the camera to verify the current status (Option A).

## 3. Workflow Summary
1. Home Assistant's CCTV video stream is watched by the standalone AI agent.
2. AI agent detects fire/smoke, captures a snapshot, and sends the alert + image to the Cloud.
3. The Custom Backend receives the data from the cloud and instantly notifies the Frontend.
4. The Operator views the alert and the snapshot on the dashboard.
5. The Operator clicks "Request Current Image" to fetch a present, real-time image of the camera to assess the situation.
6. The Operator updates the incident state in the system (e.g., Ongoing, Resolved).

## 4. Out of Scope
To ensure system stability, rapid development, and low bandwidth costs, the following features are explicitly out of scope for this phase:
- **Option B (Live Video Streaming):** Routing live, continuous video feeds (e.g., 30 FPS) from the cameras to the custom frontend dashboard. Operators will rely entirely on the AI-generated snapshots and on-demand "Present Images" (Option A).
- **Hardware & NVR Configuration:** Adding, configuring, or networking new cameras must be done at the Home Assistant or NVR level.
- **PTZ Controls:** Operators cannot physically move (Pan, Tilt, Zoom) the cameras from the custom dashboard.
