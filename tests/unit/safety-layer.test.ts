import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyLayer, DEFAULT_SAFETY_CONFIG } from '../../packages/safety/dist/index.js';
import { MockDroneAdapter } from '../../packages/drone-core/dist/index.js';
import {
  PropertyConfiguration,
  GeoPoint,
  Mission,
  AuditLog,
} from '../../packages/shared/dist/index.js';

describe('SafetyLayer - Geofence & Command Validation Engine', () => {
  let drone: MockDroneAdapter;
  let safety: SafetyLayer;
  let auditTrail: AuditLog[] = [];

  const home: GeoPoint = {
    latitude: 37.774929,
    longitude: -122.419416,
    altitude: 0,
  };

  const property: PropertyConfiguration = {
    id: 'test-property',
    name: 'Test Secure Facility',
    homePoint: home,
    propertyBoundary: [
      { latitude: 37.7755, longitude: -122.4202 },
      { latitude: 37.7755, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4186 },
      { latitude: 37.7743, longitude: -122.4202 },
    ],
    zones: [
      {
        id: 'zone-transformer-shed',
        name: 'High Voltage Shed',
        type: 'RESTRICTED_ZONE',
        polygon: [
          { latitude: 37.7752, longitude: -122.4192 },
          { latitude: 37.7754, longitude: -122.4192 },
          { latitude: 37.7754, longitude: -122.4188 },
          { latitude: 37.7752, longitude: -122.4188 },
        ],
        color: '#ff0000',
        rules: {
          alertOnPerson: true,
          alertOnVehicle: false,
          alertOnLoitering: false,
          forbiddenFlight: true, // Strict no-fly zone!
        },
      },
    ],
  };

  beforeEach(async () => {
    auditTrail = [];
    drone = new MockDroneAdapter({
      homePoint: home,
      simulationSpeed: 20,
    });
    await drone.connect();
    safety = new SafetyLayer(
      drone,
      property,
      DEFAULT_SAFETY_CONFIG,
      (log) => auditTrail.push(log)
    );
  });

  it('approves movements within property boundary and safe altitudes', () => {
    const validTarget: GeoPoint = {
      latitude: 37.7748,
      longitude: -122.4195,
      altitude: 15,
    };
    const validation = safety.validateMovement(home, validTarget, 90);
    expect(validation.allowed).toBe(true);
    expect(validation.violations).toHaveLength(0);
  });

  it('rejects movements that violate the property boundary geofence', () => {
    const outsideTarget: GeoPoint = {
      latitude: 37.7765, // Far north outside property
      longitude: -122.4194,
      altitude: 15,
    };
    const validation = safety.validateMovement(home, outsideTarget, 90);
    expect(validation.allowed).toBe(false);
    expect(
      validation.violations.some((v) => v.code === 'OUTSIDE_PROPERTY_BOUNDARY')
    ).toBe(true);
  });

  it('rejects target waypoints inside a forbidden restricted zone', () => {
    const insideRestricted: GeoPoint = {
      latitude: 37.7753, // Inside transformer shed
      longitude: -122.419,
      altitude: 15,
    };
    const validation = safety.validateMovement(home, insideRestricted, 90);
    expect(validation.allowed).toBe(false);
    expect(
      validation.violations.some((v) => v.code === 'RESTRICTED_ZONE_INCURSION')
    ).toBe(true);
  });

  it('rejects flight trajectories that cross through a forbidden restricted zone', () => {
    const startNorth: GeoPoint = { latitude: 37.77545, longitude: -122.419 };
    const endSouth: GeoPoint = { latitude: 37.7751, longitude: -122.419 }; // Crosses shed!

    const validation = safety.validateMovement(startNorth, endSouth, 90);
    expect(validation.allowed).toBe(false);
    expect(
      validation.violations.some((v) => v.code === 'RESTRICTED_ZONE_INCURSION')
    ).toBe(true);
  });

  it('rejects altitudes exceeding maximum ceiling or below minimum clearance', () => {
    const tooHigh: GeoPoint = {
      latitude: 37.7748,
      longitude: -122.4195,
      altitude: 75, // Ceiling is 50m
    };
    const valHigh = safety.validateMovement(home, tooHigh, 90);
    expect(valHigh.allowed).toBe(false);
    expect(
      valHigh.violations.some((v) => v.code === 'ALTITUDE_EXCEEDED_MAX')
    ).toBe(true);

    const tooLow: GeoPoint = {
      latitude: 37.7748,
      longitude: -122.4195,
      altitude: 1.5, // Min is 3m
    };
    const valLow = safety.validateMovement(home, tooLow, 90);
    expect(valLow.allowed).toBe(false);
    expect(valLow.violations.some((v) => v.code === 'ALTITUDE_BELOW_MIN')).toBe(true);
  });

  it('rejects movements when battery reserve is below minimum safe threshold', () => {
    const validTarget: GeoPoint = {
      latitude: 37.7748,
      longitude: -122.4195,
      altitude: 15,
    };
    // Reserve is 20%, passing 15%
    const val = safety.validateMovement(home, validTarget, 15);
    expect(val.allowed).toBe(false);
    expect(
      val.violations.some((v) => v.code === 'INSUFFICIENT_BATTERY_RESERVE')
    ).toBe(true);
  });

  it('passes comprehensive PreFlightCheck under normal operational conditions', async () => {
    const result = await safety.runPreFlightCheck();
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(9);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    expect(auditTrail.some((a) => a.event === 'PREFLIGHT_PASSED')).toBe(true);
  });

  it('fails PreFlightCheck when GPS signal is degraded', async () => {
    drone.injectFault({ dropGps: true });

    const result = await safety.runPreFlightCheck();
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('GPS degraded');
    expect(auditTrail.some((a) => a.event === 'PREFLIGHT_FAILED')).toBe(true);
  });

  it('fails PreFlightCheck when battery is insufficient for mission departure', async () => {
    drone.injectFault({ lowBattery: 25 }); // Need min 30% for departure

    const result = await safety.runPreFlightCheck();
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Battery too low');
  });

  it('logs MOVEMENT_REJECTED to audit log and throws when executing unsafe movement', async () => {
    const invalidTarget: GeoPoint = {
      latitude: 37.778, // Far outside geofence
      longitude: -122.4195,
      altitude: 20,
    };

    await expect(
      safety.executeValidatedMovement(invalidTarget, 5, 'mission-test-1')
    ).rejects.toThrow(/Safety Layer rejected movement/);

    expect(auditTrail.some((a) => a.event === 'MOVEMENT_REJECTED')).toBe(true);
  });
});
