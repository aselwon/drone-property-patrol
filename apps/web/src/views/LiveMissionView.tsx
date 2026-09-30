import React, { useState } from 'react';
import {
  Pause,
  Play,
  Home,
  AlertOctagon,
  Eye,
  Sliders,
  Compass,
  Gauge,
  Activity,
  Layers,
  Shield,
  Video,
} from 'lucide-react';
import {
  DroneTelemetry,
  Mission,
  PropertyConfiguration,
  TrackedObject,
  VisionDetection,
} from '@patrol/shared';
import { MapViewer } from '../components/MapViewer.js';

interface LiveMissionViewProps {
  telemetry: DroneTelemetry | null;
  activeMission: Mission | null;
  property: PropertyConfiguration;
  trackedObjects: TrackedObject[];
  detections: VisionDetection[];
  onPause: () => void;
  onResume: () => void;
  onRth: () => void;
  onAbort: () => void;
}

export const LiveMissionView: React.FC<LiveMissionViewProps> = ({
  telemetry,
  activeMission,
  property,
  trackedObjects,
  detections,
  onPause,
  onResume,
  onRth,
  onAbort,
}) => {
  const [showTakeControlModal, setShowTakeControlModal] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [manualControlActive, setManualControlActive] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top HUD State Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="font-mono font-bold text-sm text-white">
              LIVE SURVEILLANCE FEED
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="text-xs font-mono text-slate-300">
            Mission: <strong className="text-sky-400">{activeMission ? activeMission.name : 'STANDBY (NO ACTIVE MISSION)'}</strong>
          </div>

          <div className="text-xs font-mono text-slate-300">
            State: <strong className="text-emerald-400">{activeMission ? activeMission.status : telemetry?.flightMode ?? 'IDLE'}</strong>
          </div>
        </div>

        {/* Operational Controls */}
        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={onPause}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Pause className="w-3.5 h-3.5" /> PAUSE
          </button>

          <button
            onClick={onResume}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" /> RESUME
          </button>

          <button
            onClick={onRth}
            className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Home className="w-3.5 h-3.5" /> RETURN HOME
          </button>

          <button
            onClick={() => setShowTakeControlModal(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5" /> TAKE CONTROL
          </button>

          <button
            onClick={() => setShowAbortModal(true)}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <AlertOctagon className="w-3.5 h-3.5" /> ABORT
          </button>
        </div>
      </div>

      {/* Split Grid: Live Camera Stream & Tactical Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[520px]">
        {/* Left: Camera Feed & AI Vision Overlay */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xl relative">
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-slate-300 font-semibold">
              <Video className="w-4 h-4 text-sky-400" /> ON-BOARD OPTICAL PAYLOAD
            </span>
            <span className="text-slate-400">
              FOVx: 84° | NADIR: -45° | RES: 4K UHD
            </span>
          </div>

          {/* Video Stream Container */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px]">
            {/* Live Camera Snapshot from API */}
            <img
              src="/api/video/snapshot"
              alt="Simulated Camera Stream"
              className="w-full h-full object-cover select-none"
              key={Date.now()}
            />

            {/* Target Detection Overlays */}
            {detections.map((det) => (
              <div
                key={det.id}
                className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none rounded transition-all duration-150"
                style={{
                  left: `${det.box.x * 100}%`,
                  top: `${det.box.y * 100}%`,
                  width: `${det.box.width * 100}%`,
                  height: `${det.box.height * 100}%`,
                }}
              >
                <div className="absolute -top-5 left-0 bg-red-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                  {det.label.toUpperCase()} {Math.round(det.confidence * 100)}%
                </div>
              </div>
            ))}

            {/* HUD Telemetry Overlay on Video */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur p-2.5 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
              <div className="text-sky-400 font-bold">ALT: {(telemetry?.location.altitude ?? 0).toFixed(1)}m</div>
              <div className="text-slate-300">SPD: {telemetry?.speed.toFixed(1)} m/s</div>
              <div className="text-slate-300">HDG: {telemetry?.heading}°</div>
              <div className="text-slate-300">BAT: {telemetry?.batteryPercent}%</div>
            </div>

            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-slate-800 font-mono text-[11px] text-slate-400">
              TARGETS IN VIEW: <strong className="text-emerald-400">{trackedObjects.length}</strong>
            </div>
          </div>

          {/* Detections List Bottom Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Active Tracks: {trackedObjects.map((t) => `${t.type} (#${t.id})`).join(', ') || 'None'}
            </span>
            <span className="text-emerald-400">VISION ENGINE ONLINE</span>
          </div>
        </div>

        {/* Right: Tactical Map Viewer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-slate-300 font-semibold">
              <Layers className="w-4 h-4 text-indigo-400" /> TACTICAL SITUATIONAL MAP
            </span>
            <span className="text-slate-400">
              GEODETIC WGS84
            </span>
          </div>

          <div className="flex-1 min-h-[360px]">
            <MapViewer
              property={property}
              activeMission={activeMission}
              telemetry={telemetry}
              trackedObjects={trackedObjects}
            />
          </div>
        </div>
      </div>

      {/* Manual Take Control Confirmation Modal */}
      {showTakeControlModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <Sliders className="w-6 h-6" />
              <h3 className="text-lg font-bold">OPERATOR MANUAL OVERRIDE</h3>
            </div>
            <p className="text-sm text-slate-300">
              You are requesting to take direct manual stick control of the drone.
              The mission state machine will pause automated waypoint navigation.
              All safety geofences and maximum altitude ceilings remain strictly enforced by the Safety Layer.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTakeControlModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowTakeControlModal(false);
                  setManualControlActive(true);
                  onPause();
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Confirm Manual Control
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abort Confirmation Modal */}
      {showAbortModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertOctagon className="w-6 h-6" />
              <h3 className="text-lg font-bold">CONFIRM MISSION ABORT</h3>
            </div>
            <p className="text-sm text-slate-300">
              Terminate active flight immediately? The drone will immediately disengage waypoints, ascend to safe transit clearance (25m), and return home.
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
                  onAbort();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition shadow-lg shadow-red-600/30"
              >
                Abort Immediately
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
