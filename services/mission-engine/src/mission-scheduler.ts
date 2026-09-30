import {
  Mission,
  AlarmPayload,
  AlarmMapping,
  AuditLog,
} from '@patrol/shared';
import { MissionRunner } from './mission-runner.js';

export class MissionScheduler {
  private runner: MissionRunner;
  private missionTemplates: Map<string, Mission> = new Map();
  private alarmMappings: Map<string, AlarmMapping> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private auditCallback?: (log: AuditLog) => void;

  constructor(
    runner: MissionRunner,
    auditCallback?: (log: AuditLog) => void
  ) {
    this.runner = runner;
    this.auditCallback = auditCallback;
    this.setupDefaultAlarmMappings();
  }

  private setupDefaultAlarmMappings(): void {
    const defaults: AlarmMapping[] = [
      {
        id: 'map-front-gate',
        source: 'front_gate',
        missionName: 'Front Gate Inspection',
        targetZoneId: 'zone-front-gate',
        description: 'Auto-patrol front gate driveway and entryway upon motion trigger',
      },
      {
        id: 'map-garage',
        source: 'garage',
        missionName: 'Garage Inspection',
        targetZoneId: 'zone-garage',
        description: 'Auto-patrol garage perimeter and side door upon sensor trigger',
      },
      {
        id: 'map-backyard',
        source: 'backyard',
        missionName: 'Backyard Inspection',
        targetZoneId: 'zone-backyard',
        description: 'Auto-patrol backyard fence line and pool zone upon perimeter trigger',
      },
    ];

    for (const m of defaults) {
      this.alarmMappings.set(m.source, m);
    }
  }

  public registerMissionTemplate(mission: Mission): void {
    this.missionTemplates.set(mission.name, mission);

    // If scheduled or interval mission, set up recurring execution
    if (mission.schedule?.enabled && mission.schedule.intervalMinutes) {
      this.scheduleIntervalMission(mission);
    }
  }

  public getMissionTemplates(): Mission[] {
    return Array.from(this.missionTemplates.values());
  }

  public getAlarmMappings(): AlarmMapping[] {
    return Array.from(this.alarmMappings.values());
  }

  public setAlarmMapping(mapping: AlarmMapping): void {
    this.alarmMappings.set(mapping.source, mapping);
  }

  /**
   * Dispatches alarm payload from webhooks or external sensor systems.
   */
  public async handleAlarm(alarm: AlarmPayload): Promise<{
    handled: boolean;
    missionLaunched?: string;
    message: string;
  }> {
    if (this.auditCallback) {
      this.auditCallback({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        actor: 'ALARM_WEBHOOK',
        event: 'ALARM_RECEIVED',
        metadata: { ...alarm },
      });
    }

    const mapping = this.alarmMappings.get(alarm.source);
    if (!mapping) {
      return {
        handled: false,
        message: `No alarm mission mapping registered for source '${alarm.source}'.`,
      };
    }

    // Look for matching mission template
    const template = this.missionTemplates.get(mapping.missionName);
    if (!template) {
      return {
        handled: false,
        message: `Alarm mapped to mission '${mapping.missionName}', but template does not exist.`,
      };
    }

    // Clone mission for execution
    const alarmMission: Mission = {
      ...template,
      id: `mission-alarm-${Date.now()}`,
      name: `${mapping.missionName} (Alarm: ${alarm.event})`,
      triggerSource: 'ALARM',
      alarmSource: alarm.source,
      createdAt: Date.now(),
    };

    // Execute in background
    this.runner.executeMission(alarmMission).catch((err) => {
      console.error(`Error executing alarm mission ${alarmMission.name}:`, err);
    });

    return {
      handled: true,
      missionLaunched: alarmMission.id,
      message: `Launched mission '${alarmMission.name}' in response to ${alarm.source}:${alarm.event}.`,
    };
  }

  private scheduleIntervalMission(template: Mission): void {
    const existing = this.intervalTimers.get(template.name);
    if (existing) clearInterval(existing);

    const intervalMs = (template.schedule?.intervalMinutes ?? 60) * 60 * 1000;
    const timer = setInterval(() => {
      const mission: Mission = {
        ...template,
        id: `mission-scheduled-${Date.now()}`,
        triggerSource: 'SCHEDULED',
        createdAt: Date.now(),
      };
      this.runner.executeMission(mission).catch((err) => {
        console.error(`Scheduled patrol error for ${template.name}:`, err);
      });
    }, intervalMs);

    this.intervalTimers.set(template.name, timer);
  }

  public stopAllSchedules(): void {
    for (const timer of this.intervalTimers.values()) {
      clearInterval(timer);
    }
    this.intervalTimers.clear();
  }
}
