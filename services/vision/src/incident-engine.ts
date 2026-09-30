import {
  TrackedObject,
  Incident,
  IncidentType,
  IncidentSeverity,
  Zone,
  GeoPoint,
} from '@patrol/shared';
import { ZoneMatchResult } from './zone-matcher.js';

export interface IncidentRuleConfig {
  loiteringThresholdSeconds: number; // default 20s
  publicZoneAlerts: boolean; // default false (do not alert on public streets)
}

export const DEFAULT_INCIDENT_RULES: IncidentRuleConfig = {
  loiteringThresholdSeconds: 20,
  publicZoneAlerts: false,
};

export class IncidentEngine {
  private config: IncidentRuleConfig;
  private activeIncidents: Map<string, Incident> = new Map();
  private allIncidents: Incident[] = [];
  private nextIncidentNumber = 101;

  private incidentCreatedListeners: Set<(inc: Incident) => void> = new Set();
  private incidentUpdatedListeners: Set<(inc: Incident) => void> = new Set();

  constructor(config: Partial<IncidentRuleConfig> = {}) {
    this.config = { ...DEFAULT_INCIDENT_RULES, ...config };
  }

  public getIncidents(): Incident[] {
    return [...this.allIncidents];
  }

  public getIncidentById(id: string): Incident | undefined {
    return this.allIncidents.find((i) => i.id === id);
  }

  public acknowledgeIncident(id: string): boolean {
    const inc = this.allIncidents.find((i) => i.id === id);
    if (inc) {
      inc.acknowledged = true;
      return true;
    }
    return false;
  }

  public onIncidentCreated(listener: (inc: Incident) => void): () => void {
    this.incidentCreatedListeners.add(listener);
    return () => this.incidentCreatedListeners.delete(listener);
  }

  public onIncidentUpdated(listener: (inc: Incident) => void): () => void {
    this.incidentUpdatedListeners.add(listener);
    return () => this.incidentUpdatedListeners.delete(listener);
  }

  /**
   * Processes a tracked object and its zone match, evaluating deterministic incident criteria.
   */
  public evaluateTrack(
    track: TrackedObject,
    zoneResult: ZoneMatchResult,
    missionId?: string,
    currentTimestamp = Date.now()
  ): Incident | null {
    // If inside IGNORE_ZONE or (PUBLIC_ZONE and public alerts disabled), do not trigger incidents
    if (zoneResult.matchedZone?.type === 'IGNORE_ZONE') {
      return null;
    }
    if (zoneResult.matchedZone?.type === 'PUBLIC_ZONE' && !this.config.publicZoneAlerts) {
      return null;
    }

    const { type, severity, title, description } = this.classifyIncident(
      track,
      zoneResult
    );

    if (!type) {
      return null;
    }

    const incidentKey = `${track.id}-${type}`;
    const existing = this.activeIncidents.get(incidentKey);

    if (existing) {
      // Update existing incident
      existing.durationSeconds = Math.max(
        1,
        Math.round((currentTimestamp - existing.timestamp) / 1000)
      );
      existing.confidence = Math.max(existing.confidence, track.confidence);
      existing.location = { ...track.approximateLocation };

      // Update timeline if loitering or moving
      if (
        track.loiteringDurationSeconds >= this.config.loiteringThresholdSeconds &&
        !existing.timeline.some((t) => t.description.includes('Loitering threshold reached'))
      ) {
        existing.timeline.push({
          timestamp: currentTimestamp,
          description: `Loitering threshold reached (${track.loiteringDurationSeconds}s in zone).`,
          location: { ...track.approximateLocation },
        });
      }

      for (const listener of this.incidentUpdatedListeners) {
        listener(existing);
      }
      return existing;
    }

    // Create new incident
    const newIncident: Incident = {
      id: `inc-${this.nextIncidentNumber++}`,
      incidentNumber: this.nextIncidentNumber - 1,
      type,
      severity,
      title,
      description,
      timestamp: currentTimestamp,
      durationSeconds: Math.max(1, track.loiteringDurationSeconds),
      confidence: track.confidence,
      zoneId: zoneResult.matchedZone?.id,
      zoneName: zoneResult.matchedZone?.name ?? (zoneResult.inProperty ? 'Property Perimeter' : undefined),
      location: { ...track.approximateLocation },
      snapshotUrl: `/api/video/snapshot?target=${track.id}&t=${currentTimestamp}`,
      missionId,
      trackedObjectId: track.id,
      acknowledged: false,
      timeline: [
        {
          timestamp: track.firstSeen,
          description: `Target ${track.id} (${track.type}) detected.`,
          location: { ...track.approximateLocation },
        },
        {
          timestamp: currentTimestamp,
          description: `${title} - objective event triggered in ${zoneResult.matchedZone?.name ?? 'Property'}.`,
          location: { ...track.approximateLocation },
        },
      ],
    };

    this.activeIncidents.set(incidentKey, newIncident);
    this.allIncidents.unshift(newIncident);

    for (const listener of this.incidentCreatedListeners) {
      listener(newIncident);
    }

    return newIncident;
  }

  private classifyIncident(
    track: TrackedObject,
    zoneResult: ZoneMatchResult
  ): {
    type: IncidentType | null;
    severity: IncidentSeverity;
    title: string;
    description: string;
  } {
    const isPerson = track.type === 'person';
    const isVehicle =
      track.type === 'car' ||
      track.type === 'van' ||
      track.type === 'truck' ||
      track.type === 'motorcycle';

    const zone = zoneResult.matchedZone;

    // Rule 1: Person entered Restricted Zone
    if (isPerson && zone?.type === 'RESTRICTED_ZONE') {
      return {
        type: 'PersonEnteredRestrictedZone',
        severity: 'HIGH',
        title: `Person entered restricted zone (${zone.name})`,
        description: `Observable person detected within restricted zone boundary: "${zone.name}".`,
      };
    }

    // Rule 2: Person Loitering
    if (
      isPerson &&
      track.loiteringDurationSeconds >= this.config.loiteringThresholdSeconds
    ) {
      const isHigh = zone?.type === 'RESTRICTED_ZONE';
      return {
        type: 'PersonLoitering',
        severity: isHigh ? 'HIGH' : 'MEDIUM',
        title: `Person loitering in ${zone?.name ?? 'property area'}`,
        description: `Person observed stationary or pacing in ${zone?.name ?? 'property area'} for ${track.loiteringDurationSeconds} seconds.`,
      };
    }

    // Rule 3: Person entered Property
    if (isPerson && (zoneResult.inProperty || zone?.type === 'WATCH_ZONE')) {
      return {
        type: 'PersonEnteredProperty',
        severity: 'MEDIUM',
        title: `Person detected on property${zone ? ` (${zone.name})` : ''}`,
        description: `Person observed crossing onto monitored property${zone ? ` in zone ${zone.name}` : ''}.`,
      };
    }

    // Rule 4: Vehicle entered Property
    if (isVehicle && zoneResult.inProperty) {
      return {
        type: 'VehicleEnteredProperty',
        severity: 'LOW',
        title: `Vehicle detected on property${zone ? ` (${zone.name})` : ''}`,
        description: `Vehicle (${track.type}) observed on property boundary${zone ? ` near ${zone.name}` : ''}.`,
      };
    }

    // Rule 5: Generic detection outside property
    if (isPerson) {
      return {
        type: 'PersonDetected',
        severity: 'INFO',
        title: 'Person detected in surveillance view',
        description: 'Person observed in camera field of view outside monitored zones.',
      };
    }

    if (isVehicle) {
      return {
        type: 'VehicleDetected',
        severity: 'INFO',
        title: `${track.type.toUpperCase()} detected`,
        description: `${track.type} observed in camera field of view.`,
      };
    }

    return { type: null, severity: 'INFO', title: '', description: '' };
  }
}
