import { useEffect, useRef, useState, useCallback } from 'react';
import { DroneTelemetry, Mission, Incident, VisionDetection, TrackedObject, AuditLog } from '@patrol/shared';

export interface WebSocketData {
  telemetry: DroneTelemetry | null;
  activeMission: Mission | null;
  latestIncidents: Incident[];
  detections: VisionDetection[];
  trackedObjects: TrackedObject[];
  auditLogs: AuditLog[];
  connected: boolean;
}

export function useWebSocket() {
  const [telemetry, setTelemetry] = useState<DroneTelemetry | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [latestIncidents, setLatestIncidents] = useState<Incident[]>([]);
  const [detections, setDetections] = useState<VisionDetection[]>([]);
  const [trackedObjects, setTrackedObjects] = useState<TrackedObject[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error, reconnecting...', err);
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'telemetry':
            setTelemetry(msg.data);
            break;
          case 'mission_status':
          case 'mission_completed':
          case 'mission_failed':
            setActiveMission(msg.data);
            break;
          case 'incident_created':
            setLatestIncidents((prev) => [msg.data, ...prev.slice(0, 49)]);
            break;
          case 'incident_updated':
            setLatestIncidents((prev) =>
              prev.map((i) => (i.id === msg.data.id ? msg.data : i))
            );
            break;
          case 'detections':
            setDetections(msg.data.detections || []);
            setTrackedObjects(msg.data.tracks || []);
            break;
          case 'audit_log':
            setAuditLogs((prev) => [msg.data, ...prev.slice(0, 99)]);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    telemetry,
    activeMission,
    latestIncidents,
    detections,
    trackedObjects,
    auditLogs,
    connected,
  };
}
