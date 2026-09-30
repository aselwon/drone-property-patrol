import React, { useState } from 'react';
import {
  Compass,
  Gauge,
  Shield,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Radio,
  Eye,
  Bell,
  Crosshair,
} from 'lucide-react';
import {
  DroneTelemetry,
  Mission,
  Incident,
  PropertyConfiguration,
} from '@patrol/shared';

interface DashboardViewProps {
  telemetry: DroneTelemetry | null;
  activeMission: Mission | null;
  missions: Mission[];
  incidents: Incident[];
  property: PropertyConfiguration;
  onStartMission: (missionId: string) => void;
  onTriggerAlarm: (source: string, event: string) => void;
  onAcknowledgeIncident: (incidentId: string) => void;
  onSelectTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  activeMission,
  missions,
  incidents,
  property,
  onStartMission,
  onTriggerAlarm,
  onAcknowledgeIncident,
  onSelectTab,
}) => {
  const [alarmTriggering, setAlarmTriggering] = useState<string | null>(null);

  const handleAlarmClick = async (source: string, event: string) => {
    setAlarmTriggering(source);
    await onTriggerAlarm(source, event);
    setTimeout(() => setAlarmTriggering(null), 1000);
  };

  const highIncidents = incidents.filter((i) => i.severity === 'HIGH' && !i.acknowledged);

  return (
    <div className="space-y-6">
      {/* Top Banner: High Severity Alerts if any */}
      {highIncidents.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-500/20 text-red-400 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-red-400 font-mono text-sm">
                CRITICAL SECURITY ALERT ({highIncidents.length} UNRESOLVED)
              </h4>
              <p className="text-xs text-slate-300">
                {highIncidents[0].title}: {highIncidents[0].description}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('incidents')}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold font-mono transition flex items-center gap-1"
          >
            Review Incidents <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Grid of Key Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Altitude & Speed */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Flight Dynamics</span>
            <Gauge className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {telemetry ? (telemetry.location.altitude ?? 0).toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-400 ml-1">m AGL</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Current Altitude</div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="text-2xl font-bold font-mono text-sky-400">
                {telemetry ? telemetry.speed.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-400 ml-1">m/s</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Ground Speed</div>
            </div>
          </div>
        </div>

        {/* Card 2: Battery & Power */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Power Subsystem</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {telemetry?.batteryPercent ?? '--'}%
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {telemetry?.batteryVoltage ?? '--'}V LiPo (3S)
              </div>
            </div>
            <div className="w-20 bg-slate-800 h-2.5 rounded-full overflow-hidden self-center border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  (telemetry?.batteryPercent ?? 100) > 30 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${telemetry?.batteryPercent ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Geofence & Home Distance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Geofence Status</span>
            <Shield className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>ENFORCED</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1">
            Dist from Home: <strong className="text-slate-200">{telemetry?.distanceToHomeMeters ?? 0}m</strong> (Max 250m)
          </div>
        </div>

        {/* Card 4: Navigation & Heading */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Compass & GNSS</span>
            <Compass className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {telemetry?.heading ?? 0}°
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Compass Heading</div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="text-2xl font-bold font-mono text-indigo-400">
                {telemetry?.gpsSatellites ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">GPS Satellites</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Row: Active Mission Status & Alarm Trigger Launchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Mission Monitor */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-base font-mono flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-sky-400" />
                ACTIVE PATROL MISSION
              </h3>
              <p className="text-xs text-slate-400">Deterministic state machine execution</p>
            </div>
            {activeMission && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {activeMission.status}
              </span>
            )}
          </div>

          {activeMission && activeMission.status !== 'COMPLETED' && activeMission.status !== 'ABORTED' && activeMission.status !== 'FAILED' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-100">{activeMission.name}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Trigger: <span className="text-sky-400 font-semibold">{activeMission.triggerSource}</span> | Waypoint {activeMission.currentWaypointIndex + 1} of {activeMission.totalWaypoints}
                  </div>
                </div>
                <button
                  onClick={() => onSelectTab('live')}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold font-mono transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Live Mission HUD
                </button>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Flight Trajectory Progress</span>
                  <span>
                    {Math.round(
                      ((activeMission.currentWaypointIndex + 1) /
                        Math.max(1, activeMission.totalWaypoints)) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        ((activeMission.currentWaypointIndex + 1) /
                          Math.max(1, activeMission.totalWaypoints)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Current Action</span>
                  <span className="font-semibold text-slate-200">
                    {activeMission.waypoints[activeMission.currentWaypointIndex]?.action ?? 'TRANSIT'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Target Altitude</span>
                  <span className="font-semibold text-slate-200">
                    {activeMission.waypoints[activeMission.currentWaypointIndex]?.altitude ?? 12}m AGL
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Safety Checks</span>
                  <span className="font-semibold text-emerald-400">PASSED</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-300">No Mission In Flight</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The drone is standing by on the home launch pad. Trigger a scheduled patrol, launch a mission manually, or simulate an alarm webhook.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onStartMission(missions[0]?.id || '')}
                  className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-mono transition shadow-lg shadow-sky-600/20 inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" /> Launch Perimeter Patrol
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Webhook Alarms Triggering Launchpad */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="font-bold text-white text-base font-mono flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              ALARM WEBHOOKS
            </h3>
            <p className="text-xs text-slate-400">Simulate external perimeter sensor alerts</p>
          </div>

          <div className="space-y-3">
            {/* Alarm 1: Front Gate */}
            <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Front Gate Motion</div>
                <div className="text-[11px] text-slate-400 font-mono">source: "front_gate"</div>
              </div>
              <button
                disabled={alarmTriggering === 'front_gate'}
                onClick={() => handleAlarmClick('front_gate', 'motion')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-mono font-semibold transition"
              >
                {alarmTriggering === 'front_gate' ? 'Dispatching...' : 'Trigger Webhook'}
              </button>
            </div>

            {/* Alarm 2: Garage Door */}
            <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Garage Side Door</div>
                <div className="text-[11px] text-slate-400 font-mono">source: "garage"</div>
              </div>
              <button
                disabled={alarmTriggering === 'garage'}
                onClick={() => handleAlarmClick('garage', 'door_open')}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 text-xs font-mono font-semibold transition"
              >
                {alarmTriggering === 'garage' ? 'Dispatching...' : 'Trigger Webhook'}
              </button>
            </div>

            {/* Alarm 3: Backyard Fence */}
            <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Backyard Beam Trip</div>
                <div className="text-[11px] text-slate-400 font-mono">source: "backyard"</div>
              </div>
              <button
                disabled={alarmTriggering === 'backyard'}
                onClick={() => handleAlarmClick('backyard', 'breakbeam')}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-mono font-semibold transition"
              >
                {alarmTriggering === 'backyard' ? 'Dispatching...' : 'Trigger Webhook'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Incidents Feed */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-white text-base font-mono flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-400" />
              RECENT ZONE INCIDENTS
            </h3>
            <p className="text-xs text-slate-400">Objective detections evaluated across property zones</p>
          </div>
          <button
            onClick={() => onSelectTab('incidents')}
            className="text-xs text-sky-400 hover:text-sky-300 font-mono font-semibold"
          >
            View All ({incidents.length}) →
          </button>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">
            No incidents logged yet. The property is currently secure.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {incidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      inc.severity === 'HIGH'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : inc.severity === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {inc.severity}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{inc.title}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      Zone: {inc.zoneName ?? 'Property'} | Duration: {inc.durationSeconds}s | Confidence: {Math.round(inc.confidence * 100)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(inc.timestamp).toLocaleTimeString()}
                  </span>
                  {!inc.acknowledged && (
                    <button
                      onClick={() => onAcknowledgeIncident(inc.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
