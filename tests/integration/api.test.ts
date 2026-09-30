import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import {
  MockDroneAdapter,
} from '../../packages/drone-core/dist/index.js';
import {
  SafetyLayer,
  DEFAULT_SAFETY_CONFIG,
} from '../../packages/safety/dist/index.js';
import {
  MissionRunner,
  MissionScheduler,
} from '../../services/mission-engine/dist/index.js';
import {
  VisionEngine,
  ModularObjectDetector,
} from '../../services/vision/dist/index.js';
import {
  DEFAULT_PROPERTY,
  DEFAULT_MISSIONS,
} from '../../apps/api/dist/defaults.js';

describe('Integration Test: API, Mission Scheduler & Alarm Webhook', () => {
  let drone: MockDroneAdapter;
  let safety: SafetyLayer;
  let runner: MissionRunner;
  let scheduler: MissionScheduler;
  let vision: VisionEngine;

  beforeAll(async () => {
    drone = new MockDroneAdapter({
      homePoint: DEFAULT_PROPERTY.homePoint,
      simulationSpeed: 25,
    });
    await drone.connect();
    safety = new SafetyLayer(drone, DEFAULT_PROPERTY, DEFAULT_SAFETY_CONFIG);
    runner = new MissionRunner(safety);
    scheduler = new MissionScheduler(runner);
    vision = new VisionEngine(DEFAULT_PROPERTY);

    for (const m of DEFAULT_MISSIONS) {
      scheduler.registerMissionTemplate(m);
    }
  });

  afterAll(async () => {
    scheduler.stopAllSchedules();
    await drone.disconnect();
  });

  it('receives alarm webhook and triggers mapped mission automatically', async () => {
    const alarmResult = await scheduler.handleAlarm({
      source: 'front_gate',
      event: 'motion',
      zone: 'zone-front-gate',
    });

    expect(alarmResult.handled).toBe(true);
    expect(alarmResult.missionLaunched).toBeDefined();
    expect(alarmResult.message).toContain('Front Gate Inspection');

    // Verify active mission in runner
    const active = runner.getActiveMission();
    expect(active).toBeDefined();
    expect(active?.triggerSource).toBe('ALARM');
    expect(active?.alarmSource).toBe('front_gate');
  });

  it('executes preflight safety check before flight and validates flight parameters', async () => {
    const preflight = await safety.runPreFlightCheck(DEFAULT_MISSIONS[0]);
    expect(preflight.passed).toBe(true);
    expect(preflight.checks.length).toBe(9);
  });

  it('processes video replay and captures objective incidents', async () => {
    const replayFrames = [
      {
        id: 'rf-1',
        timestamp: Date.now(),
        width: 1920,
        height: 1080,
        droneLocation: {
          latitude: DEFAULT_PROPERTY.homePoint.latitude,
          longitude: DEFAULT_PROPERTY.homePoint.longitude,
          altitude: 15,
        },
        droneHeading: 0,
        gimbalPitch: -45,
        syntheticData: {
          sceneDescription: 'Backyard inspection frame',
          simulatedObjects: [
            {
              label: 'person',
              confidence: 0.94,
              box: [0.5, 0.5, 0.1, 0.2] as [number, number, number, number],
              geoPoint: {
                latitude: 37.7752, // Inside backyard restricted zone!
                longitude: -122.4195,
                altitude: 0,
              },
            },
          ],
        },
      },
    ];

    const replaySummary = await vision.processReplayFrames(replayFrames);
    expect(replaySummary.totalFrames).toBe(1);
    expect(replaySummary.detectionsCount).toBe(1);
    expect(replaySummary.incidentsGenerated.length).toBe(1);
    expect(replaySummary.incidentsGenerated[0].severity).toBe('HIGH');
  });
});
