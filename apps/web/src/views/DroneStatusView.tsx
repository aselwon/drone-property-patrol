import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Battery,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Gauge,
  Wifi,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { DroneTelemetry } from '@patrol/shared';

interface DroneStatusViewProps {
  telemetry: DroneTelemetry | null;
  onInjectFault: (fault: {
    lowBattery?: number;
    dropGps?: boolean;
    disconnect?: boolean;
  }) => Promise<void>;
  onResetFaults: () => Promise<void>;
}

export const DroneStatusView: React.FC<DroneStatusViewProps> = ({
  telemetry,
  onInjectFault,
  onResetFaults,
}) => {
  const [faultStatus, setFaultStatus] = useState<string | null>(null);

  const triggerFault = async (fault: any, label: string) => {
    await onInjectFault(fault);
    setFaultStatus(`Injected: ${label}`);
    setTimeout(() => setFaultStatus(null), 3000);
  };

  const handleReset = async () => {
    await onResetFaults();
    setFaultStatus('All faults reset to normal operational parameters.');
    setTimeout(() => setFaultStatus(null), 3000);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            DRONE HARDWARE DIAGNOSTICS & SIMULATION BENCH
          </h2>
          <p className="text-xs text-slate-400">
            Hardware health telemetry, ESC diagnostics, and fault-injection safety testing.
          </p>
        </div>

        {faultStatus && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">
            {faultStatus}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Hardware Subsystem Telemetry */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Avionics & Sensor Health
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Battery Subsystem */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Battery className="w-4 h-4 text-emerald-400" /> Battery Cells (3S LiPo)
                </span>
                <span className="text-emerald-400 font-bold">NORMAL</span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>State of Charge:</span>
                  <strong className="text-white">{telemetry?.batteryPercent ?? '--'}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Voltage:</span>
                  <strong className="text-white">{telemetry?.batteryVoltage ?? '--'} V</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cell 1 / 2 / 3:</span>
                  <span className="text-slate-400">
                    {telemetry ? `${(telemetry.batteryVoltage / 3).toFixed(2)}V` : '--'} each
                  </span>
                </div>
              </div>
            </div>

            {/* GNSS / GPS Subsystem */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-400" /> GNSS RTK Receiver
                </span>
                <span className={telemetry?.gpsQuality === 'EXCELLENT' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {telemetry?.gpsQuality ?? 'N/A'}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Tracked Satellites:</span>
                  <strong className="text-white">{telemetry?.gpsSatellites ?? 0} Sats</strong>
                </div>
                <div className="flex justify-between">
                  <span>HDOP Precision:</span>
                  <span className="text-slate-400">0.85m</span>
                </div>
                <div className="flex justify-between">
                  <span>Compass Alignment:</span>
                  <span className="text-emerald-400">CALIBRATED</span>
                </div>
              </div>
            </div>

            {/* Propulsion / ESC */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Quad Motors & ESCs
                </span>
                <span className="text-emerald-400 font-bold">READY</span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Armed State:</span>
                  <span className={telemetry?.armed ? 'text-red-400 font-bold' : 'text-slate-400'}>
                    {telemetry?.armed ? 'ARMED' : 'DISARMED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Motor Temp (Avg):</span>
                  <span className="text-slate-400">38.4°C</span>
                </div>
                <div className="flex justify-between">
                  <span>RPM Telemetry:</span>
                  <span className="text-slate-400">SYNCED (CAN-BUS)</span>
                </div>
              </div>
            </div>

            {/* RF Link & Comms */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-indigo-400" /> Ground Telemetry Link
                </span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Link Quality:</span>
                  <strong className="text-white">{telemetry?.signalStrengthPercent ?? 0}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Uplink Frequency:</span>
                  <span className="text-slate-400">2.4 GHz / 5.8 GHz Dual</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="text-emerald-400">18 ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Simulation Fault Injector Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Safety Fault Injector
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Verify autonomous failsafes (auto-RTH on low battery, GPS loss handling, link loss).
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Inject Low Battery */}
            <button
              onClick={() => triggerFault({ lowBattery: 18 }, 'Low Battery (18%)')}
              className="w-full p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Inject Low Battery (18%)</div>
                <div className="text-[11px] text-slate-400">Tests SafetyLayer auto-RTH trigger</div>
              </div>
              <Zap className="w-4 h-4" />
            </button>

            {/* Inject Critical Battery */}
            <button
              onClick={() => triggerFault({ lowBattery: 8 }, 'Critical Battery (8%)')}
              className="w-full p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Inject Critical Battery (8%)</div>
                <div className="text-[11px] text-slate-400">Tests immediate emergency landing</div>
              </div>
              <Battery className="w-4 h-4" />
            </button>

            {/* Inject GPS Loss */}
            <button
              onClick={() => triggerFault({ dropGps: true }, 'GPS Signal Loss')}
              className="w-full p-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold text-left transition flex items-center justify-between"
            >
              <div>
                <div className="font-bold">Inject GPS Loss (3 Sats)</div>
                <div className="text-[11px] text-slate-400">Tests pre-flight & navigation abort</div>
              </div>
              <Radio className="w-4 h-4" />
            </button>

            {/* Reset All */}
            <button
              onClick={handleReset}
              className="w-full p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-center transition flex items-center justify-center gap-2 mt-4"
            >
              <RotateCcw className="w-4 h-4" /> Reset All Faults to Normal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
