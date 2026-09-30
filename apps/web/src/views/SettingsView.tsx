import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Save,
  CheckCircle2,
  Sliders,
  Battery,
  Navigation,
} from 'lucide-react';
import { SafetyConfig, AlarmMapping } from '@patrol/shared';

interface SettingsViewProps {
  safetyConfig: SafetyConfig;
  alarmMappings: AlarmMapping[];
  onUpdateSafetyConfig: (config: SafetyConfig) => Promise<void>;
  onUpdateAlarmMapping: (mapping: AlarmMapping) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  safetyConfig,
  alarmMappings,
  onUpdateSafetyConfig,
  onUpdateAlarmMapping,
}) => {
  const [config, setConfig] = useState<SafetyConfig>({ ...safetyConfig });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSafety = async () => {
    await onUpdateSafetyConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            SAFETY ENFORCEMENT & ALARM CONFIGURATION
          </h2>
          <p className="text-xs text-slate-400">
            Define strict operational ceilings, battery reserve failsafes, and sensor webhook routes.
          </p>
        </div>

        <button
          onClick={handleSaveSafety}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-2 transition shadow-lg shadow-sky-600/20"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Safety parameters updated successfully across SafetyLayer!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Geofence & Flight Bounds */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center gap-2 text-slate-200 font-bold uppercase text-sm">
            <Shield className="w-4 h-4 text-sky-400" /> Geofence & Altitude Bounds
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-slate-400 block mb-1">
                Maximum Ceiling Altitude (AGL meters)
              </label>
              <input
                type="number"
                value={config.maxAltitude}
                onChange={(e) => setConfig({ ...config, maxAltitude: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Safety Layer rejects any movement commands above this ceiling.
              </span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Minimum Clearance Altitude (AGL meters)
              </label>
              <input
                type="number"
                value={config.minAltitude}
                onChange={(e) => setConfig({ ...config, minAltitude: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Maximum Operational Distance From Home (meters)
              </label>
              <input
                type="number"
                value={config.maxDistanceFromHome}
                onChange={(e) => setConfig({ ...config, maxDistanceFromHome: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Return To Home (RTH) Cruise Altitude (meters)
              </label>
              <input
                type="number"
                value={config.returnHomeAltitude}
                onChange={(e) => setConfig({ ...config, returnHomeAltitude: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.geofenceStrict}
                  onChange={(e) => setConfig({ ...config, geofenceStrict: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
                />
                <span className="text-slate-300 font-bold">Strict Property Polygon Enforcement</span>
              </label>
              <span className="text-[11px] text-slate-500 ml-5 block mt-0.5">
                Automatically rejects any waypoint located outside property boundary polygon.
              </span>
            </div>
          </div>
        </div>

        {/* Right: Battery Failsafes & Alarm Routes */}
        <div className="space-y-6">
          {/* Battery Failsafe Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2 text-slate-200 font-bold uppercase text-sm">
              <Battery className="w-4 h-4 text-emerald-400" /> Battery Failsafe Reserves
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 block mb-1">
                  Minimum Safe Reserve (Auto-RTH Trigger %)
                </label>
                <input
                  type="number"
                  value={config.minimumBatteryReserve}
                  onChange={(e) => setConfig({ ...config, minimumBatteryReserve: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Critical Reserve (Immediate Emergency Land %)
                </label>
                <input
                  type="number"
                  value={config.criticalBatteryReserve}
                  onChange={(e) => setConfig({ ...config, criticalBatteryReserve: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Alarm Mappings Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2 text-slate-200 font-bold uppercase text-sm">
              <Bell className="w-4 h-4 text-amber-400" /> Registered Alarm Routes
            </div>

            <div className="space-y-2">
              {alarmMappings.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-200">
                      source: <span className="text-amber-400">"{m.source}"</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      → Launches: <strong className="text-sky-400">{m.missionName}</strong>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    ROUTE ACTIVE
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
