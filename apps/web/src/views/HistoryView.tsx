import React, { useState } from 'react';
import {
  History,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
} from 'lucide-react';
import { Mission, AuditLog } from '@patrol/shared';

interface HistoryViewProps {
  missions: Mission[];
  auditLogs: AuditLog[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  missions,
  auditLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'AUDIT_LOGS'>('MISSIONS');
  const [filterEvent, setFilterEvent] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterEvent === 'ALL') return true;
    return log.event === filterEvent;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-lg font-bold text-white">
              FLIGHT HISTORY & AUDIT TRAIL
            </h2>
            <p className="text-slate-400">
              Immutable record of autonomous flight transitions, safety validation events, and operator commands.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('MISSIONS')}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === 'MISSIONS'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Missions ({missions.length})
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === 'AUDIT_LOGS'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'MISSIONS' ? (
        /* Missions Table */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] pb-2">
                  <th className="py-3 px-4">Mission Name</th>
                  <th className="py-3 px-4">Trigger Source</th>
                  <th className="py-3 px-4">Waypoints</th>
                  <th className="py-3 px-4">Flight Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {missions.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {m.name}
                      {m.alarmSource && (
                        <span className="text-[10px] text-amber-400 block font-normal">
                          Alarm: {m.alarmSource}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sky-400 font-semibold">{m.triggerSource}</td>
                    <td className="py-3 px-4 text-slate-300">{m.totalWaypoints} WPs</td>
                    <td className="py-3 px-4 text-slate-300">
                      {m.durationSeconds ? `${m.durationSeconds}s` : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : m.status === 'FAILED'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : m.status === 'ABORTED'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {m.startedAt ? new Date(m.startedAt).toLocaleString() : 'Not started'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Audit Logs Table */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 uppercase text-xs">
              System Audit Records
            </span>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterEvent}
                onChange={(e) => setFilterEvent(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 text-xs"
              >
                <option value="ALL">All Events</option>
                <option value="MISSION_STARTED">MISSION_STARTED</option>
                <option value="PREFLIGHT_PASSED">PREFLIGHT_PASSED</option>
                <option value="TAKEOFF_REQUESTED">TAKEOFF_REQUESTED</option>
                <option value="MOVEMENT_REQUESTED">MOVEMENT_REQUESTED</option>
                <option value="MOVEMENT_REJECTED">MOVEMENT_REJECTED</option>
                <option value="INCIDENT_CREATED">INCIDENT_CREATED</option>
                <option value="RTH_REQUESTED">RTH_REQUESTED</option>
                <option value="MISSION_COMPLETED">MISSION_COMPLETED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] pb-2">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Mission ID</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {log.actor}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-sky-400">
                      {log.event}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {log.missionId ?? '--'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 text-[11px] max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
