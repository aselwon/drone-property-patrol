# DJI Mini 3 Pro Hardware Integration Specification

## 1. Executive Summary & Hardware Context

The **DJI Mini 3 Pro** is a sub-249g ultra-compact drone featuring tri-directional obstacle sensing and a 4K/60fps camera. To maintain modularity, safety, and strict vendor isolation, the Drone Property Patrol architecture interfaces with DJI hardware exclusively through the `DroneAdapter` contract implemented by `DJIMini3ProAdapter`.

Under **NO** circumstances do vendor-specific DJI SDK objects or calls leak into the Mission Engine, Safety Layer, or Vision Engine.

---

## 2. DJI SDK Ecosystem & Compatibility Matrix

### 2.1 Software Development Kit (SDK)
- **DJI Mobile SDK (MSDK) v5.x**:
  - The Mini 3 Pro is supported starting with **MSDK v5.4.0+**.
  - **OS Constraint**: MSDK v5 currently supports **Android exclusively** for the consumer/prosumer line. iOS is not supported for the Mini 3 Pro in MSDK v5.
  - **Onboard / Payload SDK**: Not supported on Mini 3 Pro (Onboard SDK / Payload SDK is reserved for enterprise drones such as the Matrice 30/300/350 series).

### 2.2 Remote Controller Compatibility
- **DJI RC-N1 (Recommended for Integration)**:
  - Connects to an Android mobile device via USB-C.
  - The Android device runs a lightweight gateway service (`patrol-dji-bridge`) built with MSDK v5.
  - The bridge translates the WebSocket/TCP commands from our backend `DJIMini3ProAdapter` into native MSDK calls.
- **DJI RC (with built-in 5.5" screen)**:
  - Standard retail DJI RC units run a locked Android ROM that prevents installing or sideloading third-party APKs or developer apps. Therefore, retail DJI RC controllers cannot run custom MSDK ground apps.
- **DJI RC Pro**:
  - Supports installing third-party Android APKs, but is significantly higher cost.

---

## 3. Flight Control Mechanics in MSDK v5

### 3.1 Waypoint Mission V2 vs. Virtual Stick Control
The Mini 3 Pro supports two execution paradigms:
1. **Waypoint Mission V2 (`WaypointMissionManager`)**:
   - Pre-loads an array of geodetic coordinates, target altitudes, flight speeds, and camera actions directly into the drone's flight controller.
   - Advantages: High autonomy; continues executing waypoints even during momentary RF downlink loss.
   - Used for: Standard scheduled perimeter patrols.
2. **Virtual Stick Control (`VirtualStickFlightControlParam`)**:
   - Real-time pitch, roll, yaw, and vertical velocity commands sent at 10-25 Hz.
   - Advantages: Immediate reactivity, dynamic loitering, and manual operator takeover.
   - Safety requirement: Strict safety layer watchdog timer (if heartbeat ceases for > 1.0s, drone auto-hovers).

### 3.2 Safety & Geofencing Mapping
Every movement command validated by `SafetyLayer` maps to:
- Takeoff: `KeyFlightController.KeyStartTakeoff`
- Land: `KeyFlightController.KeyStartAutoLanding`
- RTH: `KeyFlightController.KeyStartGoHome`
- Waypoint Navigation: `WaypointMissionExecute`
- Photo / Video: `KeyCamera.KeyStartRecord` / `KeyCamera.KeyShootPhoto`

---

## 4. Live Video Stream Ingestion

- **RTSP / H.264 Live Stream**:
  - MSDK v5 provides raw H.264 frame callbacks via `MediaDataCenter.getInstance().getCameraStreamManager()`.
  - The Android bridge packages H.264 NAL units into an RTSP feed or WebRTC stream published to the server.
  - The backend `VisionEngine` samples frames from this stream for target detection and tracking.

---

## 5. Architectural Guardrail

```
+-------------------------------------------------------------------+
|                         Mission Engine                            |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                          Safety Layer                             |
|  - Geofence polygon validation                                    |
|  - Altitude bounds [3m - 50m]                                     |
|  - Battery reserves (20% RTH, 10% Land)                           |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     DroneAdapter Interface                        |
|  + connect(), takeOff(), gotoLocation(), land(), returnToHome()   |
+-------------------------------------------------------------------+
                /                                   \
               v                                     v
+-----------------------------+       +-----------------------------+
|      MockDroneAdapter       |       |     DJIMini3ProAdapter      |
|  - Simulated 3D physics     |       |  - TCP / WebSocket bridge   |
|  - Time acceleration (10x)  |       |  - MSDK v5 Android gateway  |
|  - Fault injection          |       |  - Real RF telemetry stream |
+-----------------------------+       +-----------------------------+
```
