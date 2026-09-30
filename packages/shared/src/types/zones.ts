import { GeoPoint } from '../geo.js';

export type ZoneType =
  | 'PROPERTY_ZONE' // Primary property boundary
  | 'PUBLIC_ZONE' // Public street / sidewalk (do not monitor or alert, stay clear)
  | 'WATCH_ZONE' // Areas of interest (e.g. perimeter fence, driveway)
  | 'RESTRICTED_ZONE' // Strictly forbidden for strangers (e.g. backyard pool, side entry)
  | 'IGNORE_ZONE'; // Tree canopy, neighbor roof, or ignored zones

export interface ZoneRules {
  alertOnPerson: boolean;
  alertOnVehicle: boolean;
  alertOnLoitering: boolean;
  loiteringThresholdSeconds?: number;
  forbiddenFlight?: boolean; // If true, drone flight itself is forbidden here
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  polygon: GeoPoint[];
  color: string;
  rules: ZoneRules;
}

export interface PropertyConfiguration {
  id: string;
  name: string;
  homePoint: GeoPoint;
  propertyBoundary: GeoPoint[];
  zones: Zone[];
}
