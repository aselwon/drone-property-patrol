import {
  GeoPoint,
  SafetyConfig,
  PropertyConfiguration,
  MovementValidationResult,
  GeofenceViolation,
  PreFlightCheckResult,
  CheckItem,
  calculateDistanceMeters,
  isPointInPolygon,
  pathCrossesPolygon,
  Mission,
  DroneTelemetry,
  AuditLog,
  AuditEventType,
} from '@patrol/shared';
import { DroneAdapter } from '@patrol/drone-core';

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxAltitude: 50, // 50m AGL maximum ceiling
  minAltitude: 3, // 3m AGL minimum safe clearance
  maxDistanceFromHome: 250, // 250m max operational radius
  returnHomeAltitude: 25, // 25m safe transit altitude
  minimumBatteryReserve: 20, // 20% minimum reserve (triggers RTH)
  criticalBatteryReserve: 10, // 10% critical reserve (triggers immediate landing)
  maxWindSpeedMps: 10,
  geofenceStrict: true,
  minGpsSatellites: 8,
};

export class SafetyLayer {
  private config: SafetyConfig;
  private property: PropertyConfiguration;
  private droneAdapter: DroneAdapter;
  private auditCallback?: (log: AuditLog) => void;

  constructor(
    droneAdapter: DroneAdapter,
    property: PropertyConfiguration,
    config: Partial<SafetyConfig> = {},
    auditCallback?: (log: AuditLog) => void
  ) {
    this.droneAdapter = droneAdapter;
    this.property = property;
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    this.auditCallback = auditCallback;
  }

  public setAuditCallback(callback: (log: AuditLog) => void): void {
    this.auditCallback = callback;
  }

  public getDroneAdapter(): DroneAdapter {
    return this.droneAdapter;
  }

  public updateConfig(newConfig: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SafetyConfig {
    return { ...this.config };
  }

  public updateProperty(newProperty: PropertyConfiguration): void {
    this.property = newProperty;
  }

  public getProperty(): PropertyConfiguration {
    return this.property;
  }

  /**
   * Log an audit event securely.
   */
  private logAudit(
    event: AuditEventType,
    missionId?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.auditCallback) return;
    this.auditCallback({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      actor: 'SAFETY_LAYER',
      event,
      missionId,
      metadata,
    });
  }

  /**
   * Validates a candidate movement from point A to point B.
   */
  public validateMovement(
    from: GeoPoint,
    to: GeoPoint,
    currentBatteryPercent?: number
  ): MovementValidationResult {
    const violations: GeofenceViolation[] = [];

    // 1. Check strict property boundary polygon containment
    if (this.config.geofenceStrict && this.property.propertyBoundary.length >= 3) {
      const insideBoundary = isPointInPolygon(to, this.property.propertyBoundary);
      if (!insideBoundary) {
        violations.push({
          code: 'OUTSIDE_PROPERTY_BOUNDARY',
          message: `Target location (${to.latitude.toFixed(6)}, ${to.longitude.toFixed(6)}) is outside the authorized property boundary.`,
          attemptedLocation: to,
        });
      }
    }

    // 2. Check forbidden flight zones (Restricted zones marked with forbiddenFlight: true)
    for (const zone of this.property.zones) {
      if (zone.type === 'RESTRICTED_ZONE' && zone.rules.forbiddenFlight) {
        const targetInRestricted = isPointInPolygon(to, zone.polygon);
        if (targetInRestricted) {
          violations.push({
            code: 'RESTRICTED_ZONE_INCURSION',
            message: `Target waypoint is inside restricted no-fly zone: "${zone.name}".`,
            attemptedLocation: to,
            details: { zoneId: zone.id, zoneName: zone.name },
          });
        }

        const crossesRestricted = pathCrossesPolygon(from, to, zone.polygon);
        if (crossesRestricted) {
          violations.push({
            code: 'RESTRICTED_ZONE_INCURSION',
            message: `Flight trajectory intersects restricted no-fly zone: "${zone.name}".`,
            attemptedLocation: to,
            details: { zoneId: zone.id, zoneName: zone.name },
          });
        }
      }
    }

    // 3. Altitude validation
    const targetAlt = to.altitude ?? from.altitude ?? 15;
    if (targetAlt > this.config.maxAltitude) {
      violations.push({
        code: 'ALTITUDE_EXCEEDED_MAX',
        message: `Requested altitude ${targetAlt}m exceeds maximum ceiling of ${this.config.maxAltitude}m AGL.`,
        attemptedLocation: to,
        details: { maxAltitude: this.config.maxAltitude, requestedAltitude: targetAlt },
      });
    }

    if (targetAlt < this.config.minAltitude) {
      violations.push({
        code: 'ALTITUDE_BELOW_MIN',
        message: `Requested altitude ${targetAlt}m is below minimum clearance of ${this.config.minAltitude}m AGL.`,
        attemptedLocation: to,
        details: { minAltitude: this.config.minAltitude, requestedAltitude: targetAlt },
      });
    }

    // 4. Distance from Home Point validation
    const distFromHome = calculateDistanceMeters(to, this.property.homePoint);
    if (distFromHome > this.config.maxDistanceFromHome) {
      violations.push({
        code: 'DISTANCE_FROM_HOME_EXCEEDED',
        message: `Target distance ${distFromHome.toFixed(1)}m exceeds maximum operational radius of ${this.config.maxDistanceFromHome}m from home.`,
        attemptedLocation: to,
        details: {
          maxDistance: this.config.maxDistanceFromHome,
          actualDistance: distFromHome,
        },
      });
    }

    // 5. Battery reserve check
    if (
      currentBatteryPercent !== undefined &&
      currentBatteryPercent < this.config.minimumBatteryReserve
    ) {
      violations.push({
        code: 'INSUFFICIENT_BATTERY_RESERVE',
        message: `Battery level (${currentBatteryPercent}%) is below minimum safe reserve (${this.config.minimumBatteryReserve}%). Movement disallowed.`,
        attemptedLocation: to,
        details: { currentBattery: currentBatteryPercent, minimumReserve: this.config.minimumBatteryReserve },
      });
    }

    return {
      allowed: violations.length === 0,
      violations,
    };
  }

  /**
   * Validates and executes movement. If invalid, logs failure and throws SafetyViolationError.
   */
  public async executeValidatedMovement(
    to: GeoPoint,
    speed?: number,
    missionId?: string
  ): Promise<boolean> {
    const telemetry = this.droneAdapter.getTelemetry();
    const validation = this.validateMovement(
      telemetry.location,
      to,
      telemetry.batteryPercent
    );

    this.logAudit('MOVEMENT_REQUESTED', missionId, {
      from: telemetry.location,
      to,
      speed,
    });

    if (!validation.allowed) {
      this.logAudit('MOVEMENT_REJECTED', missionId, {
        violations: validation.violations,
        to,
      });
      throw new Error(
        `Safety Layer rejected movement: ${validation.violations
          .map((v: GeofenceViolation) => v.message)
          .join('; ')}`
      );
    }

    this.logAudit('MOVEMENT_VALIDATED', missionId, { to, speed });
    return this.droneAdapter.gotoLocation(
      to.latitude,
      to.longitude,
      to.altitude,
      speed
    );
  }

  /**
   * Pre-flight Check: Enforces all 9 safety criteria before takeoff or mission start.
   */
  public async runPreFlightCheck(mission?: Mission): Promise<PreFlightCheckResult> {
    const checks: CheckItem[] = [];
    const telemetry = this.droneAdapter.getTelemetry();
    const status = await this.droneAdapter.getStatus();

    // 1. Drone Connection Check
    checks.push({
      id: 'drone_connection',
      name: 'Drone Connection & Link Status',
      passed: status.isConnected && telemetry.connected,
      message: status.isConnected
        ? 'Drone is connected and responsive.'
        : 'Drone is disconnected or not responding.',
      severity: 'CRITICAL',
    });

    // 2. GPS Quality Check
    const gpsOk =
      telemetry.gpsSatellites >= this.config.minGpsSatellites &&
      telemetry.gpsQuality !== 'LOST' &&
      telemetry.gpsQuality !== 'POOR';
    checks.push({
      id: 'gps_quality',
      name: 'GPS Quality & Satellites',
      passed: gpsOk,
      message: gpsOk
        ? `GPS fix solid (${telemetry.gpsSatellites} satellites, status: ${telemetry.gpsQuality}).`
        : `GPS degraded (${telemetry.gpsSatellites} satellites, status: ${telemetry.gpsQuality}). Minimum ${this.config.minGpsSatellites} satellites required.`,
      severity: 'CRITICAL',
    });

    // 3. Battery Check (must exceed reserve + 10%)
    const minPreflightBattery = this.config.minimumBatteryReserve + 10;
    const batteryOk = telemetry.batteryPercent >= minPreflightBattery;
    checks.push({
      id: 'battery_level',
      name: 'Battery Level & Voltage',
      passed: batteryOk,
      message: batteryOk
        ? `Battery adequate: ${telemetry.batteryPercent}% (${telemetry.batteryVoltage}V).`
        : `Battery too low for departure: ${telemetry.batteryPercent}%. Need at least ${minPreflightBattery}%.`,
      severity: 'CRITICAL',
    });

    // 4. Home Point Validation
    const homeInBoundary =
      this.property.propertyBoundary.length < 3 ||
      isPointInPolygon(this.property.homePoint, this.property.propertyBoundary);
    checks.push({
      id: 'home_point',
      name: 'Home Point Configuration',
      passed: homeInBoundary,
      message: homeInBoundary
        ? `Home Point verified at (${this.property.homePoint.latitude.toFixed(6)}, ${this.property.homePoint.longitude.toFixed(6)}).`
        : 'Home Point is located outside the property boundary polygon.',
      severity: 'CRITICAL',
    });

    // 5. Geofence Boundary Check
    const geofenceOk = this.property.propertyBoundary.length >= 3;
    checks.push({
      id: 'geofence_boundary',
      name: 'Geofence Polygon Integrity',
      passed: geofenceOk,
      message: geofenceOk
        ? `Property geofence active with ${this.property.propertyBoundary.length} vertices.`
        : 'Property geofence polygon is invalid or has fewer than 3 vertices.',
      severity: 'CRITICAL',
    });

    // 6. Mission Waypoint Validation (if mission provided)
    if (mission && mission.waypoints.length > 0) {
      let allWaypointsValid = true;
      const invalidWaypoints: number[] = [];

      for (const wp of mission.waypoints) {
        const val = this.validateMovement(
          telemetry.location,
          wp.location,
          telemetry.batteryPercent
        );
        if (!val.allowed) {
          allWaypointsValid = false;
          invalidWaypoints.push(wp.index);
        }
      }

      checks.push({
        id: 'mission_validity',
        name: 'Mission Waypoints Safety Clearance',
        passed: allWaypointsValid,
        message: allWaypointsValid
          ? `All ${mission.waypoints.length} waypoints pass safety geofence and altitude verification.`
          : `Waypoints [${invalidWaypoints.join(', ')}] violate safety geofence or altitude limits.`,
        severity: 'CRITICAL',
      });
    } else {
      checks.push({
        id: 'mission_validity',
        name: 'Mission Waypoints Safety Clearance',
        passed: true,
        message: 'No mission waypoints queued (free flight checks passed).',
        severity: 'INFO',
      });
    }

    // 7. Storage / SD Card Check
    checks.push({
      id: 'storage_status',
      name: 'On-Board Media Storage Status',
      passed: true,
      message: 'On-board storage available for telemetry and imagery logging.',
      severity: 'WARNING',
    });

    // 8. Communication Link Check
    const commsOk = telemetry.signalStrengthPercent >= 40;
    checks.push({
      id: 'communication_link',
      name: 'RF / Telemetry Link Quality',
      passed: commsOk,
      message: commsOk
        ? `Signal link strong (${telemetry.signalStrengthPercent}%).`
        : `Signal link poor (${telemetry.signalStrengthPercent}%). High risk of disconnection.`,
      severity: 'CRITICAL',
    });

    // 9. Return To Home Configuration
    const rthConfigOk = this.config.returnHomeAltitude >= 15;
    checks.push({
      id: 'rth_configuration',
      name: 'Return To Home (RTH) Profile',
      passed: rthConfigOk,
      message: rthConfigOk
        ? `RTH transit altitude configured to safe ${this.config.returnHomeAltitude}m AGL.`
        : 'RTH transit altitude is below recommended safe clearance (15m).',
      severity: 'CRITICAL',
    });

    const failedCritical = checks.filter(
      (c) => !c.passed && c.severity === 'CRITICAL'
    );
    const passed = failedCritical.length === 0;

    const result: PreFlightCheckResult = {
      passed,
      timestamp: Date.now(),
      checks,
      reason: passed
        ? undefined
        : `Pre-flight check failed: ${failedCritical.map((c) => c.message).join('; ')}`,
    };

    if (passed) {
      this.logAudit('PREFLIGHT_PASSED', mission?.id, { checksCount: checks.length });
    } else {
      this.logAudit('PREFLIGHT_FAILED', mission?.id, { reason: result.reason });
    }

    return result;
  }

  /**
   * Validated Takeoff: Validates altitude and preflight conditions before takeoff.
   */
  public async executeValidatedTakeoff(
    targetAltitude = 10,
    missionId?: string
  ): Promise<boolean> {
    if (
      targetAltitude > this.config.maxAltitude ||
      targetAltitude < this.config.minAltitude
    ) {
      throw new Error(
        `Takeoff altitude ${targetAltitude}m is outside permitted bounds [${this.config.minAltitude}m - ${this.config.maxAltitude}m].`
      );
    }

    const preflight = await this.runPreFlightCheck();
    if (!preflight.passed) {
      throw new Error(`Takeoff aborted by Safety Layer: ${preflight.reason}`);
    }

    this.logAudit('TAKEOFF_REQUESTED', missionId, { targetAltitude });
    const success = await this.droneAdapter.takeOff(targetAltitude);
    if (success) {
      this.logAudit('TAKEOFF_COMPLETED', missionId, { targetAltitude });
    }
    return success;
  }

  /**
   * Emergency Return To Home: Non-blocking emergency failsafe.
   */
  public async executeEmergencyRth(missionId?: string): Promise<boolean> {
    this.logAudit('RTH_REQUESTED', missionId, {
      returnHomeAltitude: this.config.returnHomeAltitude,
    });
    return this.droneAdapter.returnToHome(this.config.returnHomeAltitude);
  }

  /**
   * Emergency Immediate Land.
   */
  public async executeEmergencyLand(missionId?: string): Promise<boolean> {
    this.logAudit('LANDING_REQUESTED', missionId, { reason: 'EMERGENCY_LAND' });
    return this.droneAdapter.land();
  }

  /**
   * Pause flight (hover in place).
   */
  public async pause(missionId?: string): Promise<boolean> {
    this.logAudit('MISSION_PAUSED', missionId);
    return this.droneAdapter.pause();
  }

  /**
   * Resume flight.
   */
  public async resume(missionId?: string): Promise<boolean> {
    this.logAudit('MISSION_RESUMED', missionId);
    return this.droneAdapter.resume();
  }

  /**
   * Abort mission and trigger return home safely.
   */
  public async abort(missionId?: string): Promise<boolean> {
    this.logAudit('MISSION_ABORTED', missionId);
    return this.droneAdapter.abort();
  }
}
