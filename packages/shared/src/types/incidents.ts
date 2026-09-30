import { GeoPoint } from '../geo.js';

export type IncidentSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';

export type IncidentType =
  | 'PersonDetected'
  | 'VehicleDetected'
  | 'PersonEnteredProperty'
  | 'PersonEnteredRestrictedZone'
  | 'PersonLoitering'
  | 'VehicleEnteredProperty';

export interface IncidentTimelineEvent {
  timestamp: number;
  description: string;
  location?: GeoPoint;
}

export interface Incident {
  id: string;
  incidentNumber: number;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  timestamp: number;
  durationSeconds: number;
  confidence: number; // e.g. 0.94 -> 94%
  zoneId?: string;
  zoneName?: string;
  location: GeoPoint;
  snapshotUrl?: string;
  videoClipUrl?: string;
  missionId?: string;
  trackedObjectId?: string;
  acknowledged: boolean;
  timeline: IncidentTimelineEvent[];
}
