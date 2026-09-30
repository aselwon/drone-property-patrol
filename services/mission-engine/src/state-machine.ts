import { MissionStatus } from '@patrol/shared';

export type StateChangeListener = (
  from: MissionStatus,
  to: MissionStatus,
  reason?: string
) => void;

/**
 * Deterministic Mission State Machine.
 * Valid transitions are strictly defined and verified.
 */
export class MissionStateMachine {
  private currentStatus: MissionStatus = 'PENDING';
  private listeners: Set<StateChangeListener> = new Set();

  private static readonly VALID_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
    PENDING: ['PRE_FLIGHT_CHECK', 'ABORTED', 'FAILED'],
    PRE_FLIGHT_CHECK: ['READY', 'FAILED', 'ABORTED'],
    READY: ['TAKEOFF', 'ABORTED', 'FAILED'],
    TAKEOFF: ['FLYING', 'OBSERVING', 'RETURNING', 'ABORTED', 'FAILED'],
    FLYING: ['OBSERVING', 'FLYING', 'RETURNING', 'LANDING', 'ABORTED', 'FAILED'],
    OBSERVING: ['FLYING', 'OBSERVING', 'RETURNING', 'LANDING', 'ABORTED', 'FAILED'],
    RETURNING: ['LANDING', 'ABORTED', 'FAILED'],
    LANDING: ['COMPLETED', 'FAILED'],
    COMPLETED: ['PENDING'], // Can reset
    ABORTED: ['PENDING'],
    FAILED: ['PENDING'],
  };

  constructor(initialStatus: MissionStatus = 'PENDING') {
    this.currentStatus = initialStatus;
  }

  public getStatus(): MissionStatus {
    return this.currentStatus;
  }

  public canTransitionTo(target: MissionStatus): boolean {
    const allowed = MissionStateMachine.VALID_TRANSITIONS[this.currentStatus];
    return allowed ? allowed.includes(target) : false;
  }

  public transition(target: MissionStatus, reason?: string): boolean {
    if (!this.canTransitionTo(target)) {
      throw new Error(
        `Illegal mission state transition: Cannot transition from '${this.currentStatus}' to '${target}'.`
      );
    }

    const previous = this.currentStatus;
    this.currentStatus = target;

    for (const listener of this.listeners) {
      try {
        listener(previous, target, reason);
      } catch (err) {
        console.error('Error in state machine listener:', err);
      }
    }

    return true;
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public reset(): void {
    this.currentStatus = 'PENDING';
  }
}
