import {
  CameraFrame,
  VisionDetection,
  TrackedObject,
  Incident,
  PropertyConfiguration,
  AuditLog,
} from '@patrol/shared';
import { ModularObjectDetector, ObjectDetector } from './detector.js';
import { ObjectTracker } from './tracker.js';
import { ZoneMatcher } from './zone-matcher.js';
import { IncidentEngine } from './incident-engine.js';

export interface VisionEngineOptions {
  detector?: ObjectDetector;
  tracker?: ObjectTracker;
  incidentEngine?: IncidentEngine;
}

export class VisionEngine {
  private detector: ObjectDetector;
  private tracker: ObjectTracker;
  private zoneMatcher: ZoneMatcher;
  private incidentEngine: IncidentEngine;
  private currentMissionId?: string;
  private auditCallback?: (log: AuditLog) => void;

  private latestDetections: VisionDetection[] = [];
  private latestTracks: TrackedObject[] = [];

  constructor(
    property: PropertyConfiguration,
    options: VisionEngineOptions = {},
    auditCallback?: (log: AuditLog) => void
  ) {
    this.detector = options.detector ?? new ModularObjectDetector();
    this.tracker = options.tracker ?? new ObjectTracker();
    this.zoneMatcher = new ZoneMatcher(property);
    this.incidentEngine = options.incidentEngine ?? new IncidentEngine();
    this.auditCallback = auditCallback;
  }

  public updateProperty(property: PropertyConfiguration): void {
    this.zoneMatcher.updateProperty(property);
  }

  public setCurrentMissionId(missionId?: string): void {
    this.currentMissionId = missionId;
  }

  public getDetector(): ObjectDetector {
    return this.detector;
  }

  public getTracker(): ObjectTracker {
    return this.tracker;
  }

  public getIncidentEngine(): IncidentEngine {
    return this.incidentEngine;
  }

  public getLatestDetections(): VisionDetection[] {
    return [...this.latestDetections];
  }

  public getLatestTracks(): TrackedObject[] {
    return [...this.latestTracks];
  }

  /**
   * Main vision pipeline execution for an incoming camera frame:
   * Video Frame -> Frame Sampler -> Object Detector -> Tracker -> Zone Matcher -> Incident Engine
   * Note: The Vision Engine has ZERO flight control authority.
   */
  public async processFrame(frame: CameraFrame): Promise<{
    detections: VisionDetection[];
    tracks: TrackedObject[];
    incidents: Incident[];
  }> {
    // 1. Detect objects in frame
    const detections = await this.detector.detect(frame);
    this.latestDetections = detections;

    // 2. Track objects temporally
    const tracks = this.tracker.update(detections, frame.timestamp);
    this.latestTracks = tracks;

    // 3. Match against spatial zones & evaluate incident rules
    const newOrUpdatedIncidents: Incident[] = [];

    for (const track of tracks) {
      const zoneResult = this.zoneMatcher.matchLocation(track.approximateLocation);
      track.currentZoneId = zoneResult.matchedZone?.id;

      const incident = this.incidentEngine.evaluateTrack(
        track,
        zoneResult,
        this.currentMissionId,
        frame.timestamp
      );

      if (incident) {
        newOrUpdatedIncidents.push(incident);

        // Audit log on first creation of incident
        if (incident.timeline.length <= 2 && this.auditCallback) {
          this.auditCallback({
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            actor: 'VISION_ENGINE',
            event: 'INCIDENT_CREATED',
            missionId: this.currentMissionId,
            metadata: {
              incidentId: incident.id,
              type: incident.type,
              severity: incident.severity,
              zone: incident.zoneName,
            },
          });
        }
      }
    }

    return {
      detections,
      tracks,
      incidents: newOrUpdatedIncidents,
    };
  }

  /**
   * Video replay: feeds a series of simulated frames or video segments through the pipeline.
   */
  public async processReplayFrames(frames: CameraFrame[]): Promise<{
    totalFrames: number;
    detectionsCount: number;
    incidentsGenerated: Incident[];
  }> {
    const generatedIncidents: Map<string, Incident> = new Map();
    let totalDetections = 0;

    for (const frame of frames) {
      const result = await this.processFrame(frame);
      totalDetections += result.detections.length;
      for (const inc of result.incidents) {
        generatedIncidents.set(inc.id, inc);
      }
    }

    return {
      totalFrames: frames.length,
      detectionsCount: totalDetections,
      incidentsGenerated: Array.from(generatedIncidents.values()),
    };
  }
}
