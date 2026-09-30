import {
  GeoPoint,
  Zone,
  PropertyConfiguration,
  isPointInPolygon,
} from '@patrol/shared';

export interface ZoneMatchResult {
  inProperty: boolean;
  matchedZone: Zone | null;
  zoneType: string | null;
}

export class ZoneMatcher {
  private property: PropertyConfiguration;

  constructor(property: PropertyConfiguration) {
    this.property = property;
  }

  public updateProperty(property: PropertyConfiguration): void {
    this.property = property;
  }

  public matchLocation(location: GeoPoint): ZoneMatchResult {
    // Check if inside overall property boundary
    const inProperty =
      this.property.propertyBoundary.length < 3 ||
      isPointInPolygon(location, this.property.propertyBoundary);

    // Check specific custom zones (Restricted zones prioritized)
    let matchedZone: Zone | null = null;

    // Check RESTRICTED_ZONE first
    for (const zone of this.property.zones) {
      if (zone.type === 'RESTRICTED_ZONE') {
        if (isPointInPolygon(location, zone.polygon)) {
          matchedZone = zone;
          break;
        }
      }
    }

    // Check other zones if no restricted zone matched
    if (!matchedZone) {
      for (const zone of this.property.zones) {
        if (zone.type !== 'RESTRICTED_ZONE') {
          if (isPointInPolygon(location, zone.polygon)) {
            matchedZone = zone;
            break;
          }
        }
      }
    }

    return {
      inProperty,
      matchedZone,
      zoneType: matchedZone ? matchedZone.type : inProperty ? 'PROPERTY_ZONE' : null,
    };
  }
}
