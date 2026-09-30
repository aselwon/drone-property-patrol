import {
  VisionDetection,
  TrackedObject,
  BoundingBox,
  GeoPoint,
  calculateDistanceMeters,
} from '@patrol/shared';

export interface TrackerOptions {
  maxAgeSeconds?: number;
  matchDistanceThresholdMeters?: number;
  minIouThreshold?: number;
}

export class ObjectTracker {
  private activeTracks: Map<string, TrackedObject> = new Map();
  private maxAgeSeconds: number;
  private matchDistanceThresholdMeters: number;
  private minIouThreshold: number;
  private nextTrackId = 1;

  constructor(options: TrackerOptions = {}) {
    this.maxAgeSeconds = options.maxAgeSeconds ?? 10;
    this.matchDistanceThresholdMeters = options.matchDistanceThresholdMeters ?? 6.0;
    this.minIouThreshold = options.minIouThreshold ?? 0.2;
  }

  public getActiveTracks(): TrackedObject[] {
    return Array.from(this.activeTracks.values());
  }

  public getTrack(id: string): TrackedObject | undefined {
    return this.activeTracks.get(id);
  }

  /**
   * Updates tracking states with newly detected objects from the current frame.
   */
  public update(detections: VisionDetection[], currentTimestamp: number): TrackedObject[] {
    // 1. Remove expired tracks
    this.purgeStaleTracks(currentTimestamp);

    const unmatchedDetections: VisionDetection[] = [];

    for (const det of detections) {
      let bestMatchId: string | null = null;
      let highestSimilarity = 0;

      for (const [id, track] of this.activeTracks.entries()) {
        if (track.type !== det.label) continue;

        let similarity = 0;

        // Compare geodetic location if available
        if (det.estimatedLocation && track.approximateLocation) {
          const dist = calculateDistanceMeters(
            det.estimatedLocation,
            track.approximateLocation
          );
          if (dist <= this.matchDistanceThresholdMeters) {
            similarity = 1 - dist / this.matchDistanceThresholdMeters;
          }
        }

        // Compare bounding box IOU
        const lastObs = track.observations[track.observations.length - 1];
        if (lastObs) {
          const iou = this.calculateIou(det.box, lastObs.box);
          if (iou > this.minIouThreshold) {
            similarity = Math.max(similarity, iou);
          }
        }

        if (similarity > highestSimilarity && similarity >= 0.2) {
          highestSimilarity = similarity;
          bestMatchId = id;
        }
      }

      if (bestMatchId) {
        // Update existing track
        const track = this.activeTracks.get(bestMatchId)!;
        track.lastSeen = currentTimestamp;
        track.confidence = Math.round(((track.confidence + det.confidence) / 2) * 100) / 100;
        if (det.estimatedLocation) {
          track.approximateLocation = { ...det.estimatedLocation };
        }
        track.loiteringDurationSeconds = Math.round(
          (track.lastSeen - track.firstSeen) / 1000
        );
        track.observations.push({
          timestamp: currentTimestamp,
          box: det.box,
          confidence: det.confidence,
          estimatedLocation: det.estimatedLocation ?? track.approximateLocation,
        });

        // Cap stored observation history per track to 50
        if (track.observations.length > 50) {
          track.observations.shift();
        }
      } else {
        unmatchedDetections.push(det);
      }
    }

    // 2. Initialize new tracks for unmatched detections
    for (const det of unmatchedDetections) {
      const trackId = `TRK-${this.nextTrackId++}`;
      const defaultLoc: GeoPoint = det.estimatedLocation ?? {
        latitude: 0,
        longitude: 0,
        altitude: 0,
      };

      const newTrack: TrackedObject = {
        id: trackId,
        type: det.label,
        confidence: det.confidence,
        firstSeen: currentTimestamp,
        lastSeen: currentTimestamp,
        approximateLocation: defaultLoc,
        isLoitering: false,
        loiteringDurationSeconds: 0,
        observations: [
          {
            timestamp: currentTimestamp,
            box: det.box,
            confidence: det.confidence,
            estimatedLocation: defaultLoc,
          },
        ],
      };

      this.activeTracks.set(trackId, newTrack);
    }

    return this.getActiveTracks();
  }

  private calculateIou(b1: BoundingBox, b2: BoundingBox): number {
    const xLeft = Math.max(b1.x, b2.x);
    const yTop = Math.max(b1.y, b2.y);
    const xRight = Math.min(b1.x + b1.width, b2.x + b2.width);
    const yBottom = Math.min(b1.y + b1.height, b2.y + b2.height);

    if (xRight < xLeft || yBottom < yTop) return 0.0;

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
    const b1Area = b1.width * b1.height;
    const b2Area = b2.width * b2.height;
    const unionArea = b1Area + b2Area - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
  }

  private purgeStaleTracks(now: number): void {
    const maxAgeMs = this.maxAgeSeconds * 1000;
    for (const [id, track] of this.activeTracks.entries()) {
      if (now - track.lastSeen > maxAgeMs) {
        this.activeTracks.delete(id);
      }
    }
  }

  public clear(): void {
    this.activeTracks.clear();
  }
}
