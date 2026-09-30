import { GeoPoint } from '../geo.js';

export interface SafetyConfig {
  maxAltitude: number; // e.g. 50 meters AGL
  minAltitude: number; // e.g. 3 meters AGL
  maxDistanceFromHome: number; // e.g. 200 meters
  returnHomeAltitude: number; // e.g. 25 meters AGL
  minimumBatteryReserve: number; // e.g. 20% (trigger RTH)
  criticalBatteryReserve: number; // e.g. 10% (immediate emergency land)
  maxWindSpeedMps: number; // e.g. 10 m/s
  geofenceStrict: boolean; // reject any movement outside property polygon
  minGpsSatellites: number; // e.g. 10 satellites
}

export interface CheckItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

export interface PreFlightCheckResult {
  passed: boolean;
  timestamp: number;
  checks: CheckItem[];
  reason?: string;
}

export interface GeofenceViolation {
  code:
    | 'OUTSIDE_PROPERTY_BOUNDARY'
    | 'RESTRICTED_ZONE_INCURSION'
    | 'ALTITUDE_EXCEEDED_MAX'
    | 'ALTITUDE_BELOW_MIN'
    | 'DISTANCE_FROM_HOME_EXCEEDED'
    | 'INSUFFICIENT_BATTERY_RESERVE';
  message: string;
  attemptedLocation: GeoPoint;
  details?: Record<string, unknown>;
}

export interface MovementValidationResult {
  allowed: boolean;
  violations: GeofenceViolation[];
}
