import { describe, it, expect, beforeEach } from 'vitest';
import {
  VisionEngine,
  ModularObjectDetector,
  ObjectTracker,
  IncidentEngine,
} from '../../services/vision/dist/index.js';
import {
  PropertyConfiguration,
  CameraFrame,
  GeoPoint,
} from '../../packages/shared/dist/index.js';

describe('Vision Engine - Tracking, Zone Incident Engine & Video Replay', () => {
  const home: GeoPoint = {
    latitude: 37.774929,
    longitude: -122.419416,
    altitude: 0,
  };

  const property: PropertyConfiguration = {
    id: 'prop-vision-test',
    name: 'Vision Test Site',
    homePoint: home,
    propertyBoundary: [
      { latitude: 37.7755, longitude: -122.4202 },
      { latitude: 37.7755, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4202 },
    ],
    zones: [
      {
        id: 'zone-backyard-restricted',
        name: 'Backyard',
        type: 'RESTRICTED_ZONE',
        polygon: [
          { latitude: 37.775, longitude: -122.42 },
          { latitude: 37.7754, longitude: -122.42 },
          { latitude: 37.7754, longitude: -122.4192 },
          { latitude: 37.775, longitude: -122.4192 },
        ],
        color: '#ef4444',
        rules: {
          alertOnPerson: true,
          alertOnVehicle: false,
          alertOnLoitering: true,
          loiteringThresholdSeconds: 10,
        },
      },
      {
        id: 'zone-sidewalk-public',
        name: 'Public Sidewalk',
        type: 'PUBLIC_ZONE',
        polygon: [
          { latitude: 37.7742, longitude: -122.4202 },
          { latitude: 37.77435, longitude: -122.4202 },
          { latitude: 37.77435, longitude: -122.4186 },
          { latitude: 37.7742, longitude: -122.4186 },
        ],
        color: '#3b82f6',
        rules: {
          alertOnPerson: false,
          alertOnVehicle: false,
          alertOnLoitering: false,
        },
      },
    ],
  };

  let visionEngine: VisionEngine;

  beforeEach(() => {
    visionEngine = new VisionEngine(property);
  });

  it('tracks an object consistently across frames with consistent ID', async () => {
    const frame1: CameraFrame = {
      id: 'f-1',
      timestamp: 1000,
      width: 1920,
      height: 1080,
      droneLocation: { latitude: 37.7748, longitude: -122.4195, altitude: 15 },
      droneHeading: 0,
      gimbalPitch: -45,
      syntheticData: {
        sceneDescription: 'Aerial yard view',
        simulatedObjects: [
          {
            label: 'person',
            confidence: 0.95,
            box: [0.4, 0.4, 0.1, 0.2],
            geoPoint: { latitude: 37.77485, longitude: -122.4195, altitude: 0 },
          },
        ],
      },
    };

    const res1 = await visionEngine.processFrame(frame1);
    expect(res1.tracks).toHaveLength(1);
    const initialTrackId = res1.tracks[0].id;

    // Second frame slightly later with small movement
    const frame2: CameraFrame = {
      id: 'f-2',
      timestamp: 2000,
      width: 1920,
      height: 1080,
      droneLocation: { latitude: 37.7748, longitude: -122.4195, altitude: 15 },
      droneHeading: 0,
      gimbalPitch: -45,
      syntheticData: {
        sceneDescription: 'Aerial yard view',
        simulatedObjects: [
          {
            label: 'person',
            confidence: 0.94,
            box: [0.41, 0.41, 0.1, 0.2],
            geoPoint: { latitude: 37.77486, longitude: -122.4195, altitude: 0 },
          },
        ],
      },
    };

    const res2 = await visionEngine.processFrame(frame2);
    expect(res2.tracks).toHaveLength(1);
    expect(res2.tracks[0].id).toBe(initialTrackId); // Must be the same TrackedObject
    expect(res2.tracks[0].observations).toHaveLength(2);
  });

  it('generates HIGH severity incident when person enters a RESTRICTED_ZONE', async () => {
    const intruderLocation: GeoPoint = {
      latitude: 37.7752, // Inside backyard restricted zone!
      longitude: -122.4195,
      altitude: 0,
    };

    const frame: CameraFrame = {
      id: 'f-intruder',
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      droneLocation: { latitude: 37.775, longitude: -122.4195, altitude: 15 },
      droneHeading: 0,
      gimbalPitch: -45,
      syntheticData: {
        sceneDescription: 'Restricted backyard view',
        simulatedObjects: [
          {
            label: 'person',
            confidence: 0.94,
            box: [0.5, 0.5, 0.1, 0.2],
            geoPoint: intruderLocation,
          },
        ],
      },
    };

    const result = await visionEngine.processFrame(frame);
    expect(result.incidents).toHaveLength(1);

    const inc = result.incidents[0];
    expect(inc.type).toBe('PersonEnteredRestrictedZone');
    expect(inc.severity).toBe('HIGH');
    expect(inc.zoneName).toBe('Backyard');
    expect(inc.confidence).toBe(0.94);
  });

  it('filters out detections on PUBLIC_ZONE to prevent false alarms', async () => {
    const sidewalkPerson: GeoPoint = {
      latitude: 37.77428, // On public sidewalk
      longitude: -122.4195,
      altitude: 0,
    };

    const frame: CameraFrame = {
      id: 'f-sidewalk',
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      droneLocation: { latitude: 37.7745, longitude: -122.4195, altitude: 15 },
      droneHeading: 0,
      gimbalPitch: -45,
      syntheticData: {
        sceneDescription: 'Public sidewalk view',
        simulatedObjects: [
          {
            label: 'person',
            confidence: 0.92,
            box: [0.5, 0.5, 0.1, 0.2],
            geoPoint: sidewalkPerson,
          },
        ],
      },
    };

    const result = await visionEngine.processFrame(frame);
    expect(result.incidents).toHaveLength(0); // Ignored because public street
  });

  it('processes video replay sequence and generates incident audit trail', async () => {
    const baseTime = Date.now();
    const replayFrames: CameraFrame[] = [
      {
        id: 'r-1',
        timestamp: baseTime,
        width: 1920,
        height: 1080,
        droneLocation: { latitude: 37.775, longitude: -122.4195, altitude: 15 },
        droneHeading: 0,
        gimbalPitch: -45,
        syntheticData: {
          sceneDescription: 'Replay frame 1',
          simulatedObjects: [
            {
              label: 'person',
              confidence: 0.91,
              box: [0.4, 0.4, 0.1, 0.2],
              geoPoint: { latitude: 37.7751, longitude: -122.4196, altitude: 0 },
            },
          ],
        },
      },
      {
        id: 'r-2',
        timestamp: baseTime + 2000,
        width: 1920,
        height: 1080,
        droneLocation: { latitude: 37.775, longitude: -122.4195, altitude: 15 },
        droneHeading: 0,
        gimbalPitch: -45,
        syntheticData: {
          sceneDescription: 'Replay frame 2',
          simulatedObjects: [
            {
              label: 'person',
              confidence: 0.93,
              box: [0.42, 0.42, 0.1, 0.2],
              geoPoint: { latitude: 37.77515, longitude: -122.4196, altitude: 0 },
            },
          ],
        },
      },
    ];

    const replaySummary = await visionEngine.processReplayFrames(replayFrames);
    expect(replaySummary.totalFrames).toBe(2);
    expect(replaySummary.detectionsCount).toBe(2);
    expect(replaySummary.incidentsGenerated.length).toBeGreaterThanOrEqual(1);
    expect(replaySummary.incidentsGenerated[0].type).toBe('PersonEnteredRestrictedZone');
  });
});
