import { GeoPoint } from '../geo.js';

export type WaypointAction = 'PASS' | 'HOVER_OBSERVE' | 'CAPTURE_PHOTO' | 'PANORAMA';

export interface Waypoint {
  id: string;
  index: number;
  location: GeoPoint;
  speed?: number; // m/s
  altitude?: number; // meters AGL
  observationDurationSeconds?: number;
  action: WaypointAction;
  heading?: number; // target heading (optional)
  gimbalPitch?: number; // degrees
}

export type MissionStatus =
  | 'PENDING'
  | 'PRE_FLIGHT_CHECK'
  | 'READY'
  | 'TAKEOFF'
  | 'FLYING'
  | 'OBSERVING'
  | 'RETURNING'
  | 'LANDING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'FAILED';

export type MissionTriggerSource =
  | 'MANUAL'
  | 'SCHEDULED'
  | 'INTERVAL'
  | 'ALARM';

export interface MissionSchedule {
  enabled: boolean;
  cronExpression?: string; // e.g. "0 */2 * * *"
  intervalMinutes?: number; // e.g. 60
  nextRunTime?: number;
}

export interface Mission {
  id: string;
  name: string;
  description?: string;
  propertyId: string;
  waypoints: Waypoint[];
  status: MissionStatus;
  triggerSource: MissionTriggerSource;
  alarmSource?: string;
  schedule?: MissionSchedule;
  currentWaypointIndex: number;
  totalWaypoints: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationSeconds?: number;
  failureReason?: string;
}
