# Drone Property Patrol 🛸

> **Autonomous Property-Monitoring & Perimeter Defense Drone Platform**  
> Engineered with a strict safety-first architecture, deterministic mission state machine, ray-casting polygon geofencing, multi-zone computer vision incident detection, simulation acceleration, and tactical operations dashboard.

---

## Key Features

- **Autonomous Patrols**: Supports scheduled patrols, interval missions, manual flights, and alarm/webhook triggered inspections.
- **Strict Safety Hierarchy**: `Mission Engine -> Safety Layer -> Drone Adapter -> Drone`. Vision AI has zero flight-control authority.
- **Polygon Geofencing**: Configurable property boundaries, restricted no-fly zones, watch zones, and public zones. Validates altitudes, flight path intersections, and battery reserve margins.
- **Pre-Flight Check**: Rigorous 9-point validation (connection, GPS fix, battery reserve, home point, geofence validity, storage, link quality, safety layer, RTH profile).
- **Computer Vision & Tracking**: Frame sampler, object detector (`person`, `car`, `van`, `truck`, `motorcycle`, `bicycle`, `dog`), temporal tracker, and zone incident classifier.
- **Privacy by Design**: No facial recognition, no demographic inference. Strictly describes observable objective physical events.
- **Video Replay Pipeline**: Feeds synthetic or uploaded video files through the vision pipeline for testing without physical drone flights.
- **First-Class Mock Drone**: Real-time 3D flight physics, battery drain curves, GPS noise, simulated video, and time acceleration (1x, 2x, 5x, 10x).
- **Hardware Integration Boundary**: Hardware-isolated `DJIMini3ProAdapter` ready for DJI Mobile SDK v5 Android gateway bridges.
- **Tactical Dashboard**: Built with React 18, Vite, Tailwind CSS, Leaflet maps, and Lucide icons. Includes Dashboard, Live Mission HUD, Mission Designer, Incident Triage, Diagnostics, Video Replay, and Audit Logs.

---

## Architecture Overview

```
apps/
  api/                   # Express REST + WebSocket server on port 3001
  web/                   # React + Leaflet tactical dashboard on port 5173
services/
  mission-engine/        # Deterministic state machine & alarm scheduler
  vision/                # Detector, temporal tracker, zone matcher, incident engine
  notifications/         # In-app alerts and external webhook dispatcher
packages/
  shared/                # Domain models, geospatial raycasting, types
  drone-core/            # DroneAdapter interface, MockDroneAdapter, DJIMini3ProAdapter
  safety/                # Geofence engine, altitude limits, PreFlightCheck
docs/                    # System architecture and DJI MSDK v5 integration specs
tests/                   # Vitest unit and integration test suite
```

---

## Quick Start

### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### 1. Installation & Build
```bash
# Clone the repository
git clone <repo-url>
cd drone-property-patrol

# Install dependencies across all workspaces
npm install

# Build all packages and the frontend dashboard
npm run build
```

### 2. Run Automated Test Suite
```bash
npm test
```
All 33 unit and integration tests across 7 suites will execute in ~3 seconds.

### 3. Launch the Application
```bash
# Start the unified production server (API + Web Dashboard)
npm start
```
The application will launch on **http://localhost:3001**.

To run in development mode with hot reloading:
```bash
npm run dev:api    # Terminal 1: API server on http://localhost:3001
npm run dev:web    # Terminal 2: Vite dev server on http://localhost:5173
```

---

## Triggering Alarms via Webhook

You can trigger autonomous alarm missions from external security sensors or home automation platforms:

```bash
# Front Gate motion trigger -> launches Front Gate Inspection
curl -X POST http://localhost:3001/api/alarms \
  -H "Content-Type: application/json" \
  -d '{"source": "front_gate", "event": "motion", "zone": "front_gate"}'

# Garage door trigger -> launches Garage Inspection
curl -X POST http://localhost:3001/api/alarms \
  -H "Content-Type: application/json" \
  -d '{"source": "garage", "event": "door_open", "zone": "garage"}'

# Backyard perimeter trip -> launches Backyard Inspection
curl -X POST http://localhost:3001/api/alarms \
  -H "Content-Type: application/json" \
  -d '{"source": "backyard", "event": "breakbeam", "zone": "backyard"}'
```

---

## Operations Dashboard Views

1. **Dashboard**: Live telemetry cards, battery gauge, active mission progress, quick patrol triggers, and recent incident feed.
2. **Live Mission**: Split-view HUD showing the real-time optical payload with AI target bounding boxes, georeferenced Leaflet map, and manual override controls (Pause, Resume, Return Home, Abort, Take Control).
3. **Mission Designer**: Interactive map editor to configure the launch pad, draw property boundaries, create customized zones, drop and reorder waypoints, adjust altitudes and speeds, and run instant safety validation.
4. **Incidents**: Incident dossier feed with severity classification (`HIGH`, `MEDIUM`, `LOW`), aerial evidence snapshots, timeline of events, and acknowledgment tracking.
5. **Drone Status**: Avionics diagnostics (battery cell voltages, GPS RTK fix, motor temps) and simulation fault injection bench (low battery, GPS loss, link drop).
6. **Video Replay**: Replay simulator that streams sequential video frames through the Vision Engine to verify detections and incidents.
7. **History & Audit**: Flight mission logs and immutable audit records of all flight transitions, validation checks, and safety rejections.
8. **Settings**: Configurable geofence parameters (max/min altitude, max distance from home, return home altitude, min battery reserve) and alarm mappings.

---

## Documentation

- [System Architecture](file:///Users/adam/.gemini/antigravity/scratch/drone-property-patrol/docs/ARCHITECTURE.md)
- [DJI Mini 3 Pro Integration Guide](file:///Users/adam/.gemini/antigravity/scratch/drone-property-patrol/docs/DJI_MINI_3_PRO_INTEGRATION.md)
- [Development Progress & Milestone Log](file:///Users/adam/.gemini/antigravity/scratch/drone-property-patrol/docs/PROGRESS.md)
