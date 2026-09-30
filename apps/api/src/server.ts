import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  Mission,
  AuditLog,
  Incident,
  PropertyConfiguration,
  SafetyConfig,
  AlarmPayload,
  CameraFrame,
} from '@patrol/shared';
import { MockDroneAdapter } from '@patrol/drone-core';
import { SafetyLayer, DEFAULT_SAFETY_CONFIG } from '@patrol/safety';
import {
  MissionRunner,
  MissionScheduler,
} from '@patrol/mission-engine';
import { VisionEngine, ModularObjectDetector } from '@patrol/vision';
import { NotificationService } from '@patrol/notifications';
import {
  DEFAULT_PROPERTY,
  DEFAULT_MISSIONS,
  DEFAULT_HOME_POINT,
} from './defaults.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB for video replay

app.use(cors());
app.use(express.json());

// In-Memory Storage & Services
const auditLogs: AuditLog[] = [];
let propertyConfig: PropertyConfiguration = { ...DEFAULT_PROPERTY };
const missions: Map<string, Mission> = new Map();
for (const m of DEFAULT_MISSIONS) {
  missions.set(m.id, { ...m });
}

// 1. Initialize Drone Adapter
const mockDrone = new MockDroneAdapter({
  homePoint: propertyConfig.homePoint,
  simulationSpeed: 5, // default 5x acceleration for fast testing
});

// 2. Initialize Audit Logger callback
const handleAuditLog = (log: AuditLog) => {
  auditLogs.unshift(log);
  if (auditLogs.length > 500) auditLogs.pop();
  broadcast({ type: 'audit_log', data: log });
};

// 3. Initialize Safety Layer
const safetyLayer = new SafetyLayer(
  mockDrone,
  propertyConfig,
  DEFAULT_SAFETY_CONFIG,
  handleAuditLog
);

// 4. Initialize Notifications
const notificationService = new NotificationService();

// 5. Initialize Vision Engine
const detector = new ModularObjectDetector([
  // Initial synthetic scenario target in front gate
  {
    id: 'target-intruder-1',
    label: 'person',
    location: { latitude: 37.77452, longitude: -122.41945, altitude: 0 },
  },
  // Parked vehicle in driveway
  {
    id: 'target-vehicle-1',
    label: 'car',
    location: { latitude: 37.77465, longitude: -122.4192, altitude: 0 },
  },
]);

const visionEngine = new VisionEngine(
  propertyConfig,
  { detector },
  handleAuditLog
);

// Forward incidents to notifications and WebSocket
visionEngine.getIncidentEngine().onIncidentCreated((inc: Incident) => {
  notificationService.notifyIncident(inc);
  broadcast({ type: 'incident_created', data: inc });
});

visionEngine.getIncidentEngine().onIncidentUpdated((inc: Incident) => {
  broadcast({ type: 'incident_updated', data: inc });
});

// 6. Initialize Mission Engine
const missionRunner = new MissionRunner(
  safetyLayer,
  {
    onStatusChange: (m) => {
      missions.set(m.id, { ...m });
      visionEngine.setCurrentMissionId(m.id);
      broadcast({ type: 'mission_status', data: m });
    },
    onWaypointReached: (m, wp) => {
      broadcast({ type: 'waypoint_reached', data: { missionId: m.id, waypoint: wp } });
    },
    onMissionCompleted: (m) => {
      missions.set(m.id, { ...m });
      visionEngine.setCurrentMissionId(undefined);
      broadcast({ type: 'mission_completed', data: m });
    },
    onMissionFailed: (m, reason) => {
      missions.set(m.id, { ...m });
      visionEngine.setCurrentMissionId(undefined);
      broadcast({ type: 'mission_failed', data: { mission: m, reason } });
    },
  },
  handleAuditLog
);

const missionScheduler = new MissionScheduler(missionRunner, handleAuditLog);
for (const m of DEFAULT_MISSIONS) {
  missionScheduler.registerMissionTemplate(m);
}

// 7. Pipe Camera Frames to Vision Engine
mockDrone.onFrame(async (frame: CameraFrame) => {
  const result = await visionEngine.processFrame(frame);
  if (result.detections.length > 0 || result.tracks.length > 0) {
    broadcast({
      type: 'detections',
      data: {
        detections: result.detections,
        tracks: result.tracks,
        frameTimestamp: frame.timestamp,
      },
    });
  }
});

// Auto-connect Mock Drone on boot
mockDrone.connect().catch(console.error);

// WebSocket Broadcasting
function broadcast(message: { type: string; data: unknown }) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }
  }
}

// Telemetry 10Hz Broadcast Loop
setInterval(() => {
  if (wss.clients.size > 0) {
    const telemetry = mockDrone.getTelemetry();
    broadcast({ type: 'telemetry', data: telemetry });
  }
}, 100);

// --- REST API ROUTES ---

// Health
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    droneConnected: mockDrone.getTelemetry().connected,
  });
});

// Drone Status & Telemetry
app.get('/api/drone/status', async (req: Request, res: Response) => {
  const status = await mockDrone.getStatus();
  res.json(status);
});

app.get('/api/drone/telemetry', (req: Request, res: Response) => {
  res.json(mockDrone.getTelemetry());
});

app.post('/api/drone/connect', async (req: Request, res: Response) => {
  const ok = await mockDrone.connect();
  res.json({ success: ok });
});

app.post('/api/drone/disconnect', async (req: Request, res: Response) => {
  const ok = await mockDrone.disconnect();
  res.json({ success: ok });
});

app.post('/api/drone/takeoff', async (req: Request, res: Response) => {
  try {
    const alt = Number(req.body.altitude ?? 10);
    const ok = await safetyLayer.executeValidatedTakeoff(alt);
    res.json({ success: ok });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

app.post('/api/drone/land', async (req: Request, res: Response) => {
  const ok = await safetyLayer.executeEmergencyLand();
  res.json({ success: ok });
});

app.post('/api/drone/rth', async (req: Request, res: Response) => {
  const ok = await safetyLayer.executeEmergencyRth();
  res.json({ success: ok });
});

app.post('/api/drone/pause', async (req: Request, res: Response) => {
  const ok = await safetyLayer.pause();
  res.json({ success: ok });
});

app.post('/api/drone/resume', async (req: Request, res: Response) => {
  const ok = await safetyLayer.resume();
  res.json({ success: ok });
});

app.post('/api/drone/abort', async (req: Request, res: Response) => {
  const ok = await missionRunner.abort();
  res.json({ success: ok });
});

app.post('/api/drone/simulation-speed', (req: Request, res: Response) => {
  const multiplier = Number(req.body.multiplier ?? 1);
  mockDrone.setSimulationSpeed(multiplier);
  res.json({ success: true, multiplier: mockDrone.getSimulationSpeed() });
});

app.post('/api/drone/inject-fault', (req: Request, res: Response) => {
  mockDrone.injectFault(req.body);
  res.json({ success: true, injected: req.body });
});

// Property & Zones
app.get('/api/property', (req: Request, res: Response) => {
  res.json(propertyConfig);
});

app.put('/api/property', (req: Request, res: Response) => {
  propertyConfig = req.body;
  safetyLayer.updateProperty(propertyConfig);
  visionEngine.updateProperty(propertyConfig);
  mockDrone.setHomePoint(propertyConfig.homePoint);
  res.json({ success: true, property: propertyConfig });
});

// Safety Layer Config & PreFlight
app.get('/api/safety/config', (req: Request, res: Response) => {
  res.json(safetyLayer.getConfig());
});

app.put('/api/safety/config', (req: Request, res: Response) => {
  safetyLayer.updateConfig(req.body);
  res.json({ success: true, config: safetyLayer.getConfig() });
});

app.post('/api/safety/preflight', async (req: Request, res: Response) => {
  const missionId = req.body.missionId;
  const mission = missionId ? missions.get(missionId) : undefined;
  const result = await safetyLayer.runPreFlightCheck(mission);
  res.json(result);
});

// Missions
app.get('/api/missions', (req: Request, res: Response) => {
  res.json(Array.from(missions.values()));
});

app.post('/api/missions', (req: Request, res: Response) => {
  const newMission: Mission = {
    ...req.body,
    id: `mission-${Date.now()}`,
    status: 'PENDING',
    currentWaypointIndex: 0,
    totalWaypoints: req.body.waypoints?.length ?? 0,
    createdAt: Date.now(),
  };
  missions.set(newMission.id, newMission);
  missionScheduler.registerMissionTemplate(newMission);
  res.status(201).json(newMission);
});

app.post('/api/missions/:id/start', async (req: Request, res: Response) => {
  const missionId = String(req.params.id);
  const mission = missions.get(missionId);
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }
  // Launch asynchronously so HTTP response is returned immediately
  missionRunner.executeMission(mission).catch((err) => {
    console.error('Mission execution error:', err);
  });
  res.json({ success: true, message: `Mission '${mission.name}' initiated.` });
});

app.post('/api/missions/:id/pause', async (req: Request, res: Response) => {
  const ok = await missionRunner.pause();
  res.json({ success: ok });
});

app.post('/api/missions/:id/resume', async (req: Request, res: Response) => {
  const ok = await missionRunner.resume();
  res.json({ success: ok });
});

app.post('/api/missions/:id/abort', async (req: Request, res: Response) => {
  const ok = await missionRunner.abort();
  res.json({ success: ok });
});

// Alarms Webhook
app.get('/api/alarms/mappings', (req: Request, res: Response) => {
  res.json(missionScheduler.getAlarmMappings());
});

app.post('/api/alarms', async (req: Request, res: Response) => {
  const payload: AlarmPayload = req.body;
  if (!payload.source || !payload.event) {
    res.status(400).json({ error: "Missing required fields 'source' and 'event'." });
    return;
  }
  const result = await missionScheduler.handleAlarm(payload);
  res.json(result);
});

// Incidents
app.get('/api/incidents', (req: Request, res: Response) => {
  res.json(visionEngine.getIncidentEngine().getIncidents());
});

app.get('/api/incidents/:id', (req: Request, res: Response) => {
  const inc = visionEngine.getIncidentEngine().getIncidentById(String(req.params.id));
  if (!inc) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json(inc);
});

app.post('/api/incidents/:id/ack', (req: Request, res: Response) => {
  const ok = visionEngine.getIncidentEngine().acknowledgeIncident(String(req.params.id));
  res.json({ success: ok });
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 100);
  res.json(auditLogs.slice(0, limit));
});

// Notifications
app.get('/api/notifications', (req: Request, res: Response) => {
  res.json(notificationService.getNotifications());
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  notificationService.markAllAsRead();
  res.json({ success: true });
});

// Vision Detections & Video Replay
app.get('/api/vision/detections', (req: Request, res: Response) => {
  res.json({
    detections: visionEngine.getLatestDetections(),
    tracks: visionEngine.getLatestTracks(),
  });
});

app.get('/api/video/snapshot', (req: Request, res: Response) => {
  // Returns SVG snapshot representing aerial camera frame
  const tel = mockDrone.getTelemetry();
  const tracks = visionEngine.getLatestTracks();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#sky)" />
    <!-- Aerial Grid Lines -->
    <path d="M 0 180 L 640 180 M 320 0 L 320 360" stroke="#334155" stroke-dasharray="4,4"/>
    <circle cx="320" cy="180" r="80" stroke="#0284c7" stroke-width="1.5" fill="none" opacity="0.4"/>
    <circle cx="320" cy="180" r="140" stroke="#0284c7" stroke-width="1" fill="none" opacity="0.2"/>
    
    <!-- HUD Overlay -->
    <text x="20" y="30" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="bold">MOCK DRONE CAM 4K (SIMULATED)</text>
    <text x="20" y="48" fill="#94a3b8" font-family="monospace" font-size="11">ALT: ${(tel.location.altitude ?? 0).toFixed(1)}m | SPD: ${tel.speed.toFixed(1)}m/s | HDG: ${tel.heading}°</text>
    <text x="20" y="66" fill="#94a3b8" font-family="monospace" font-size="11">BAT: ${tel.batteryPercent}% (${tel.batteryVoltage.toFixed(1)}V) | SAT: ${tel.gpsSatellites}</text>
    
    <!-- Simulated detected bounding boxes -->
    ${tracks.map((t, idx) => {
      const box = t.observations[t.observations.length - 1]?.box ?? { x: 0.4 + idx * 0.1, y: 0.4, width: 0.1, height: 0.2 };
      const bx = box.x * 640;
      const by = box.y * 360;
      const bw = Math.max(30, box.width * 640);
      const bh = Math.max(40, box.height * 360);
      const isRestricted = t.type === 'person';
      const col = isRestricted ? '#ef4444' : '#38bdf8';
      return `
        <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" stroke="${col}" stroke-width="2" fill="${col}" fill-opacity="0.15" rx="4"/>
        <rect x="${bx}" y="${by - 18}" width="${bw}" height="18" fill="${col}" />
        <text x="${bx + 4}" y="${by - 5}" fill="#ffffff" font-family="sans-serif" font-size="10" font-weight="bold">${t.type.toUpperCase()} #${t.id} (${Math.round(t.confidence * 100)}%)</text>
      `;
    }).join('')}

    <text x="20" y="340" fill="#64748b" font-family="monospace" font-size="10">REC ● ${new Date().toISOString()}</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Video Replay Endpoint
app.post('/api/video/replay', upload.single('video'), async (req: Request, res: Response) => {
  // Generates simulated video frames to replay through the vision pipeline
  const numFrames = Number(req.body.frameCount ?? 15);
  const targetLabel = (req.body.targetLabel ?? 'person') as any;

  const replayFrames: CameraFrame[] = [];
  const baseLat = propertyConfig.homePoint.latitude;
  const baseLon = propertyConfig.homePoint.longitude;

  for (let i = 0; i < numFrames; i++) {
    // Simulate person moving towards backyard over 15 frames
    const stepFraction = i / numFrames;
    const targetLoc = {
      latitude: baseLat + 0.0001 + stepFraction * 0.0002, // moves into backyard!
      longitude: baseLon - 0.0001 + stepFraction * 0.0001,
      altitude: 0,
    };

    replayFrames.push({
      id: `replay-frame-${i}`,
      timestamp: Date.now() + i * 1000,
      width: 1920,
      height: 1080,
      droneLocation: {
        latitude: baseLat,
        longitude: baseLon,
        altitude: 15,
      },
      droneHeading: 45,
      gimbalPitch: -45,
      syntheticData: {
        sceneDescription: `Replay frame ${i + 1}/${numFrames}`,
        simulatedObjects: [
          {
            label: targetLabel,
            confidence: 0.92,
            box: [0.35 + stepFraction * 0.2, 0.4, 0.1, 0.2],
            geoPoint: targetLoc,
          },
        ],
      },
    });
  }

  const replayResult = await visionEngine.processReplayFrames(replayFrames);
  res.json({
    success: true,
    result: replayResult,
    message: `Processed ${replayResult.totalFrames} frames, detected ${replayResult.detectionsCount} instances, generated ${replayResult.incidentsGenerated.length} incidents.`,
  });
});

// Serve static client bundle if built
const webDistPath = path.resolve(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint not found' });
    return;
  }
  res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Drone Property Patrol API active. Build web assets with npm run build.');
    }
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
server.listen(PORT, () => {
  console.log(`[API Server] Drone Property Patrol operational on http://localhost:${PORT}`);
  console.log(`[API Server] WebSocket server active on ws://localhost:${PORT}/ws`);
});
