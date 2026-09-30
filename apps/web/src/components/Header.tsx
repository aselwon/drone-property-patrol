import React, { useState } from 'react';
import {
  ShieldAlert,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Radio,
  Navigation,
  Pause,
  Play,
  Home,
  AlertOctagon,
  Gauge,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DroneTelemetry, FlightMode } from '@patrol/shared';

interface HeaderProps {
  telemetry: DroneTelemetry | null;
  connected: boolean;
  onEmergencyRth: () => void;
  onEmergencyPause: () => void;
  onEmergencyAbort: () => void;
  onSimulationSpeedChange: (speed: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  connected,
  onEmergencyRth,
  onEmergencyPause,
  onEmergencyAbort,
  onSimulationSpeedChange,
}) => {
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [simSpeed, setSimSpeed] = useState(5);

  const handleSpeedSelect = (s: number) => {
    setSimSpeed(s);
    onSimulationSpeedChange(s);
  };

  const getBatteryIcon = () => {
    if (!telemetry) return <Battery className="w-5 h-5 text-slate-500" />;
    if (telemetry.batteryPercent <= 15)
      return <BatteryWarning className="w-5 h-5 text-red-500 animate-pulse" />;
    if (telemetry.batteryPercent <= 30)
      return <Battery className="w-5 h-5 text-amber-400" />;
    return <Battery className="w-5 h-5 text-emerald-400" />;
  };

  const getModeColor = (mode?: FlightMode) => {
    switch (mode) {
      case 'AUTO_FLIGHT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'OBSERVING':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'RETURNING_HOME':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'LANDING':
      case 'TAKING_OFF':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'HOVERING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'EMERGENCY_LANDING':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white font-mono text-base">
                DRONE PROPERTY PATROL
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                PRO MVP
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Autonomous Perimeter Defense</p>
          </div>
        </div>

        {/* Telemetry quick gauges */}
        <div className="hidden lg:flex items-center gap-6 font-mono text-xs">
          {/* Link Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            {connected && telemetry?.connected ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-semibold">LINK 98%</span>
              </>
            ) : (
              <>
                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                <span className="text-red-400 font-semibold">DISCONNECTED</span>
              </>
            )}
          </div>

          {/* Flight Mode */}
          <div
            className={`px-3 py-1.5 rounded-lg border font-semibold ${getModeColor(
              telemetry?.flightMode
            )}`}
          >
            {telemetry?.flightMode ?? 'STANDBY'}
          </div>

          {/* Battery */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            {getBatteryIcon()}
            <span
              className={`font-semibold ${
                (telemetry?.batteryPercent ?? 100) <= 20
                  ? 'text-red-400'
                  : 'text-slate-200'
              }`}
            >
              {telemetry ? `${telemetry.batteryPercent}% (${telemetry.batteryVoltage}V)` : '--'}
            </span>
          </div>

          {/* GPS */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <Radio className="w-4 h-4 text-sky-400" />
            <span className="text-slate-300">
              SAT: <strong className="text-white">{telemetry?.gpsSatellites ?? 0}</strong> ({telemetry?.gpsQuality ?? 'N/A'})
            </span>
          </div>

          {/* Simulation Speed */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <Gauge className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            {[1, 2, 5, 10].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedSelect(speed)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  simSpeed === speed
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Emergency Flight Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEmergencyPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold font-mono transition"
            title="Hover drone in place"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>PAUSE</span>
          </button>

          <button
            onClick={onEmergencyRth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold font-mono transition"
            title="Emergency Return to Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span>RTH</span>
          </button>

          <button
            onClick={() => setShowAbortModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-semibold font-mono transition shadow-lg shadow-red-500/5"
            title="Abort mission immediately"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>ABORT</span>
          </button>
        </div>
      </header>

      {/* Abort Confirmation Modal */}
      {showAbortModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertOctagon className="w-7 h-7" />
              <h3 className="text-lg font-bold">EMERGENCY MISSION ABORT</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to terminate the active mission immediately? The drone will halt waypoint progression, climb to safe return altitude (25m), and execute an autonomous Return to Home.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAbortModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAbortModal(false);
                  onEmergencyAbort();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition shadow-lg shadow-red-600/30"
              >
                Confirm Abort & RTH
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
