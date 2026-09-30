import { GeoPoint } from '../geo.js';

export type DetectionClass =
  | 'person'
  | 'car'
  | 'van'
  | 'truck'
  | 'motorcycle'
  | 'bicycle'
  | 'dog';

export interface BoundingBox {
  x: number; // Normalized top-left 0..1
  y: number;
  width: number;
  height: number;
}

export interface VisionDetection {
  id: string;
  label: DetectionClass;
  confidence: number; // 0..1
  box: BoundingBox;
  estimatedLocation?: GeoPoint;
  timestamp: number;
}

export interface ObservationRecord {
  timestamp: number;
  box: BoundingBox;
  confidence: number;
  estimatedLocation: GeoPoint;
  zoneId?: string;
}

export interface TrackedObject {
  id: string;
  type: DetectionClass;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  approximateLocation: GeoPoint;
  currentZoneId?: string;
  isLoitering: boolean;
  loiteringDurationSeconds: number;
  observations: ObservationRecord[];
}
