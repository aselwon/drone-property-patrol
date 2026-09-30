/**
 * Geospatial mathematics and polygon calculation utilities.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number; // Altitude in meters above ground level (AGL)
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Converts degrees to radians.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function calculateDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  const dLat = degreesToRadians(p2.latitude - p1.latitude);
  const dLon = degreesToRadians(p2.longitude - p1.longitude);

  const lat1 = degreesToRadians(p1.latitude);
  const lat2 = degreesToRadians(p2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes initial compass bearing from point 1 to point 2 in degrees (0..360).
 */
export function calculateBearing(from: GeoPoint, to: GeoPoint): number {
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const dLon = degreesToRadians(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearingRad = Math.atan2(y, x);
  return (radiansToDegrees(bearingRad) + 360) % 360;
}

/**
 * Determines whether a given coordinate is located inside a polygon using ray casting.
 * The polygon is represented as an array of GeoPoints forming a closed or open loop.
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Checks whether two line segments (p1-p2 and p3-p4) intersect.
 */
export function doLineSegmentsIntersect(
  p1: GeoPoint,
  p2: GeoPoint,
  p3: GeoPoint,
  p4: GeoPoint
): boolean {
  function ccw(a: GeoPoint, b: GeoPoint, c: GeoPoint): number {
    return (
      (c.latitude - a.latitude) * (b.longitude - a.longitude) -
      (b.latitude - a.latitude) * (c.longitude - a.longitude)
    );
  }

  return (
    ccw(p1, p3, p4) * ccw(p2, p3, p4) < 0 &&
    ccw(p1, p2, p3) * ccw(p1, p2, p4) < 0
  );
}

/**
 * Determines if a path segment from start to end intersects any edge of a polygon.
 */
export function pathCrossesPolygon(
  start: GeoPoint,
  end: GeoPoint,
  polygon: GeoPoint[]
): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (doLineSegmentsIntersect(start, end, polygon[j], polygon[i])) {
      return true;
    }
  }

  return false;
}

/**
 * Interpolates a point at fraction t (0 <= t <= 1) between start and end.
 */
export function interpolateGeoPoint(
  start: GeoPoint,
  end: GeoPoint,
  t: number
): GeoPoint {
  const clampedT = Math.max(0, Math.min(1, t));
  const lat = start.latitude + (end.latitude - start.latitude) * clampedT;
  const lon = start.longitude + (end.longitude - start.longitude) * clampedT;
  const alt =
    start.altitude !== undefined && end.altitude !== undefined
      ? start.altitude + (end.altitude - start.altitude) * clampedT
      : (end.altitude ?? start.altitude);

  return { latitude: lat, longitude: lon, altitude: alt };
}

/**
 * Calculates a new GeoPoint given start point, distance in meters, and bearing in degrees.
 */
export function destinationPoint(
  start: GeoPoint,
  distanceMeters: number,
  bearingDegrees: number
): GeoPoint {
  const d = distanceMeters / EARTH_RADIUS_METERS;
  const brng = degreesToRadians(bearingDegrees);
  const lat1 = degreesToRadians(start.latitude);
  const lon1 = degreesToRadians(start.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: radiansToDegrees(lat2),
    longitude: radiansToDegrees(lon2),
    altitude: start.altitude,
  };
}
