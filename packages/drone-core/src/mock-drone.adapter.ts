import {
  DroneAdapter,
} from './adapter.interface.js';
import {
  DroneStatus,
  DroneTelemetry,
  CameraFrame,
  PhotoCaptureResult,
  FlightMode,
  GpsQuality,
  GeoPoint,
  calculateDistanceMeters,
  calculateBearing,
  destinationPoint,
} from '@patrol/shared';

export interface MockDroneOptions {
  initialLocation?: GeoPoint;
  homePoint?: GeoPoint;
  simulationSpeed?: number;
  batteryPercent?: number;
}

export class MockDroneAdapter implements DroneAdapter {
  readonly id = 'mock-drone-adapter';
  readonly name = 'Mock Drone (Simulated Physics)';

  private isConnected = false;
  private isArmed = false;
  private inAir = false;
  private flightMode: FlightMode = 'STANDBY';

  private homePoint: GeoPoint;
  private currentLocation: GeoPoint;
  private targetLocation: (GeoPoint & { speed?: number }) | null = null;

  private heading = 0; // degrees
  private currentSpeed = 0; // m/s horizontal
  private verticalSpeed = 0; // m/s
  private batteryPercent = 100;
  private batteryVoltage = 12.6; // 3S LiPo ~ 12.6V fully charged
  private gpsSatellites = 18;
  private gpsQuality: GpsQuality = 'EXCELLENT';
  private signalStrengthPercent = 98;

  private simulationSpeedMultiplier = 1; // 1 real sec = N simulated sec
  private updateIntervalMs = 100; // Real-world update loop interval
  private simTimer: NodeJS.Timeout | null = null;
  private frameTimer: NodeJS.Timeout | null = null;

  private telemetryListeners: Set<(t: DroneTelemetry) => void> = new Set();
  private frameListeners: Set<(f: CameraFrame) => void> = new Set();
  private waypointArrivalCallbacks: Array<{
    target: GeoPoint;
    resolve: () => void;
  }> = [];

  private isVideoRecording = false;
  private faultInjected = {
    dropGps: false,
    lowBattery: false,
    disconnect: false,
  };

  constructor(options: MockDroneOptions = {}) {
    const defaultHome: GeoPoint = {
      latitude: 37.774929,
      longitude: -122.419416,
      altitude: 0,
    };

    this.homePoint = options.homePoint ?? options.initialLocation ?? defaultHome;
    this.currentLocation = {
      latitude: this.homePoint.latitude,
      longitude: this.homePoint.longitude,
      altitude: 0,
    };

    if (options.simulationSpeed !== undefined) {
      this.simulationSpeedMultiplier = Math.max(0.1, options.simulationSpeed);
    }
    if (options.batteryPercent !== undefined) {
      this.batteryPercent = Math.max(0, Math.min(100, options.batteryPercent));
    }
  }

  public async connect(): Promise<boolean> {
    if (this.faultInjected.disconnect) {
      return false;
    }
    this.isConnected = true;
    this.startSimulationLoop();
    return true;
  }

  public async disconnect(): Promise<boolean> {
    this.isConnected = false;
    this.stopSimulationLoop();
    return true;
  }

  public async getStatus(): Promise<DroneStatus> {
    return {
      model: 'Simulated DJI Mini 3 Pro (Mock)',
      firmwareVersion: 'v01.00.0600-SIM',
      serialNumber: 'SIM-MINI3-PRO-001',
      isConnected: this.isConnected,
      isArmed: this.isArmed,
      inAir: this.inAir,
      batteryPercent: Math.round(this.batteryPercent),
      currentMode: this.flightMode,
      errorMessages: this.faultInjected.dropGps ? ['GPS Signal Lost'] : [],
    };
  }

  public getTelemetry(): DroneTelemetry {
    const distHome = calculateDistanceMeters(this.currentLocation, this.homePoint);
    return {
      timestamp: Date.now(),
      connected: this.isConnected,
      armed: this.isArmed,
      flightMode: this.flightMode,
      location: { ...this.currentLocation },
      heading: Math.round(this.heading),
      speed: Math.round(this.currentSpeed * 10) / 10,
      verticalSpeed: Math.round(this.verticalSpeed * 10) / 10,
      batteryPercent: Math.max(0, Math.round(this.batteryPercent)),
      batteryVoltage: Math.round(this.batteryVoltage * 10) / 10,
      gpsSatellites: this.gpsSatellites,
      gpsQuality: this.gpsQuality,
      signalStrengthPercent: this.signalStrengthPercent,
      inAir: this.inAir,
      safetyStatus:
        this.batteryPercent < 15 || this.gpsQuality === 'LOST'
          ? 'EMERGENCY'
          : this.batteryPercent < 25 || this.gpsQuality === 'POOR'
          ? 'WARNING'
          : 'SAFE',
      distanceToHomeMeters: Math.round(distHome * 10) / 10,
    };
  }

  public onTelemetry(callback: (telemetry: DroneTelemetry) => void): () => void {
    this.telemetryListeners.add(callback);
    return () => this.telemetryListeners.delete(callback);
  }

  public setHomePoint(location: GeoPoint): void {
    this.homePoint = { ...location };
  }

  public getHomePoint(): GeoPoint {
    return { ...this.homePoint };
  }

  public async takeOff(targetAltitude = 10): Promise<boolean> {
    if (!this.isConnected || this.inAir) {
      return false;
    }
    this.isArmed = true;
    this.inAir = true;
    this.flightMode = 'TAKING_OFF';
    this.targetLocation = {
      latitude: this.currentLocation.latitude,
      longitude: this.currentLocation.longitude,
      altitude: targetAltitude,
      speed: 2.0,
    };
    return true;
  }

  public async land(): Promise<boolean> {
    if (!this.isConnected || !this.inAir) {
      return false;
    }
    this.flightMode = 'LANDING';
    this.targetLocation = {
      latitude: this.currentLocation.latitude,
      longitude: this.currentLocation.longitude,
      altitude: 0,
      speed: 1.5,
    };
    return true;
  }

  public async returnToHome(rthAltitude = 25): Promise<boolean> {
    if (!this.isConnected || !this.inAir) {
      return false;
    }
    this.flightMode = 'RETURNING_HOME';

    // RTH profile: fly to home coordinate at rthAltitude
    const currentAlt = this.currentLocation.altitude ?? 0;
    const safeAlt = Math.max(currentAlt, rthAltitude);

    this.targetLocation = {
      latitude: this.homePoint.latitude,
      longitude: this.homePoint.longitude,
      altitude: safeAlt,
      speed: 6.0, // RTH cruise speed
    };

    return true;
  }

  public async gotoLocation(
    latitude: number,
    longitude: number,
    altitude?: number,
    speed = 5.0
  ): Promise<boolean> {
    if (!this.isConnected || !this.inAir) {
      return false;
    }

    this.flightMode = 'AUTO_FLIGHT';
    const targetAlt = altitude ?? this.currentLocation.altitude ?? 15;
    this.targetLocation = {
      latitude,
      longitude,
      altitude: targetAlt,
      speed: Math.max(1, Math.min(15, speed)),
    };

    return new Promise<boolean>((resolve) => {
      this.waypointArrivalCallbacks.push({
        target: { latitude, longitude, altitude: targetAlt },
        resolve: () => resolve(true),
      });
    });
  }

  public async pause(): Promise<boolean> {
    if (!this.inAir) return false;
    this.flightMode = 'HOVERING';
    this.currentSpeed = 0;
    this.verticalSpeed = 0;
    return true;
  }

  public async resume(): Promise<boolean> {
    if (!this.inAir) return false;
    if (this.targetLocation) {
      this.flightMode = 'AUTO_FLIGHT';
    }
    return true;
  }

  public async abort(): Promise<boolean> {
    this.targetLocation = null;
    this.waypointArrivalCallbacks = [];
    return this.returnToHome();
  }

  public async capturePhoto(): Promise<PhotoCaptureResult> {
    return {
      id: `photo-${Date.now()}`,
      timestamp: Date.now(),
      url: `/api/video/snapshot?t=${Date.now()}`,
      location: { ...this.currentLocation },
      heading: this.heading,
    };
  }

  public async startVideo(): Promise<boolean> {
    this.isVideoRecording = true;
    return true;
  }

  public async stopVideo(): Promise<boolean> {
    this.isVideoRecording = false;
    return true;
  }

  public onFrame(callback: (frame: CameraFrame) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }

  public setSimulationSpeed(multiplier: number): void {
    this.simulationSpeedMultiplier = Math.max(0.1, Math.min(50, multiplier));
  }

  public getSimulationSpeed(): number {
    return this.simulationSpeedMultiplier;
  }

  public injectFault(fault: {
    lowBattery?: number;
    dropGps?: boolean;
    disconnect?: boolean;
    sensorNoise?: boolean;
  }): void {
    if (fault.lowBattery !== undefined) {
      this.batteryPercent = Math.max(0, Math.min(100, fault.lowBattery));
      this.batteryVoltage = 10.5 + (this.batteryPercent / 100) * 2.1;
      this.faultInjected.lowBattery = true;
    }
    if (fault.dropGps !== undefined) {
      this.faultInjected.dropGps = fault.dropGps;
      if (fault.dropGps) {
        this.gpsSatellites = 3;
        this.gpsQuality = 'LOST';
      } else {
        this.gpsSatellites = 18;
        this.gpsQuality = 'EXCELLENT';
      }
    }
    if (fault.disconnect !== undefined) {
      this.faultInjected.disconnect = fault.disconnect;
      if (fault.disconnect) {
        this.isConnected = false;
      }
    }
  }

  // --- Private simulation physics engine ---

  private startSimulationLoop(): void {
    if (this.simTimer) return;

    this.simTimer = setInterval(() => {
      this.tickPhysics();
      this.emitTelemetry();
    }, this.updateIntervalMs);

    this.frameTimer = setInterval(() => {
      this.emitSimulatedFrame();
    }, 500); // 2 fps simulated frames for vision ingestion
  }

  private stopSimulationLoop(): void {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private tickPhysics(): void {
    const dtSeconds = (this.updateIntervalMs / 1000) * this.simulationSpeedMultiplier;

    // Simulate battery consumption
    if (this.inAir) {
      // ~0.04% per sec hover (25 mins total), more during high speed climb
      const baseDrain = 0.04;
      const speedFactor = (this.currentSpeed / 10) * 0.03;
      const climbFactor = Math.abs(this.verticalSpeed) * 0.02;
      const totalDrain = (baseDrain + speedFactor + climbFactor) * dtSeconds;
      this.batteryPercent = Math.max(0, this.batteryPercent - totalDrain);
      this.batteryVoltage = 10.5 + (this.batteryPercent / 100) * 2.1;

      // Critical battery failsafe inside mock drone if below 5%
      if (this.batteryPercent <= 5 && this.flightMode !== 'EMERGENCY_LANDING') {
        this.flightMode = 'EMERGENCY_LANDING';
        this.targetLocation = {
          latitude: this.currentLocation.latitude,
          longitude: this.currentLocation.longitude,
          altitude: 0,
          speed: 2.0,
        };
      }
    }

    if (!this.inAir || !this.targetLocation) {
      this.currentSpeed = 0;
      this.verticalSpeed = 0;
      return;
    }

    const currentAlt = this.currentLocation.altitude ?? 0;
    const targetAlt = this.targetLocation.altitude ?? currentAlt;
    const maxSpeed = this.targetLocation.speed ?? 5.0;

    const distHorizontal = calculateDistanceMeters(
      this.currentLocation,
      this.targetLocation
    );
    const altDiff = targetAlt - currentAlt;

    // Takeoff phase
    if (this.flightMode === 'TAKING_OFF') {
      this.verticalSpeed = 2.0;
      const newAlt = currentAlt + this.verticalSpeed * dtSeconds;
      if (newAlt >= targetAlt) {
        this.currentLocation.altitude = targetAlt;
        this.verticalSpeed = 0;
        this.flightMode = 'HOVERING';
        this.notifyArrival();
      } else {
        this.currentLocation.altitude = newAlt;
      }
      return;
    }

    // Landing / Emergency Landing phase
    if (this.flightMode === 'LANDING' || this.flightMode === 'EMERGENCY_LANDING') {
      this.verticalSpeed = -1.5;
      const newAlt = currentAlt + this.verticalSpeed * dtSeconds;
      if (newAlt <= 0.05) {
        this.currentLocation.altitude = 0;
        this.verticalSpeed = 0;
        this.currentSpeed = 0;
        this.inAir = false;
        this.isArmed = false;
        this.flightMode = 'STANDBY';
        this.targetLocation = null;
        this.notifyArrival();
      } else {
        this.currentLocation.altitude = newAlt;
      }
      return;
    }

    // Returning home phase: fly to home coords, then initiate landing once overhead
    if (this.flightMode === 'RETURNING_HOME') {
      if (distHorizontal < 1.0) {
        // Drone reached overhead of home point, now initiate landing descent
        this.flightMode = 'LANDING';
        this.targetLocation = {
          latitude: this.homePoint.latitude,
          longitude: this.homePoint.longitude,
          altitude: 0,
          speed: 1.5,
        };
        return;
      }
    }

    // Normal flight movement towards targetLocation
    if (distHorizontal > 0.2) {
      const targetBearing = calculateBearing(
        this.currentLocation,
        this.targetLocation
      );
      this.heading = targetBearing;
      this.currentSpeed = Math.min(maxSpeed, distHorizontal / Math.max(0.01, dtSeconds));

      const stepDistMeters = this.currentSpeed * dtSeconds;
      if (stepDistMeters >= distHorizontal) {
        this.currentLocation.latitude = this.targetLocation.latitude;
        this.currentLocation.longitude = this.targetLocation.longitude;
        this.currentSpeed = 0;
      } else {
        const nextPoint = destinationPoint(
          this.currentLocation,
          stepDistMeters,
          targetBearing
        );
        this.currentLocation.latitude = nextPoint.latitude;
        this.currentLocation.longitude = nextPoint.longitude;
      }
    } else {
      this.currentSpeed = 0;
      this.currentLocation.latitude = this.targetLocation.latitude;
      this.currentLocation.longitude = this.targetLocation.longitude;
    }

    // Altitude adjustment with strict overshoot protection
    if (Math.abs(altDiff) > 0.1) {
      const vDir = altDiff > 0 ? 1 : -1;
      this.verticalSpeed = vDir * Math.min(3.0, Math.abs(altDiff));
      const stepAlt = this.verticalSpeed * dtSeconds;
      if (Math.abs(stepAlt) >= Math.abs(altDiff)) {
        this.currentLocation.altitude = targetAlt;
        this.verticalSpeed = 0;
      } else {
        this.currentLocation.altitude = currentAlt + stepAlt;
      }
    } else {
      this.verticalSpeed = 0;
      this.currentLocation.altitude = targetAlt;
    }

    // Arrival check (within 1m horizontal and 0.5m vertical)
    const finalDist = calculateDistanceMeters(this.currentLocation, this.targetLocation);
    const finalAltDiff = Math.abs((this.currentLocation.altitude ?? 0) - targetAlt);
    if (finalDist <= 1.0 && finalAltDiff <= 0.5) {
      if (this.flightMode === 'AUTO_FLIGHT') {
        this.flightMode = 'HOVERING';
        this.notifyArrival();
      }
    }
  }

  private notifyArrival(): void {
    const callbacks = [...this.waypointArrivalCallbacks];
    this.waypointArrivalCallbacks = [];
    for (const item of callbacks) {
      item.resolve();
    }
  }

  private emitTelemetry(): void {
    if (!this.isConnected) return;
    const telemetry = this.getTelemetry();
    for (const listener of this.telemetryListeners) {
      try {
        listener(telemetry);
      } catch (err) {
        console.error('Error in telemetry listener:', err);
      }
    }
  }

  private emitSimulatedFrame(): void {
    if (!this.isConnected || !this.inAir) return;

    // Generate mock camera telemetry frame
    const frame: CameraFrame = {
      id: `frame-${Date.now()}`,
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      droneLocation: { ...this.currentLocation },
      droneHeading: this.heading,
      gimbalPitch: -45, // 45 degrees downward pitch
      syntheticData: {
        sceneDescription: `Aerial view from lat:${this.currentLocation.latitude.toFixed(6)}, lon:${this.currentLocation.longitude.toFixed(6)}, alt:${(this.currentLocation.altitude ?? 0).toFixed(1)}m`,
        simulatedObjects: [],
      },
    };

    for (const listener of this.frameListeners) {
      try {
        listener(frame);
      } catch (err) {
        console.error('Error in frame listener:', err);
      }
    }
  }
}
