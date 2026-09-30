import { Mission, Waypoint, AuditLog, AuditEventType } from '@patrol/shared';
import { SafetyLayer } from '@patrol/safety';
import { MissionStateMachine } from './state-machine.js';

export interface MissionRunnerEvents {
  onStatusChange?: (mission: Mission) => void;
  onWaypointReached?: (mission: Mission, waypoint: Waypoint) => void;
  onMissionCompleted?: (mission: Mission) => void;
  onMissionFailed?: (mission: Mission, reason: string) => void;
}

export class MissionRunner {
  private safetyLayer: SafetyLayer;
  private stateMachine: MissionStateMachine;
  private activeMission: Mission | null = null;
  private isPaused = false;
  private isAborted = false;
  private events: MissionRunnerEvents;
  private auditCallback?: (log: AuditLog) => void;

  constructor(
    safetyLayer: SafetyLayer,
    events: MissionRunnerEvents = {},
    auditCallback?: (log: AuditLog) => void
  ) {
    this.safetyLayer = safetyLayer;
    this.events = events;
    this.auditCallback = auditCallback;
    this.stateMachine = new MissionStateMachine('PENDING');

    this.stateMachine.onStateChange((from, to, reason) => {
      if (this.activeMission) {
        this.activeMission.status = to;
        if (to === 'FAILED' && reason) {
          this.activeMission.failureReason = reason;
        }
        this.events.onStatusChange?.(this.activeMission);
      }
    });
  }

  public getActiveMission(): Mission | null {
    return this.activeMission ? { ...this.activeMission } : null;
  }

  public getStateMachine(): MissionStateMachine {
    return this.stateMachine;
  }

  private logAudit(
    event: AuditEventType,
    missionId?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.auditCallback) return;
    this.auditCallback({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      actor: 'SYSTEM',
      event,
      missionId,
      metadata,
    });
  }

  /**
   * Starts executing a mission through the deterministic state machine.
   */
  public async executeMission(mission: Mission): Promise<boolean> {
    if (this.activeMission && this.activeMission.status !== 'COMPLETED' && this.activeMission.status !== 'ABORTED' && this.activeMission.status !== 'FAILED') {
      throw new Error(`Another mission (${this.activeMission.name}) is currently active.`);
    }

    this.activeMission = {
      ...mission,
      status: 'PENDING',
      currentWaypointIndex: 0,
      totalWaypoints: mission.waypoints.length,
      startedAt: Date.now(),
    };
    this.isPaused = false;
    this.isAborted = false;
    this.stateMachine.reset();

    this.logAudit('MISSION_STARTED', mission.id, {
      name: mission.name,
      triggerSource: mission.triggerSource,
      waypointsCount: mission.waypoints.length,
    });

    try {
      // Step 1: Pre-flight check
      this.stateMachine.transition('PRE_FLIGHT_CHECK');
      const preflightResult = await this.safetyLayer.runPreFlightCheck(mission);

      if (!preflightResult.passed) {
        const failureReason = preflightResult.reason ?? 'Pre-flight check failed.';
        this.stateMachine.transition('FAILED', failureReason);
        this.events.onMissionFailed?.(this.activeMission, failureReason);
        return false;
      }

      this.stateMachine.transition('READY');

      // Step 2: Takeoff
      this.stateMachine.transition('TAKEOFF');
      const initialAlt = mission.waypoints[0]?.altitude ?? 12;
      const takeoffOk = await this.safetyLayer.executeValidatedTakeoff(
        initialAlt,
        mission.id
      );

      if (!takeoffOk) {
        this.stateMachine.transition('FAILED', 'Takeoff failed');
        this.events.onMissionFailed?.(this.activeMission, 'Takeoff failed');
        return false;
      }

      // Step 3: Fly waypoints
      this.stateMachine.transition('FLYING');

      for (let i = 0; i < mission.waypoints.length; i++) {
        if (this.isAborted) break;

        // Handle pause
        while (this.isPaused && !this.isAborted) {
          await new Promise((res) => setTimeout(res, 200));
        }
        if (this.isAborted) break;

        const wp = mission.waypoints[i];
        this.activeMission.currentWaypointIndex = i;
        this.events.onStatusChange?.(this.activeMission);

        // Move to waypoint via Safety Layer
        await this.safetyLayer.executeValidatedMovement(
          wp.location,
          wp.speed ?? 5,
          mission.id
        );

        this.logAudit('WAYPOINT_REACHED', mission.id, {
          waypointIndex: i,
          location: wp.location,
          action: wp.action,
        });
        this.events.onWaypointReached?.(this.activeMission, wp);

        // Check if observation or photo action
        const durationSec = wp.observationDurationSeconds ?? (wp.action === 'HOVER_OBSERVE' ? 5 : 0);
        if (durationSec > 0 || wp.action === 'CAPTURE_PHOTO') {
          this.stateMachine.transition('OBSERVING');

          if (wp.action === 'CAPTURE_PHOTO') {
            await this.safetyLayer.getDroneAdapter().capturePhoto();
          }

          if (durationSec > 0) {
            // Wait for observation duration
            // Adjust for simulation speed if available
            const drone = this.safetyLayer.getDroneAdapter();
            const simSpeed = ('getSimulationSpeed' in drone && typeof drone.getSimulationSpeed === 'function')
              ? drone.getSimulationSpeed()
              : 1;
            const actualSleepMs = Math.max(100, (durationSec * 1000) / simSpeed);
            await new Promise((res) => setTimeout(res, actualSleepMs));
          }

          // Return to FLYING if more waypoints remain
          if (i < mission.waypoints.length - 1 && !this.isAborted) {
            this.stateMachine.transition('FLYING');
          }
        }
      }

      if (this.isAborted) {
        return false;
      }

      // Step 4: Returning Home
      this.stateMachine.transition('RETURNING');
      this.logAudit('RTH_REQUESTED', mission.id);
      await this.safetyLayer.executeEmergencyRth(mission.id);

      // Wait until drone lands
      await this.pollUntilLanded();

      // Step 5: Complete
      this.stateMachine.transition('COMPLETED');
      this.activeMission.completedAt = Date.now();
      this.activeMission.durationSeconds = Math.round(
        (this.activeMission.completedAt - (this.activeMission.startedAt ?? Date.now())) / 1000
      );

      this.logAudit('MISSION_COMPLETED', mission.id, {
        durationSeconds: this.activeMission.durationSeconds,
      });
      this.events.onMissionCompleted?.(this.activeMission);

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (this.stateMachine.canTransitionTo('FAILED')) {
        this.stateMachine.transition('FAILED', errorMessage);
      }
      if (this.activeMission) {
        this.activeMission.failureReason = errorMessage;
        this.events.onMissionFailed?.(this.activeMission, errorMessage);
      }
      return false;
    }
  }

  public async pause(): Promise<boolean> {
    if (!this.activeMission || this.isPaused) return false;
    this.isPaused = true;
    return this.safetyLayer.pause(this.activeMission.id);
  }

  public async resume(): Promise<boolean> {
    if (!this.activeMission || !this.isPaused) return false;
    this.isPaused = false;
    return this.safetyLayer.resume(this.activeMission.id);
  }

  public async abort(): Promise<boolean> {
    if (!this.activeMission) return false;
    this.isAborted = true;
    this.isPaused = false;
    if (this.stateMachine.canTransitionTo('ABORTED')) {
      this.stateMachine.transition('ABORTED', 'Manual operator abort');
    }
    return this.safetyLayer.abort(this.activeMission.id);
  }

  private async pollUntilLanded(): Promise<void> {
    const drone = this.safetyLayer.getDroneAdapter();
    while (true) {
      const tel = drone.getTelemetry();
      if (!tel.inAir && tel.flightMode === 'STANDBY') {
        break;
      }
      if (tel.flightMode === 'LANDING' && this.stateMachine.canTransitionTo('LANDING')) {
        this.stateMachine.transition('LANDING');
      }
      await new Promise((res) => setTimeout(res, 200));
    }
  }
}
