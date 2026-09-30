import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Eye,
  Compass,
  ShieldAlert,
  Cpu,
  Film,
  History,
  Settings,
} from 'lucide-react';
import {
  Mission,
  PropertyConfiguration,
  SafetyConfig,
  AlarmMapping,
  Incident,
} from '@patrol/shared';
import { useWebSocket } from './hooks/useWebSocket.js';
import { Header } from './components/Header.js';
import { DashboardView } from './views/DashboardView.js';
import { LiveMissionView } from './views/LiveMissionView.js';
import { MissionDesigner } from './views/MissionDesigner.js';
import { IncidentsView } from './views/IncidentsView.js';
import { DroneStatusView } from './views/DroneStatusView.js';
import { VideoReplayView } from './views/VideoReplayView.js';
import { HistoryView } from './views/HistoryView.js';
import { SettingsView } from './views/SettingsView.js';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [property, setProperty] = useState<PropertyConfiguration | null>(null);
  const [safetyConfig, setSafetyConfig] = useState<SafetyConfig | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [alarmMappings, setAlarmMappings] = useState<AlarmMapping[]>([]);
  const [incidentsList, setIncidentsList] = useState<Incident[]>([]);

  const {
    telemetry,
    activeMission: wsActiveMission,
    latestIncidents,
    detections,
    trackedObjects,
    auditLogs,
    connected,
  } = useWebSocket();

  // Initial Data Fetch
  const fetchData = async () => {
    try {
      const [propRes, safetyRes, missionsRes, alarmsRes, incsRes] = await Promise.all([
        fetch('/api/property'),
        fetch('/api/safety/config'),
        fetch('/api/missions'),
        fetch('/api/alarms/mappings'),
        fetch('/api/incidents'),
      ]);

      if (propRes.ok) setProperty(await propRes.json());
      if (safetyRes.ok) setSafetyConfig(await safetyRes.json());
      if (missionsRes.ok) setMissions(await missionsRes.json());
      if (alarmsRes.ok) setAlarmMappings(await alarmsRes.json());
      if (incsRes.ok) setIncidentsList(await incsRes.json());
    } catch (err) {
      console.error('Error fetching initial configuration:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Merge websocket incidents with fetched incidents
  const allIncidents = [
    ...latestIncidents,
    ...incidentsList.filter((i) => !latestIncidents.some((li) => li.id === i.id)),
  ];

  // Active mission prioritizes websocket updates
  const activeMission = wsActiveMission || missions.find((m) => m.status === 'FLYING' || m.status === 'OBSERVING' || m.status === 'TAKEOFF' || m.status === 'RETURNING') || null;

  // Actions
  const handleStartMission = async (missionId: string) => {
    try {
      await fetch(`/api/missions/${missionId}/start`, { method: 'POST' });
    } catch (err) {
      console.error('Error starting mission:', err);
    }
  };

  const handlePause = async () => {
    try {
      await fetch('/api/drone/pause', { method: 'POST' });
    } catch (err) {
      console.error('Error pausing drone:', err);
    }
  };

  const handleResume = async () => {
    try {
      await fetch('/api/drone/resume', { method: 'POST' });
    } catch (err) {
      console.error('Error resuming drone:', err);
    }
  };

  const handleRth = async () => {
    try {
      await fetch('/api/drone/rth', { method: 'POST' });
    } catch (err) {
      console.error('Error triggering RTH:', err);
    }
  };

  const handleAbort = async () => {
    try {
      await fetch('/api/drone/abort', { method: 'POST' });
    } catch (err) {
      console.error('Error aborting drone:', err);
    }
  };

  const handleSimulationSpeed = async (multiplier: number) => {
    try {
      await fetch('/api/drone/simulation-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      });
    } catch (err) {
      console.error('Error updating simulation speed:', err);
    }
  };

  const handleTriggerAlarm = async (source: string, event: string) => {
    try {
      await fetch('/api/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, event, zone: source }),
      });
    } catch (err) {
      console.error('Error triggering alarm:', err);
    }
  };

  const handleAcknowledgeIncident = async (id: string) => {
    try {
      await fetch(`/api/incidents/${id}/ack`, { method: 'POST' });
      setIncidentsList((prev) =>
        prev.map((i) => (i.id === id ? { ...i, acknowledged: true } : i))
      );
    } catch (err) {
      console.error('Error acknowledging incident:', err);
    }
  };

  const handleSaveMission = async (newMission: Partial<Mission>) => {
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMission),
      });
      if (res.ok) {
        const created = await res.json();
        setMissions((prev) => [created, ...prev]);
      }
    } catch (err) {
      console.error('Error saving mission:', err);
    }
  };

  const handleUpdateProperty = async (prop: PropertyConfiguration) => {
    try {
      const res = await fetch('/api/property', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prop),
      });
      if (res.ok) setProperty(prop);
    } catch (err) {
      console.error('Error updating property:', err);
    }
  };

  const handleUpdateSafetyConfig = async (cfg: SafetyConfig) => {
    try {
      const res = await fetch('/api/safety/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (res.ok) setSafetyConfig(cfg);
    } catch (err) {
      console.error('Error updating safety config:', err);
    }
  };

  const handleInjectFault = async (fault: any) => {
    try {
      await fetch('/api/drone/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fault),
      });
    } catch (err) {
      console.error('Error injecting fault:', err);
    }
  };

  const handleResetFaults = async () => {
    try {
      await fetch('/api/drone/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lowBattery: 100, dropGps: false, disconnect: false }),
      });
    } catch (err) {
      console.error('Error resetting faults:', err);
    }
  };

  if (!property || !safetyConfig) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-4 font-mono">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">CONNECTING TO DRONE PROPERTY PATROL SYSTEM...</p>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live Mission', icon: Eye },
    { id: 'designer', label: 'Mission Designer', icon: Compass },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert, badge: allIncidents.filter((i) => !i.acknowledged).length },
    { id: 'diagnostics', label: 'Drone Status', icon: Cpu },
    { id: 'replay', label: 'Video Replay', icon: Film },
    { id: 'history', label: 'History & Audit', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Tactical Top Bar */}
      <Header
        telemetry={telemetry}
        connected={connected}
        onEmergencyRth={handleRth}
        onEmergencyPause={handlePause}
        onEmergencyAbort={handleAbort}
        onSimulationSpeedChange={handleSimulationSpeed}
      />

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-mono">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600/10 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab Content Views */}
        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              activeMission={activeMission}
              missions={missions}
              incidents={allIncidents}
              property={property}
              onStartMission={handleStartMission}
              onTriggerAlarm={handleTriggerAlarm}
              onAcknowledgeIncident={handleAcknowledgeIncident}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'live' && (
            <LiveMissionView
              telemetry={telemetry}
              activeMission={activeMission}
              property={property}
              trackedObjects={trackedObjects}
              detections={detections}
              onPause={handlePause}
              onResume={handleResume}
              onRth={handleRth}
              onAbort={handleAbort}
            />
          )}

          {activeTab === 'designer' && (
            <MissionDesigner
              property={property}
              safetyConfig={safetyConfig}
              missions={missions}
              onSaveMission={handleSaveMission}
              onUpdateProperty={handleUpdateProperty}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsView
              incidents={allIncidents}
              onAcknowledgeIncident={handleAcknowledgeIncident}
            />
          )}

          {activeTab === 'diagnostics' && (
            <DroneStatusView
              telemetry={telemetry}
              onInjectFault={handleInjectFault}
              onResetFaults={handleResetFaults}
            />
          )}

          {activeTab === 'replay' && <VideoReplayView />}

          {activeTab === 'history' && (
            <HistoryView
              missions={missions}
              auditLogs={auditLogs}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              safetyConfig={safetyConfig}
              alarmMappings={alarmMappings}
              onUpdateSafetyConfig={handleUpdateSafetyConfig}
              onUpdateAlarmMapping={async (m) => {}}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
