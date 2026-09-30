import { describe, it, expect, beforeEach } from 'vitest';
import {
  MissionStateMachine,
  MissionRunner,
  MissionScheduler,
} from '../../services/mission-engine/dist/index.js';
import { SafetyLayer, DEFAULT_SAFETY_CONFIG } from '../../packages/safety/dist/index.js';
import { MockDroneAdapter } from '../../packages/drone-core/dist/index.js';
import {
  PropertyConfiguration,
  Mission,
  GeoPoint,
} from '../../packages/shared/dist/index.js';

describe('Mission Engine - State Machine & Flight Runner', () => {
  const home: GeoPoint = {
    latitude: 37.774929,
    longitude: -122.419416,
    altitude: 0,
  };

  const property: PropertyConfiguration = {
    id: 'prop-test',
    name: 'Test Estate',
    homePoint: home,
    propertyBoundary: [
      { latitude: 37.7755, longitude: -122.4202 },
      { latitude: 37.7755, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4202 },
    ],
    zones: [],
  };

  it('enforces valid deterministic state machine transitions', () => {
    const sm = new MissionStateMachine('PENDING');

    expect(sm.canTransitionTo('PRE_FLIGHT_CHECK')).toBe(true);
    expect(sm.canTransitionTo('FLYING')).toBe(false); // Illegal jump!

    expect(() => sm.transition('FLYING')).toThrow(/Illegal mission state transition/);

    sm.transition('PRE_FLIGHT_CHECK');
    expect(sm.getStatus()).toBe('PRE_FLIGHT_CHECK');

    sm.transition('READY');
    expect(sm.getStatus()).toBe('READY');

    sm.transition('TAKEOFF');
    expect(sm.getStatus()).toBe('TAKEOFF');

    sm.transition('FLYING');
    expect(sm.getStatus()).toBe('FLYING');

    sm.transition('OBSERVING');
    expect(sm.getStatus()).toBe('OBSERVING');

    sm.transition('RETURNING');
    expect(sm.getStatus()).toBe('RETURNING');

    sm.transition('LANDING');
    expect(sm.getStatus()).toBe('LANDING');

    sm.transition('COMPLETED');
    expect(sm.getStatus()).toBe('COMPLETED');
  });

  it('runs a full multi-waypoint mission from takeoff to completed landing', async () => {
    const drone = new MockDroneAdapter({
      homePoint: home,
      simulationSpeed: 30, // 30x accelerated for fast test execution
    });
    await drone.connect();

    const safety = new SafetyLayer(drone, property, DEFAULT_SAFETY_CONFIG);

    const statesObserved: string[] = [];
    const waypointsReached: number[] = [];

    const runner = new MissionRunner(safety, {
      onStatusChange: (m) => statesObserved.push(m.status),
      onWaypointReached: (m, wp) => waypointsReached.push(wp.index),
    });

    const testMission: Mission = {
      id: 'mission-test-run',
      name: 'Automated Test Patrol',
      propertyId: property.id,
      status: 'PENDING',
      triggerSource: 'MANUAL',
      currentWaypointIndex: 0,
      totalWaypoints: 2,
      createdAt: Date.now(),
      waypoints: [
        {
          id: 'wp-1',
          index: 0,
          location: { latitude: 37.7748, longitude: -122.4195, altitude: 10 },
          speed: 8,
          altitude: 10,
          action: 'HOVER_OBSERVE',
          observationDurationSeconds: 1,
        },
        {
          id: 'wp-2',
          index: 1,
          location: { latitude: 37.7751, longitude: -122.4193, altitude: 12 },
          speed: 8,
          altitude: 12,
          action: 'PASS',
          observationDurationSeconds: 0,
        },
      ],
    };

    const success = await runner.executeMission(testMission);
    expect(success).toBe(true);

    expect(waypointsReached).toEqual([0, 1]);
    expect(statesObserved).toContain('PRE_FLIGHT_CHECK');
    expect(statesObserved).toContain('READY');
    expect(statesObserved).toContain('TAKEOFF');
    expect(statesObserved).toContain('FLYING');
    expect(statesObserved).toContain('OBSERVING');
    expect(statesObserved).toContain('RETURNING');
    expect(statesObserved).toContain('COMPLETED');

    await drone.disconnect();
  });

  it('handles alarm webhook triggers and launches matching patrol mission', async () => {
    const drone = new MockDroneAdapter({ homePoint: home, simulationSpeed: 30 });
    await drone.connect();
    const safety = new SafetyLayer(drone, property);
    const runner = new MissionRunner(safety);
    const scheduler = new MissionScheduler(runner);

    scheduler.registerMissionTemplate({
      id: 'template-front-gate',
      name: 'Front Gate Inspection',
      propertyId: property.id,
      status: 'PENDING',
      triggerSource: 'ALARM',
      currentWaypointIndex: 0,
      totalWaypoints: 1,
      createdAt: Date.now(),
      waypoints: [
        {
          id: 'wp-fg',
          index: 0,
          location: { latitude: 37.7746, longitude: -122.4194, altitude: 10 },
          speed: 6,
          altitude: 10,
          action: 'PASS',
        },
      ],
    });

    const result = await scheduler.handleAlarm({
      source: 'front_gate',
      event: 'motion',
    });

    expect(result.handled).toBe(true);
    expect(result.missionLaunched).toBeDefined();
    expect(result.message).toContain('Front Gate Inspection');

    await drone.disconnect();
  });
});
