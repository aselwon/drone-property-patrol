import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Save,
  Compass,
  ArrowUp,
  ArrowDown,
  Navigation,
  Shield,
  Layers,
} from 'lucide-react';
import {
  Mission,
  Waypoint,
  GeoPoint,
  PropertyConfiguration,
  SafetyConfig,
  calculateDistanceMeters,
  isPointInPolygon,
} from '@patrol/shared';
import { MapViewer } from '../components/MapViewer.js';

interface MissionDesignerProps {
  property: PropertyConfiguration;
  safetyConfig: SafetyConfig;
  missions: Mission[];
  onSaveMission: (mission: Partial<Mission>) => Promise<void>;
  onUpdateProperty: (prop: PropertyConfiguration) => Promise<void>;
}

export const MissionDesigner: React.FC<MissionDesignerProps> = ({
  property,
  safetyConfig,
  missions,
  onSaveMission,
  onUpdateProperty,
}) => {
  const [missionName, setMissionName] = useState('Custom Perimeter Sweep');
  const [description, setDescription] = useState('Operator defined inspection route');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    {
      id: 'wp-new-1',
      index: 0,
      location: { latitude: 37.77455, longitude: -122.4195, altitude: 12 },
      speed: 4,
      altitude: 12,
      action: 'HOVER_OBSERVE',
      observationDurationSeconds: 5,
    },
    {
      id: 'wp-new-2',
      index: 1,
      location: { latitude: 37.7749, longitude: -122.4191, altitude: 14 },
      speed: 5,
      altitude: 14,
      action: 'CAPTURE_PHOTO',
      observationDurationSeconds: 2,
    },
    {
      id: 'wp-new-3',
      index: 2,
      location: { latitude: 37.77525, longitude: -122.4196, altitude: 15 },
      speed: 5,
      altitude: 15,
      action: 'HOVER_OBSERVE',
      observationDurationSeconds: 5,
    },
  ]);

  const [selectedWpIndex, setSelectedWpIndex] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<{ wpIndex: number; message: string }[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Validate waypoints against geofence and altitude safety limits
  const validateRoute = () => {
    const errors: { wpIndex: number; message: string }[] = [];

    waypoints.forEach((wp, idx) => {
      // 1. Boundary check
      if (
        property.propertyBoundary.length >= 3 &&
        !isPointInPolygon(wp.location, property.propertyBoundary)
      ) {
        errors.push({
          wpIndex: idx,
          message: `WP #${idx + 1} is outside property boundary geofence.`,
        });
      }

      // 2. Restricted zone check
      for (const zone of property.zones) {
        if (
          zone.type === 'RESTRICTED_ZONE' &&
          zone.rules.forbiddenFlight &&
          isPointInPolygon(wp.location, zone.polygon)
        ) {
          errors.push({
            wpIndex: idx,
            message: `WP #${idx + 1} is inside no-fly restricted zone "${zone.name}".`,
          });
        }
      }

      // 3. Altitude check
      const alt = wp.altitude ?? 12;
      if (alt > safetyConfig.maxAltitude) {
        errors.push({
          wpIndex: idx,
          message: `WP #${idx + 1} altitude (${alt}m) exceeds max ceiling of ${safetyConfig.maxAltitude}m.`,
        });
      }
      if (alt < safetyConfig.minAltitude) {
        errors.push({
          wpIndex: idx,
          message: `WP #${idx + 1} altitude (${alt}m) is below min clearance of ${safetyConfig.minAltitude}m.`,
        });
      }

      // 4. Max distance from home
      const dist = calculateDistanceMeters(wp.location, property.homePoint);
      if (dist > safetyConfig.maxDistanceFromHome) {
        errors.push({
          wpIndex: idx,
          message: `WP #${idx + 1} distance (${dist.toFixed(0)}m) exceeds max radius (${safetyConfig.maxDistanceFromHome}m).`,
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleMapClick = (pt: GeoPoint) => {
    // Add new waypoint at clicked location
    const newWp: Waypoint = {
      id: `wp-${Date.now()}`,
      index: waypoints.length,
      location: { ...pt, altitude: 12 },
      speed: 5,
      altitude: 12,
      action: 'HOVER_OBSERVE',
      observationDurationSeconds: 4,
    };
    setWaypoints([...waypoints, newWp]);
    setSelectedWpIndex(waypoints.length);
  };

  const removeWaypoint = (index: number) => {
    const updated = waypoints
      .filter((_, i) => i !== index)
      .map((wp, i) => ({ ...wp, index: i }));
    setWaypoints(updated);
    if (selectedWpIndex >= updated.length) {
      setSelectedWpIndex(Math.max(0, updated.length - 1));
    }
  };

  const moveWaypoint = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === waypoints.length - 1)
    )
      return;

    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const reordered = [...waypoints];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const updated = reordered.map((wp, i) => ({ ...wp, index: i }));
    setWaypoints(updated);
    setSelectedWpIndex(targetIdx);
  };

  const handleSave = async () => {
    const isValid = validateRoute();
    if (!isValid) return;

    await onSaveMission({
      name: missionName,
      description,
      propertyId: property.id,
      waypoints,
      triggerSource: 'MANUAL',
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const dummyMission: Mission = {
    id: 'preview-designer',
    name: missionName,
    propertyId: property.id,
    waypoints,
    status: 'READY',
    triggerSource: 'MANUAL',
    currentWaypointIndex: selectedWpIndex,
    totalWaypoints: waypoints.length,
    createdAt: Date.now(),
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            TACTICAL MISSION DESIGNER
          </h2>
          <p className="text-xs text-slate-400">
            Click map to add waypoints, configure altitudes, observe durations, and run safety validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={validateRoute}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Validate Safety
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition shadow-lg shadow-sky-600/20"
          >
            <Save className="w-4 h-4" /> Save Mission
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Mission successfully saved and added to patrol templates!
        </div>
      )}

      {/* Validation Errors Notice */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl space-y-2 text-xs font-mono">
          <div className="font-bold text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> SAFETY VIOLATIONS DETECTED ({validationErrors.length})
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            {validationErrors.map((err, idx) => (
              <li key={idx} className="text-red-300">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Map */}
        <div className="lg:col-span-2 min-h-[500px]">
          <MapViewer
            property={property}
            activeMission={dummyMission}
            selectedWaypointIndex={selectedWpIndex}
            onMapClick={handleMapClick}
          />
        </div>

        {/* Right: Waypoint Configuration Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4 flex flex-col h-[500px]">
          <div className="border-b border-slate-800 pb-3">
            <label className="text-[11px] font-mono font-semibold text-slate-400 block mb-1 uppercase">
              Mission Title
            </label>
            <input
              type="text"
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 font-mono">
              Waypoints ({waypoints.length})
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Click map to add</span>
          </div>

          {/* Waypoint list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {waypoints.map((wp, idx) => {
              const isSelected = selectedWpIndex === idx;
              const hasError = validationErrors.some((e) => e.wpIndex === idx);

              return (
                <div
                  key={wp.id}
                  onClick={() => setSelectedWpIndex(idx)}
                  className={`p-3 rounded-lg border text-xs font-mono cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-800 border-sky-500'
                      : hasError
                      ? 'bg-red-950/20 border-red-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold flex items-center gap-1.5 text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 inline-flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      Waypoint #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveWaypoint(idx, 'UP');
                        }}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveWaypoint(idx, 'DOWN');
                        }}
                        disabled={idx === waypoints.length - 1}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWaypoint(idx);
                        }}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 mt-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Altitude (m)</label>
                        <input
                          type="number"
                          value={wp.altitude ?? 12}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...waypoints];
                            updated[idx].altitude = val;
                            setWaypoints(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Speed (m/s)</label>
                        <input
                          type="number"
                          value={wp.speed ?? 5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...waypoints];
                            updated[idx].speed = val;
                            setWaypoints(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Action</label>
                        <select
                          value={wp.action}
                          onChange={(e) => {
                            const updated = [...waypoints];
                            updated[idx].action = e.target.value as any;
                            setWaypoints(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="HOVER_OBSERVE">HOVER_OBSERVE</option>
                          <option value="CAPTURE_PHOTO">CAPTURE_PHOTO</option>
                          <option value="PASS">PASS</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Duration (s)</label>
                        <input
                          type="number"
                          value={wp.observationDurationSeconds ?? 4}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...waypoints];
                            updated[idx].observationDurationSeconds = val;
                            setWaypoints(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
