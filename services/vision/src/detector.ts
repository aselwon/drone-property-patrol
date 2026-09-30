import {
  CameraFrame,
  VisionDetection,
  DetectionClass,
  GeoPoint,
  destinationPoint,
} from '@patrol/shared';

export interface ObjectDetector {
  detect(frame: CameraFrame): Promise<VisionDetection[]>;
}

export interface SyntheticTarget {
  id: string;
  label: DetectionClass;
  location: GeoPoint;
  speedMps?: number;
  heading?: number;
}

export class ModularObjectDetector implements ObjectDetector {
  private activeTargets: Map<string, SyntheticTarget> = new Map();
  private confidenceThreshold = 0.5;

  constructor(initialTargets: SyntheticTarget[] = []) {
    for (const target of initialTargets) {
      this.activeTargets.set(target.id, target);
    }
  }

  public setTargets(targets: SyntheticTarget[]): void {
    this.activeTargets.clear();
    for (const target of targets) {
      this.activeTargets.set(target.id, target);
    }
  }

  public addTarget(target: SyntheticTarget): void {
    this.activeTargets.set(target.id, target);
  }

  public removeTarget(targetId: string): void {
    this.activeTargets.delete(targetId);
  }

  public async detect(frame: CameraFrame): Promise<VisionDetection[]> {
    const detections: VisionDetection[] = [];

    // 1. If frame contains synthetic simulated objects directly (e.g. from mock camera or replay stream)
    if (frame.syntheticData && frame.syntheticData.simulatedObjects.length > 0) {
      for (const obj of frame.syntheticData.simulatedObjects) {
        const label = obj.label.toLowerCase() as DetectionClass;
        if (this.isValidClass(label) && obj.confidence >= this.confidenceThreshold) {
          detections.push({
            id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            label,
            confidence: Math.round(obj.confidence * 100) / 100,
            box: {
              x: obj.box[0],
              y: obj.box[1],
              width: obj.box[2],
              height: obj.box[3],
            },
            estimatedLocation: obj.geoPoint,
            timestamp: frame.timestamp,
          });
        }
      }
      return detections;
    }

    // 2. Check field of view against synthetic ground targets
    // Camera FOV approx 80 deg horizontal, altitude determines ground coverage radius
    const alt = frame.droneLocation.altitude ?? 15;
    const fovRadiusMeters = Math.max(5, alt * Math.tan((40 * Math.PI) / 180));

    for (const target of this.activeTargets.values()) {
      // Calculate distance from drone location to target
      const dist = this.roughDistance(frame.droneLocation, target.location);
      if (dist <= fovRadiusMeters * 1.2) {
        // Target is in camera view!
        // Calculate relative position within camera frame (0..1)
        const relX = 0.5 + (target.location.longitude - frame.droneLocation.longitude) * 5000;
        const relY = 0.5 + (target.location.latitude - frame.droneLocation.latitude) * 5000;

        const clampedX = Math.max(0.1, Math.min(0.8, relX));
        const clampedY = Math.max(0.1, Math.min(0.8, relY));

        detections.push({
          id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          label: target.label,
          confidence: 0.88 + Math.random() * 0.1, // High, realistic confidence
          box: {
            x: clampedX,
            y: clampedY,
            width: target.label === 'person' || target.label === 'dog' ? 0.08 : 0.18,
            height: target.label === 'person' ? 0.16 : 0.12,
          },
          estimatedLocation: { ...target.location },
          timestamp: frame.timestamp,
        });
      }
    }

    return detections;
  }

  private isValidClass(label: string): label is DetectionClass {
    const valid: DetectionClass[] = [
      'person',
      'car',
      'van',
      'truck',
      'motorcycle',
      'bicycle',
      'dog',
    ];
    return valid.includes(label as DetectionClass);
  }

  private roughDistance(p1: GeoPoint, p2: GeoPoint): number {
    const dLat = (p2.latitude - p1.latitude) * 111000;
    const dLon =
      (p2.longitude - p1.longitude) *
      111000 *
      Math.cos((p1.latitude * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon);
  }
}
