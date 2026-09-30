import React, { useState } from 'react';
import {
  Film,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Shield,
  Activity,
} from 'lucide-react';
import { Incident } from '@patrol/shared';

export const VideoReplayView: React.FC = () => {
  const [frameCount, setFrameCount] = useState(15);
  const [targetLabel, setTargetLabel] = useState('person');
  const [processing, setProcessing] = useState(false);
  const [replayResult, setReplayResult] = useState<{
    totalFrames: number;
    detectionsCount: number;
    incidentsGenerated: Incident[];
    message?: string;
  } | null>(null);

  const runReplaySimulation = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/video/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameCount,
          targetLabel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReplayResult(data.result);
      }
    } catch (err) {
      console.error('Replay error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-sky-400" />
            OPTICAL VIDEO REPLAY & SYNTHETIC SURVEILLANCE PIPELINE
          </h2>
          <p className="text-xs text-slate-400">
            Ingest flight recordings or synthetic video frames through the Vision Engine to test tracking and incident generation without physical drone flight.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Replay Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Replay Parameters
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Target Object Class</label>
              <select
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              >
                <option value="person">Person (Stranger on property)</option>
                <option value="car">Car (Vehicle in driveway)</option>
                <option value="van">Delivery Van</option>
                <option value="truck">Truck</option>
                <option value="dog">Dog (Perimeter animal)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Number of Sequential Frames ({frameCount})</label>
              <input
                type="range"
                min="5"
                max="50"
                value={frameCount}
                onChange={(e) => setFrameCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>5 frames (burst)</span>
                <span>50 frames (loitering sweep)</span>
              </div>
            </div>

            {/* Video File Drag/Drop Placeholder */}
            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center space-y-2 bg-slate-950/50 hover:border-slate-700 transition cursor-pointer">
              <Upload className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-slate-300 font-semibold text-xs">
                Upload MP4 Flight Recording
              </div>
              <p className="text-[11px] text-slate-500">
                Drag and drop aerial MP4 video clip to decode and replay
              </p>
            </div>

            <button
              disabled={processing}
              onClick={runReplaySimulation}
              className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              {processing ? 'Processing Frames Through Vision Engine...' : 'Run Vision Pipeline Replay'}
            </button>
          </div>
        </div>

        {/* Right: Pipeline Results Dossier */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Vision Pipeline Execution Results
            </h3>
            {replayResult && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> REPLAY FINISHED
              </span>
            )}
          </div>

          {replayResult ? (
            <div className="space-y-5 text-xs">
              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">TOTAL FRAMES INGESTED</span>
                  <div className="text-2xl font-bold text-white font-mono">{replayResult.totalFrames}</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">DETECTIONS IDENTIFIED</span>
                  <div className="text-2xl font-bold text-sky-400 font-mono">{replayResult.detectionsCount}</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">INCIDENTS GENERATED</span>
                  <div className="text-2xl font-bold text-red-400 font-mono">
                    {replayResult.incidentsGenerated.length}
                  </div>
                </div>
              </div>

              {/* Incidents Generated */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Incidents Created During Replay
                </div>
                {replayResult.incidentsGenerated.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-500 text-center">
                    Detections fell outside restricted zones; no incidents triggered.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {replayResult.incidentsGenerated.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              {inc.severity}
                            </span>
                            <span className="font-bold text-slate-200">
                              INCIDENT #{inc.incidentNumber}: {inc.title}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1">{inc.description}</p>
                        </div>
                        <div className="text-right text-slate-500">
                          <div>Duration: {inc.durationSeconds}s</div>
                          <div>Conf: {Math.round(inc.confidence * 100)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-500 space-y-2">
              <Film className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-400">No Replay Executed Yet</div>
              <p className="text-xs max-w-sm mx-auto">
                Configure parameters and click "Run Vision Pipeline Replay" to pass video frames through the detector, tracker, and zone incident engines.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
