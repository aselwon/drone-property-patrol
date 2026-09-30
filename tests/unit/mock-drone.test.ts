import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDroneAdapter } from '../../packages/drone-core/dist/index.js';
import { GeoPoint } from '../../packages/shared/dist/index.js';

describe('MockDroneAdapter Simulation Engine', () => {
  let drone: MockDroneAdapter;
  const home: GeoPoint = {
    latitude: 37.774929,
    longitude: -122.419416,
    altitude: 0,
  };

  beforeEach(async () => {
    drone = new MockDroneAdapter({
      homePoint: home,
      simulationSpeed: 20, // 20x accelerated for fast test cycles
    });
    await drone.connect();
  });

  afterEach(async () => {
    await drone.disconnect();
  });

  it('initializes in STANDBY mode with full battery at home coordinates', async () => {
    const status = await drone.getStatus();
    const tel = drone.getTelemetry();

    expect(status.isConnected).toBe(true);
    expect(status.inAir).toBe(false);
    expect(status.currentMode).toBe('STANDBY');
    expect(tel.batteryPercent).toBe(100);
    expect(tel.location.latitude).toBeCloseTo(home.latitude, 5);
    expect(tel.location.longitude).toBeCloseTo(home.longitude, 5);
    expect(tel.location.altitude).toBe(0);
  });

  it('executes takeoff and climbs to target altitude', async () => {
    const takeoffPromise = drone.takeOff(10);
    expect(await takeoffPromise).toBe(true);

    const initialTel = drone.getTelemetry();
    expect(initialTel.flightMode).toBe('TAKING_OFF');
    expect(initialTel.inAir).toBe(true);

    // Wait for simulated climb
    await new Promise((res) => setTimeout(res, 600));

    const airborneTel = drone.getTelemetry();
    expect(airborneTel.location.altitude).toBeGreaterThanOrEqual(9.5);
    expect(['HOVERING', 'AUTO_FLIGHT']).toContain(airborneTel.flightMode);
  });

  it('navigates towards target waypoint and arrives', async () => {
    await drone.takeOff(12);
    await new Promise((res) => setTimeout(res, 500));

    // Target ~20m north
    const targetLat = home.latitude + 0.00018;
    const targetLon = home.longitude;

    const arrived = await drone.gotoLocation(targetLat, targetLon, 12, 10);
    expect(arrived).toBe(true);

    const tel = drone.getTelemetry();
    expect(tel.location.latitude).toBeCloseTo(targetLat, 4);
    expect(tel.location.altitude).toBeCloseTo(12, 1);
  });

  it('executes Return To Home (RTH) and lands at home point', async () => {
    await drone.takeOff(10);
    await new Promise((res) => setTimeout(res, 400));

    // Move away
    await drone.gotoLocation(home.latitude + 0.0002, home.longitude + 0.0002, 12, 10);

    // Trigger RTH
    const rthOk = await drone.returnToHome(20);
    expect(rthOk).toBe(true);

    const rthTel = drone.getTelemetry();
    expect(rthTel.flightMode).toBe('RETURNING_HOME');

    // Wait for return & landing to complete
    await new Promise((res) => setTimeout(res, 1200));

    const finalTel = drone.getTelemetry();
    expect(finalTel.inAir).toBe(false);
    expect(finalTel.flightMode).toBe('STANDBY');
    expect(finalTel.location.altitude).toBeLessThan(0.1);
  });

  it('supports simulation fault injection for low battery and GPS degradation', async () => {
    // Inject low battery
    drone.injectFault({ lowBattery: 15 });
    const telLowBat = drone.getTelemetry();
    expect(telLowBat.batteryPercent).toBe(15);
    expect(telLowBat.safetyStatus).toBe('WARNING');

    // Inject GPS loss
    drone.injectFault({ dropGps: true });
    const telGpsLoss = drone.getTelemetry();
    expect(telGpsLoss.gpsQuality).toBe('LOST');
    expect(telGpsLoss.gpsSatellites).toBe(3);
    expect(telGpsLoss.safetyStatus).toBe('EMERGENCY');
  });
});
