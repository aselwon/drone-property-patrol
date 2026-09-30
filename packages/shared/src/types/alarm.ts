export interface AlarmPayload {
  source: string; // e.g. "front_gate", "garage", "backyard"
  event: string;  // e.g. "motion", "door_open", "breakbeam"
  zone?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface AlarmMapping {
  id: string;
  source: string;
  missionName: string;
  targetZoneId?: string;
  description?: string;
}
