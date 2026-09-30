import { describe, it, expect } from 'vitest';
import {
  isPointInPolygon,
  calculateDistanceMeters,
  calculateBearing,
  pathCrossesPolygon,
  interpolateGeoPoint,
  destinationPoint,
  GeoPoint,
} from '../../packages/shared/dist/index.js';

describe('Geospatial Math & Polygon Geofence Engine', () => {
  const propertyPolygon: GeoPoint[] = [
    { latitude: 37.775, longitude: -122.42 },
    { latitude: 37.775, longitude: -122.418 },
    { latitude: 37.774, longitude: -122.418 },
    { latitude: 37.774, longitude: -122.42 },
  ];

  it('correctly determines points inside the polygon', () => {
    const insidePoint: GeoPoint = {
      latitude: 37.7745,
      longitude: -122.419,
    };
    expect(isPointInPolygon(insidePoint, propertyPolygon)).toBe(true);
  });

  it('correctly determines points outside the polygon', () => {
    const outsideNorth: GeoPoint = {
      latitude: 37.776,
      longitude: -122.419,
    };
    const outsideWest: GeoPoint = {
      latitude: 37.7745,
      longitude: -122.421,
    };
    expect(isPointInPolygon(outsideNorth, propertyPolygon)).toBe(false);
    expect(isPointInPolygon(outsideWest, propertyPolygon)).toBe(false);
  });

  it('calculates accurate distances between coordinates using Haversine', () => {
    const p1: GeoPoint = { latitude: 37.774929, longitude: -122.419416 };
    const p2: GeoPoint = { latitude: 37.775829, longitude: -122.419416 }; // ~100m north

    const distance = calculateDistanceMeters(p1, p2);
    expect(distance).toBeGreaterThan(99);
    expect(distance).toBeLessThan(101);
  });

  it('computes initial compass bearing correctly', () => {
    const from: GeoPoint = { latitude: 37.774929, longitude: -122.419416 };
    const toNorth: GeoPoint = { latitude: 37.775929, longitude: -122.419416 };
    const toEast: GeoPoint = { latitude: 37.774929, longitude: -122.418416 };

    expect(Math.round(calculateBearing(from, toNorth))).toBe(0);
    expect(Math.round(calculateBearing(from, toEast))).toBe(90);
  });

  it('detects when a flight trajectory crosses a polygon edge', () => {
    const restrictedZone: GeoPoint[] = [
      { latitude: 37.7746, longitude: -122.4196 },
      { latitude: 37.7746, longitude: -122.4192 },
      { latitude: 37.7744, longitude: -122.4192 },
      { latitude: 37.7744, longitude: -122.4196 },
    ];

    // Trajectory going straight through the restricted zone
    const start: GeoPoint = { latitude: 37.7748, longitude: -122.4194 };
    const end: GeoPoint = { latitude: 37.7742, longitude: -122.4194 };

    expect(pathCrossesPolygon(start, end, restrictedZone)).toBe(true);

    // Trajectory completely clear of the restricted zone
    const clearStart: GeoPoint = { latitude: 37.7748, longitude: -122.418 };
    const clearEnd: GeoPoint = { latitude: 37.7742, longitude: -122.418 };
    expect(pathCrossesPolygon(clearStart, clearEnd, restrictedZone)).toBe(false);
  });

  it('interpolates points smoothly between start and end coordinates', () => {
    const p1: GeoPoint = { latitude: 37.774, longitude: -122.42, altitude: 10 };
    const p2: GeoPoint = { latitude: 37.776, longitude: -122.418, altitude: 20 };

    const mid = interpolateGeoPoint(p1, p2, 0.5);
    expect(mid.latitude).toBeCloseTo(37.775, 4);
    expect(mid.longitude).toBeCloseTo(-122.419, 4);
    expect(mid.altitude).toBe(15);
  });
});
