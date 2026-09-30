import { GeoPoint } from '../geo.js';

export type FlightMode =
  | 'STANDBY'
  | 'TAKING_OFF'
  | 'AUTO_FLIGHT'
  | 'HOVERING'
  | 'OBSERVING'
  | 'RETURNING_HOME'
  | 'LANDING'
  | 'MANUAL_OVERRIDE'
  | 'EMERGENCY_LANDING';

export type GpsQuality = 'EXCELLENT' | 'GOOD' | 'POOR' | 'LOST';

export type SafetyAlertLevel = 'SAFE' | 'WARNING' | 'EMERGENCY';

export interface DroneTelemetry {
  timestamp: number;
  connected: boolean;
  armed: boolean;
  flightMode: FlightMode;
  location: GeoPoint;
  heading: number; // 0..360 degrees
  speed: number; // m/s horizontal
  verticalSpeed: number; // m/s vertical (+ up, - down)
  batteryPercent: number; // 0..100%
  batteryVoltage: number; // Volts
  gpsSatellites: number;
  gpsQuality: GpsQuality;
  signalStrengthPercent: number; // 0..100%
  inAir: boolean;
  safetyStatus: SafetyAlertLevel;
  distanceToHomeMeters: number;
}

export interface DroneStatus {
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  isConnected: boolean;
  isArmed: boolean;
  inAir: boolean;
  batteryPercent: number;
  currentMode: FlightMode;
  errorMessages: string[];
}

export interface CameraFrame {
  id: string;
  timestamp: number;
  width: number;
  height: number;
  droneLocation: GeoPoint;
  droneHeading: number;
  gimbalPitch: number; // degrees, e.g. -90 (nadir) to 0 (horizon)
  dataUrl?: string; // base64 or object url
  syntheticData?: {
    sceneDescription: string;
    simulatedObjects: Array<{
      label: string;
      box: [number, number, number, number]; // [x, y, w, h] normalized 0..1
      confidence: number;
      geoPoint: GeoPoint;
    }>;
  };
}

export interface PhotoCaptureResult {
  id: string;
  timestamp: number;
  url: string;
  location: GeoPoint;
  heading: number;
}
