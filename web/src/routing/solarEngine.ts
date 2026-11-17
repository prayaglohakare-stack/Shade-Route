/**
 * Solar position and shadow projection calculator for Pune, India.
 * Latitude: 18.464° N, Longitude: 73.867° E
 * Local Timezone: UTC+05:30 (Asia/Kolkata)
 */

export interface SolarPosition {
  altitudeDeg: number;  // Elevation above horizon in degrees (0° = horizon, 90° = zenith)
  azimuthDeg: number;   // Angle from North clockwise (90° = East, 180° = South, 270° = West)
  shadowMultiplier: number; // Shadow length = height * shadowMultiplier
  shadowDirectionDeg: number; // Direction shadow is cast (opposite to solar azimuth)
}

export type SolarPreset = 'morning' | 'noon' | 'afternoon' | 'evening';

export interface SolarTimeOption {
  id: SolarPreset;
  label: string;
  timeString: string;
  hour: number;
  minute: number;
  description: string;
}

export const SOLAR_PRESETS: SolarTimeOption[] = [
  {
    id: 'morning',
    label: 'Morning (09:30)',
    timeString: '09:30 IST',
    hour: 9,
    minute: 30,
    description: 'Moderate morning sun; buildings cast long shadows to west-northwest (~1.0x height), shading western sidewalks.',
  },
  {
    id: 'noon',
    label: 'Noon (12:30)',
    timeString: '12:30 IST',
    hour: 12,
    minute: 30,
    description: 'High overhead sun; building shadows are compact (~0.4x height, north), tree canopies provide primary overhead cover.',
  },
  {
    id: 'afternoon',
    label: 'Afternoon (15:30)',
    timeString: '15:30 IST',
    hour: 15,
    minute: 30,
    description: 'Angled afternoon sun; buildings cast wide shadows east-northeast (~1.3x height), shading eastern sidewalks.',
  },
  {
    id: 'evening',
    label: 'Late Day (17:00)',
    timeString: '17:00 IST',
    hour: 17,
    minute: 0,
    description: 'Low solar elevation (~18°); tall housing society blocks cast extensive shadows (~3.0x height) across full street corridors.',
  },
];

/**
 * Approximate solar position calculation for Pune (lat 18.464, lon 73.867) on average clear day.
 */
export function calculateSolarPosition(hour: number, minute: number, dayOfYear = 320): SolarPosition {
  const latDeg = 18.464;
  const lonDeg = 73.867;
  const latRad = (latDeg * Math.PI) / 180;

  // Solar declination (approximate)
  const declinationDeg = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear) * Math.PI) / 180);
  const decRad = (declinationDeg * Math.PI) / 180;

  // Local Solar Time (Standard meridian for India IST is 82.5° E)
  // Time offset in minutes = 4 * (local_lon - standard_meridian) = 4 * (73.867 - 82.5) ≈ -34.5 min
  const localSolarTimeHours = hour + minute / 60 - (4 * (82.5 - lonDeg)) / 60;
  
  // Hour angle (15° per hour from solar noon)
  const hourAngleDeg = 15 * (localSolarTimeHours - 12);
  const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

  // Solar altitude (elevation above horizon)
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitudeDeg = Math.max(0, (altitudeRad * 180) / Math.PI);

  // Solar azimuth
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altitudeRad)) / (Math.cos(latRad) * Math.cos(altitudeRad) + 1e-6);
  let azimuthDeg = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (hourAngleDeg > 0) {
    azimuthDeg = 360 - azimuthDeg;
  }

  // Shadow length multiplier: L = H / tan(alt)
  let shadowMultiplier = 0.1;
  if (altitudeDeg > 5) {
    shadowMultiplier = 1 / Math.tan(altitudeRad);
    // Cap multiplier to avoid unbounded polygons at sunset
    shadowMultiplier = Math.min(3.5, shadowMultiplier);
  } else {
    shadowMultiplier = 3.5;
  }

  // Shadow direction is opposite to sun azimuth
  const shadowDirectionDeg = (azimuthDeg + 180) % 360;

  return {
    altitudeDeg: Math.round(altitudeDeg * 10) / 10,
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
    shadowMultiplier: Math.round(shadowMultiplier * 100) / 100,
    shadowDirectionDeg: Math.round(shadowDirectionDeg * 10) / 10,
  };
}

/**
 * Calculates shadow offset in local metres (dx, dy) given height and solar position.
 */
export function getShadowOffsetMetres(heightM: number, solar: SolarPosition): [dx: number, dy: number] {
  const shadowLength = Math.max(0.5, heightM * solar.shadowMultiplier);
  const dirRad = (solar.shadowDirectionDeg * Math.PI) / 180;
  // dx = sin(dir) * length, dy = cos(dir) * length (North is +y, East is +x)
  const dx = Math.sin(dirRad) * shadowLength;
  const dy = Math.cos(dirRad) * shadowLength;
  return [dx, dy];
}

/**
 * Projects a 3D building footprint into a 2D ground shadow polygon.
 * Given building footprint coordinates [[lon, lat], ...] and height,
 * computes the ground shadow polygon cast under the given solar position.
 */
export function projectBuildingShadowPolygon(
  footprintCoords: [number, number][],
  heightM: number,
  solar: SolarPosition,
): [number, number][] {
  if (heightM <= 0 || footprintCoords.length < 3) return footprintCoords;

  const [dxM, dyM] = getShadowOffsetMetres(heightM, solar);
  const refLat = footprintCoords[0][1];
  const mPerDegLat = 110852.0;
  const mPerDegLon = 111320.0 * Math.cos((refLat * Math.PI) / 180);

  const dLon = dxM / mPerDegLon;
  const dLat = dyM / mPerDegLat;

  // Original base vertices
  const basePts = footprintCoords[0][0] === footprintCoords[footprintCoords.length - 1][0] &&
                  footprintCoords[0][1] === footprintCoords[footprintCoords.length - 1][1]
    ? footprintCoords.slice(0, -1)
    : footprintCoords;

  // Projected roof vertices
  const roofPts = basePts.map(([lon, lat]) => [lon + dLon, lat + dLat] as [number, number]);

  // Combine base vertices and roof vertices into convex hull boundary
  const allPoints = [...basePts, ...roofPts];
  return computeConvexHull(allPoints);
}

/**
 * Monotone chain convex hull algorithm to generate the outer shadow boundary.
 */
function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return [...points, points[0]];

  const sorted = [...points].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

  const crossProduct = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  // Lower hull
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Upper hull
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  hull.push(hull[0]); // Close polygon
  return hull;
}
