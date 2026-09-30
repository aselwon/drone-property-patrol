import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  GeoPoint,
  PropertyConfiguration,
  Mission,
  DroneTelemetry,
  TrackedObject,
} from '@patrol/shared';

interface MapViewerProps {
  property: PropertyConfiguration;
  activeMission?: Mission | null;
  telemetry?: DroneTelemetry | null;
  trackedObjects?: TrackedObject[];
  selectedWaypointIndex?: number;
  onMapClick?: (point: GeoPoint) => void;
  interactive?: boolean;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  property,
  activeMission,
  telemetry,
  trackedObjects = [],
  selectedWaypointIndex,
  onMapClick,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups for dynamic map elements
  const boundaryLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const zonesLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const missionLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const droneLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const targetsLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const centerLat = property.homePoint.latitude;
    const centerLon = property.homePoint.longitude;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 18,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tactical tile provider or OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 21,
      subdomains: 'abcd',
    }).addTo(map);

    boundaryLayerRef.current.addTo(map);
    zonesLayerRef.current.addTo(map);
    missionLayerRef.current.addTo(map);
    targetsLayerRef.current.addTo(map);
    droneLayerRef.current.addTo(map);

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
          altitude: 12,
        });
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Property Boundary & Zones
  useEffect(() => {
    if (!mapRef.current) return;

    // Draw boundary
    boundaryLayerRef.current.clearLayers();
    if (property.propertyBoundary.length >= 3) {
      const latLngs = property.propertyBoundary.map(
        (p) => [p.latitude, p.longitude] as [number, number]
      );
      const polygon = L.polygon(latLngs, {
        color: '#0284c7',
        weight: 2,
        dashArray: '4, 4',
        fillColor: '#0284c7',
        fillOpacity: 0.05,
      }).bindTooltip('Property Boundary', { permanent: false });
      boundaryLayerRef.current.addLayer(polygon);
    }

    // Home Point Marker
    const homeIcon = L.divIcon({
      className: 'custom-home-icon',
      html: `<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 10px #10b981;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const homeMarker = L.marker(
      [property.homePoint.latitude, property.homePoint.longitude],
      { icon: homeIcon }
    ).bindTooltip('Home Base / Launch Pad', { permanent: false });
    boundaryLayerRef.current.addLayer(homeMarker);

    // Draw Zones
    zonesLayerRef.current.clearLayers();
    for (const zone of property.zones) {
      if (zone.polygon.length >= 3) {
        const latLngs = zone.polygon.map(
          (p) => [p.latitude, p.longitude] as [number, number]
        );
        const poly = L.polygon(latLngs, {
          color: zone.color,
          weight: 2,
          fillColor: zone.color,
          fillOpacity: 0.2,
        }).bindTooltip(`${zone.name} (${zone.type})`, { permanent: false });
        zonesLayerRef.current.addLayer(poly);
      }
    }
  }, [property]);

  // Update Mission Route & Waypoints
  useEffect(() => {
    if (!mapRef.current) return;
    missionLayerRef.current.clearLayers();

    if (!activeMission || activeMission.waypoints.length === 0) return;

    const latLngs = activeMission.waypoints.map(
      (wp) => [wp.location.latitude, wp.location.longitude] as [number, number]
    );

    // Flight Path Line
    const pathLine = L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '6, 6',
      opacity: 0.8,
    });
    missionLayerRef.current.addLayer(pathLine);

    // Waypoint Markers
    activeMission.waypoints.forEach((wp, idx) => {
      const isSelected = selectedWaypointIndex === idx;
      const isCurrent = activeMission.currentWaypointIndex === idx;
      const bg = isCurrent
        ? '#38bdf8'
        : isSelected
        ? '#f59e0b'
        : '#475569';

      const icon = L.divIcon({
        className: 'wp-marker',
        html: `<div style="background-color: ${bg}; width: 22px; height: 22px; border-radius: 50%; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid #ffffff; box-shadow: 0 0 8px ${bg};">${idx + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([wp.location.latitude, wp.location.longitude], {
        icon,
      }).bindTooltip(
        `WP ${idx + 1}: ${wp.action} (Alt: ${wp.altitude ?? 12}m)`,
        { permanent: false }
      );

      missionLayerRef.current.addLayer(marker);
    });
  }, [activeMission, selectedWaypointIndex]);

  // Update Drone Marker
  useEffect(() => {
    if (!mapRef.current || !telemetry) return;
    droneLayerRef.current.clearLayers();

    const loc = telemetry.location;
    const heading = telemetry.heading;

    const droneIcon = L.divIcon({
      className: 'drone-icon',
      html: `
        <div style="transform: rotate(${heading}deg); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
            <path d="M12 2 L16 10 L12 8 L8 10 Z" fill="#0284c7" stroke="#ffffff" stroke-width="1"/>
            <circle cx="5" cy="5" r="2.5" fill="#e2e8f0" stroke="#0284c7"/>
            <circle cx="19" cy="5" r="2.5" fill="#e2e8f0" stroke="#0284c7"/>
            <circle cx="5" cy="19" r="2.5" fill="#e2e8f0" stroke="#0284c7"/>
            <circle cx="19" cy="19" r="2.5" fill="#e2e8f0" stroke="#0284c7"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([loc.latitude, loc.longitude], { icon: droneIcon })
      .bindTooltip(
        `DRONE | Alt: ${(loc.altitude ?? 0).toFixed(1)}m | Spd: ${telemetry.speed.toFixed(1)}m/s | Hdg: ${heading}°`,
        { permanent: false }
      );

    droneLayerRef.current.addLayer(marker);
  }, [telemetry]);

  // Update Tracked Objects
  useEffect(() => {
    if (!mapRef.current) return;
    targetsLayerRef.current.clearLayers();

    for (const obj of trackedObjects) {
      if (!obj.approximateLocation) continue;

      const isPerson = obj.type === 'person';
      const color = isPerson ? '#ef4444' : '#38bdf8';

      const targetIcon = L.divIcon({
        className: 'target-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color};"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker(
        [obj.approximateLocation.latitude, obj.approximateLocation.longitude],
        { icon: targetIcon }
      ).bindTooltip(
        `${obj.type.toUpperCase()} #${obj.id} (${Math.round(obj.confidence * 100)}%) ${obj.isLoitering ? '⚠️ LOITERING' : ''}`,
        { permanent: false }
      );

      targetsLayerRef.current.addLayer(marker);
    }
  }, [trackedObjects]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md p-3 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1.5 shadow-lg">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
          Tactical Map Legend
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white"></span>
          <span className="text-slate-300">Home Launch Pad</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-1 bg-sky-500 inline-block"></span>
          <span className="text-slate-300">Monitored Boundary</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500/40 border border-red-500 inline-block"></span>
          <span className="text-slate-300">Restricted Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500 inline-block"></span>
          <span className="text-slate-300">Watch Zone (Perimeter)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-ping"></span>
          <span className="text-red-400 font-bold">Detected Intruder</span>
        </div>
      </div>
    </div>
  );
};
