import {
  DroneStatus,
  DroneTelemetry,
  CameraFrame,
  PhotoCaptureResult,
  GeoPoint,
} from '@patrol/shared';

export interface DroneAdapter {
  readonly id: string;
  readonly name: string;

  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getStatus(): Promise<DroneStatus>;
  getTelemetry(): DroneTelemetry;
  onTelemetry(callback: (telemetry: DroneTelemetry) => void): () => void;

  takeOff(targetAltitude?: number): Promise<boolean>;
  land(): Promise<boolean>;
  returnToHome(rthAltitude?: number): Promise<boolean>;
  gotoLocation(
    latitude: number,
    longitude: number,
    altitude?: number,
    speed?: number
  ): Promise<boolean>;

  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  abort(): Promise<boolean>;

  setHomePoint(location: GeoPoint): void;
  getHomePoint(): GeoPoint;

  capturePhoto(): Promise<PhotoCaptureResult>;
  startVideo(): Promise<boolean>;
  stopVideo(): Promise<boolean>;
  onFrame(callback: (frame: CameraFrame) => void): () => void;

  setSimulationSpeed?(multiplier: number): void;
  injectFault?(fault: {
    lowBattery?: number;
    dropGps?: boolean;
    disconnect?: boolean;
    sensorNoise?: boolean;
  }): void;
}
