import React, { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  MapPin,
  CheckCircle2,
  Camera,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import { Incident, IncidentSeverity } from '@patrol/shared';

interface IncidentsViewProps {
  incidents: Incident[];
  onAcknowledgeIncident: (id: string) => Promise<void>;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onAcknowledgeIncident,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    incidents[0]?.id ?? null
  );
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const filtered = incidents.filter((inc) => {
    if (filterSeverity === 'ALL') return true;
    return inc.severity === filterSeverity;
  });

  const activeInc = incidents.find((i) => i.id === selectedIncidentId) ?? incidents[0];

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'HIGH':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h2 className="text-base font-bold font-mono text-white">
            INCIDENT TRIAGE & AUDIT LOG
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            ({incidents.length} total)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded-lg border transition font-semibold ${
                filterSeverity === sev
                  ? 'bg-sky-600 text-white border-sky-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Incident Feed List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden flex flex-col h-[640px]">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
            Recorded Incidents
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No incidents matching filter.
              </div>
            ) : (
              filtered.map((inc) => {
                const isSelected = activeInc?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`p-3 rounded-lg border text-xs font-mono cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-800 border-sky-500 shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-200">
                        INCIDENT #{inc.incidentNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getSeverityBadge(
                          inc.severity
                        )}`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-300 truncate mb-1">
                      {inc.title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{inc.zoneName ?? 'Property'}</span>
                      <span>{new Date(inc.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detailed Incident Dossier */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          {activeInc ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold font-mono text-white">
                      INCIDENT #{activeInc.incidentNumber}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border uppercase ${getSeverityBadge(
                        activeInc.severity
                      )}`}
                    >
                      {activeInc.severity} SEVERITY
                    </span>
                    {activeInc.acknowledged ? (
                      <span className="text-emerald-400 font-mono text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ACKNOWLEDGED
                      </span>
                    ) : (
                      <button
                        onClick={() => onAcknowledgeIncident(activeInc.id)}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition"
                      >
                        Mark Acknowledged
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 font-medium">
                    {activeInc.description}
                  </p>
                </div>

                <div className="text-right text-xs font-mono text-slate-400">
                  <div>{new Date(activeInc.timestamp).toLocaleDateString()}</div>
                  <div className="text-white font-bold">{new Date(activeInc.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-1">MONITORED ZONE</span>
                  <strong className="text-slate-200">{activeInc.zoneName ?? 'Property Grounds'}</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-1">DETECTION DURATION</span>
                  <strong className="text-slate-200">{activeInc.durationSeconds} seconds</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-1">AI CONFIDENCE</span>
                  <strong className="text-sky-400">{Math.round(activeInc.confidence * 100)}%</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-1">EST. GPS LOCATION</span>
                  <strong className="text-slate-200">
                    {activeInc.location.latitude.toFixed(5)}, {activeInc.location.longitude.toFixed(5)}
                  </strong>
                </div>
              </div>

              {/* Aerial Snapshot / Evidence Frame */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Camera className="w-4 h-4 text-sky-400" /> AERIAL EVIDENCE SNAPSHOT
                  </span>
                  <span>ID: {activeInc.trackedObjectId ?? 'N/A'}</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-56 relative flex items-center justify-center">
                  <img
                    src={`/api/video/snapshot?target=${activeInc.trackedObjectId}&t=${activeInc.timestamp}`}
                    alt="Incident Frame Snapshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-red-400 border border-red-500/30">
                    EVIDENCE FRAME ● {activeInc.type}
                  </div>
                </div>
              </div>

              {/* Event Timeline */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Incident Timeline
                </div>
                <div className="space-y-2 font-mono text-xs">
                  {activeInc.timeline.map((evt, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-300">{evt.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 font-mono text-sm">
              Select an incident from the log to view evidence dossier.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
