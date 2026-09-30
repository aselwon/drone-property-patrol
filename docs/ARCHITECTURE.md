# Drone Property Patrol - System Architecture Document

## 1. System Overview

**Drone Property Patrol** is an enterprise-grade autonomous property monitoring platform designed with strict safety isolation, deterministic state management, spatial geofencing, real-time computer vision tracking, and an operations dashboard.

---

## 2. Core Architectural Principles

### 2.1 Unidirectional Safety Authority
The control hierarchy strictly enforces:
```
Mission Engine  -->  Safety Layer  -->  Drone Adapter  -->  Drone Flight Controller
```
**CRITICAL GUARDRAIL**: The **Vision AI system has ZERO flight-control authority**. Detections and incident events are strictly emitted as observational records. Only the Mission Engine can propose flight goals, and every single flight command must pass through the `SafetyLayer` before reaching any actuator.

### 2.2 Deterministic State Machine
Flight missions run through an explicit, testable finite state machine (`MissionStateMachine`):
```
[PENDING]
    |
    v
[PRE_FLIGHT_CHECK] ---> (Check Failed) ---> [FAILED]
    |
    v
 [READY]
    |
    v
[TAKEOFF]
    |
    v
 [FLYING] <---------> [OBSERVING]
    |
    v
[RETURNING]
    |
    v
[LANDING]
    |
    v
[COMPLETED]

* Any active in-flight state may transition to [ABORTED] via operator override or failsafe trigger.
```

### 2.3 Ray-Casting Polygon Geofencing
Every target waypoint and flight path segment is validated against:
1. **Property Boundary Polygon**: Must remain contained inside authorized perimeter.
2. **Restricted No-Fly Zones**: Targets or path intersections crossing forbidden zones are rejected immediately.
3. **Altitude Ceiling & Floor**: Configurable minimum clearance (e.g. 3m AGL) and maximum ceiling (e.g. 50m AGL).
4. **Distance Radius**: Maximum horizontal operational radius from home launch pad (e.g. 250m).
5. **Battery Reserve**: Movement is rejected if battery level is insufficient to maintain minimum safe reserve (20%) plus return flight energy.

### 2.4 Privacy-First Objective Computer Vision
- Target classes are strictly objective: `person`, `car`, `van`, `truck`, `motorcycle`, `bicycle`, `dog`.
- **NO facial recognition** is implemented or permitted.
- **NO inferences of identity, demographic attributes, criminality, or intent** are made from appearance.
- System outputs strictly describe observable physical events (e.g. *"Person entered restricted zone (Backyard)"*, *"Vehicle observed in driveway"*).

---

## 3. Package and Service Layout

```
drone-property-patrol/
├── apps/
│   ├── api/                   # Express REST API, WebSockets, static file server
│   └── web/                   # React 18 + Vite + Tailwind CSS tactical operations dashboard
├── services/
│   ├── mission-engine/        # Deterministic state machine, waypoint runner, alarm scheduler
│   ├── vision/                # Video frame sampler, object detector, tracker, incident engine
│   └── notifications/         # In-app alerts, push dispatch, webhook delivery
├── packages/
│   ├── shared/                # Geospatial math, domain models, audit logs, types
│   ├── drone-core/            # DroneAdapter interface, MockDroneAdapter, DJIMini3ProAdapter
│   └── safety/                # Geofence polygon engine, PreFlightCheck, command authorization
├── docs/                      # Progress logs, architecture specs, DJI integration guide
└── tests/                     # Vitest unit and integration test suite
```

---

## 4. Operational API & Webhooks

### 4.1 Alarm Webhook Endpoint
- **URL**: `POST /api/alarms`
- **Body**:
  ```json
  {
    "source": "front_gate",
    "event": "motion",
    "zone": "front_gate"
  }
  ```
- **Behavior**: Looks up registered route mapping (e.g. `front_gate` -> `Front Gate Inspection`), schedules flight, runs PreFlightCheck, and launches autonomous patrol.

### 4.2 Video Replay Pipeline
- **URL**: `POST /api/video/replay`
- **Body**:
  ```json
  {
    "frameCount": 15,
    "targetLabel": "person"
  }
  ```
- **Behavior**: Ingests sequential frames into the Vision Engine, updates tracker, evaluates spatial zones, and generates Incident tickets with evidence snapshots.
