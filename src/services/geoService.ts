import { JAKARTA_BOUNDARIES, type Polygon } from "../data/jakartaBoundaries.js";

// Ray-casting algorithm for point-in-polygon test
function pointInPolygon(lng: number, lat: number, polygon: Polygon): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Determines which Jakarta kota administrasi a coordinate falls in.
 * Returns the wilayah code (e.g., "jakarta_selatan") or null if outside Jakarta.
 */
export function getWilayah(lat: number, lng: number): string | null {
  for (const entry of JAKARTA_BOUNDARIES) {
    for (const polygon of entry.polygons) {
      if (pointInPolygon(lng, lat, polygon)) {
        return entry.wilayah;
      }
    }
  }
  return null;
}
