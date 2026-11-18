/**
 * Astronomical Solar Position and Shadow Projection Calculator
 * Implements the rigorous NOAA Solar Calculations (Jean Meeus algorithm)
 * including solar declination, hour angle, equation of time, atmospheric refraction,
 * and true solar time for arbitrary dates and times.
 *
 * Primary calibration for Pune, Maharashtra, India:
 * Latitude: 18.464° N, Longitude: 73.867° E, Timezone: UTC+05:30 (Asia/Kolkata)
 */

export const PUNE_LATITUDE = 18.464;
export const PUNE_LONGITUDE = 73.867;
export const IST_TIMEZONE_OFFSET = 5.5; // UTC+05:30

export interface SolarPosition {
  altitudeDeg: number;       // Elevation above horizon in degrees (0° = horizon, 90° = zenith)
  azimuthDeg: number;        // Angle from North clockwise (90° = East, 180° = South, 270° = West)
  shadowMultiplier: number;  // Shadow length multiplier = 1 / tan(altitude)
  shadowDirectionDeg: number;// Direction shadow is cast (opposite to solar azimuth)
  equationOfTimeMin: number; // Equation of time in minutes
  solarDeclinationDeg: number;// Solar declination in degrees
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

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateInput(input?: Date | string | DateParts): DateParts {
  if (!input) {
    return { year: 2026, month: 11, day: 18 };
  }
  if (typeof input === 'string') {
    const parts = input.split('-').map(Number);
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    return { year: 2026, month: 11, day: 18 };
  }
  if (input instanceof Date) {
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  return input;
}

/**
 * Computes exact solar position using the NOAA Solar Position Algorithm.
 */
export function calculateSolarPosition(
  hour: number,
  minute: number,
  dateInput: Date | string | DateParts = '2026-11-18',
  second = 0,
  lat = PUNE_LATITUDE,
  lon = PUNE_LONGITUDE,
  tzOffset = IST_TIMEZONE_OFFSET,
): SolarPosition {
  const { year, month, day } = parseDateInput(dateInput);

  // Time in UTC hours
  const tUtc = hour + minute / 60.0 + second / 3600.0 - tzOffset;

  // Julian Day
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5 + tUtc / 24.0;
  const T = (jd - 2451545.0) / 36525.0;

  // Geometric mean longitude of sun (deg)
  const L0 = ((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360.0 + 360.0) % 360.0;

  // Geometric mean anomaly of sun (deg & rad)
  const M = ((357.52911 + T * (35999.05029 - 0.0001537 * T)) % 360.0 + 360.0) % 360.0;
  const Mr = (M * Math.PI) / 180.0;

  // Eccentricity of Earth orbit
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Sun equation of center (deg)
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;

  // Sun true longitude (deg)
  const sunTrueLon = L0 + C;

  // Apparent longitude (deg & rad)
  const omega = 125.04 - 1934.136 * T;
  const lambdaDeg = sunTrueLon - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180.0);
  const lambdaRad = (lambdaDeg * Math.PI) / 180.0;

  // Mean obliquity of ecliptic (deg & rad)
  const eps0 = 23.0 + (26.0 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0;
  const eps = eps0 + 0.00256 * Math.cos((omega * Math.PI) / 180.0);
  const epsRad = (eps * Math.PI) / 180.0;

  // Sun declination (rad & deg)
  const sinDec = Math.sin(epsRad) * Math.sin(lambdaRad);
  const decRad = Math.asin(sinDec);
  const decDeg = (decRad * 180.0) / Math.PI;

  // Equation of time (minutes)
  const yVar = Math.tan(epsRad / 2.0) ** 2;
  const L0Rad = (L0 * Math.PI) / 180.0;
  const eotMin =
    4.0 *
    ((180.0 / Math.PI) *
      (yVar * Math.sin(2.0 * L0Rad) -
        2.0 * e * Math.sin(Mr) +
        4.0 * e * yVar * Math.sin(Mr) * Math.cos(2.0 * L0Rad) -
        0.5 * (yVar ** 2) * Math.sin(4.0 * L0Rad) -
        1.25 * (e ** 2) * Math.sin(2.0 * Mr)));

  // True solar time in minutes
  const solarTimeFix = eotMin + 4.0 * lon - 60.0 * tzOffset;
  const trueSolarTime = ((hour * 60.0 + minute + second / 60.0 + solarTimeFix) % 1440.0 + 1440.0) % 1440.0;

  // Hour angle (deg & rad)
  let haDeg = trueSolarTime / 4.0 - 180.0;
  if (haDeg < -180.0) haDeg += 360.0;
  const haRad = (haDeg * Math.PI) / 180.0;

  // Solar zenith & unrefracted altitude
  const latRad = (lat * Math.PI) / 180.0;
  const cosZenith = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const clampedCosZenith = Math.max(-1.0, Math.min(1.0, cosZenith));
  const zenithRad = Math.acos(clampedCosZenith);
  const zenithDeg = (zenithRad * 180.0) / Math.PI;
  const unrefractedAlt = 90.0 - zenithDeg;

  // Atmospheric refraction correction
  let refrDeg = 0.0;
  if (unrefractedAlt > 85.0) {
    refrDeg = 0.0;
  } else if (unrefractedAlt > 5.0) {
    const tanAlt = Math.tan((unrefractedAlt * Math.PI) / 180.0);
    refrDeg = (58.1 / tanAlt - 0.07 / (tanAlt ** 3) + 0.000086 / (tanAlt ** 5)) / 3600.0;
  } else if (unrefractedAlt > -0.575) {
    refrDeg =
      (1735.0 +
        unrefractedAlt *
          (-518.2 + unrefractedAlt * (103.4 + unrefractedAlt * (-12.79 + unrefractedAlt * 0.711)))) /
      3600.0;
  } else {
    refrDeg = (-20.774 / Math.tan((unrefractedAlt * Math.PI) / 180.0)) / 3600.0;
  }
  const altitudeDeg = Math.max(0.0, unrefractedAlt + refrDeg);

  // Solar azimuth (clockwise from North: 0=N, 90=E, 180=S, 270=W)
  const cosAz = (Math.sin(latRad) * Math.cos(zenithRad) - Math.sin(decRad)) / (Math.cos(latRad) * Math.sin(zenithRad) + 1e-9);
  const clampedCosAz = Math.max(-1.0, Math.min(1.0, cosAz));
  const azAngle = (Math.acos(clampedCosAz) * 180.0) / Math.PI;
  const azimuthDeg = haDeg > 0 ? (180.0 + azAngle) % 360.0 : ((540.0 - azAngle) % 360.0);

  // Shadow direction is directly opposite the sun
  const shadowDirectionDeg = (azimuthDeg + 180.0) % 360.0;

  // Physical shadow multiplier = 1 / tan(altitude)
  let shadowMultiplier = 3.5;
  if (altitudeDeg > 5.0) {
    shadowMultiplier = Math.min(5.0, 1.0 / Math.tan((altitudeDeg * Math.PI) / 180.0));
  }

  return {
    altitudeDeg,
    azimuthDeg,
    shadowMultiplier,
    shadowDirectionDeg,
    equationOfTimeMin: eotMin,
    solarDeclinationDeg: decDeg,
  };
}

/**
 * Returns compass heading name for angle in degrees.
 */
export function getHeadingName(deg: number): string {
  const directions = [
    'north',
    'north-northeast',
    'northeast',
    'east-northeast',
    'east',
    'east-southeast',
    'southeast',
    'south-southeast',
    'south',
    'south-southwest',
    'southwest',
    'west-southwest',
    'west',
    'west-northwest',
    'northwest',
    'north-northwest',
  ];
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return directions[idx];
}

/**
 * Generates natural language description from real computed solar numbers.
 */
export function generatePresetDescription(hour: number, minute: number, dateInput = '2026-11-18'): string {
  const pos = calculateSolarPosition(hour, minute, dateInput);
  const dir = getHeadingName(pos.shadowDirectionDeg);
  return `Sun altitude ${pos.altitudeDeg.toFixed(1)}°, azimuth ${pos.azimuthDeg.toFixed(1)}°. Ground shadows extend ${pos.shadowMultiplier.toFixed(1)}× height towards ${dir}.`;
}

/**
 * Produces preset options with dynamically computed solar descriptions.
 */
export function getSolarPresets(dateInput = '2026-11-18'): SolarTimeOption[] {
  return [
    {
      id: 'morning',
      label: 'Morning (09:30)',
      timeString: '09:30 IST',
      hour: 9,
      minute: 30,
      description: generatePresetDescription(9, 30, dateInput),
    },
    {
      id: 'noon',
      label: 'Noon (12:30)',
      timeString: '12:30 IST',
      hour: 12,
      minute: 30,
      description: generatePresetDescription(12, 30, dateInput),
    },
    {
      id: 'afternoon',
      label: 'Afternoon (15:30)',
      timeString: '15:30 IST',
      hour: 15,
      minute: 30,
      description: generatePresetDescription(15, 30, dateInput),
    },
    {
      id: 'evening',
      label: 'Late Day (17:00)',
      timeString: '17:00 IST',
      hour: 17,
      minute: 0,
      description: generatePresetDescription(17, 0, dateInput),
    },
  ];
}

export const SOLAR_PRESETS: SolarTimeOption[] = getSolarPresets('2026-11-18');

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

  // Base vertices
  const basePts =
    footprintCoords[0][0] === footprintCoords[footprintCoords.length - 1][0] &&
    footprintCoords[0][1] === footprintCoords[footprintCoords.length - 1][1]
      ? footprintCoords.slice(0, -1)
      : footprintCoords;

  // Roof projected vertices
  const roofPts = basePts.map(([lon, lat]) => [lon + dLon, lat + dLat] as [number, number]);

  // Combine into outer convex hull boundary
  return computeConvexHull([...basePts, ...roofPts]);
}

/**
 * Projects a tree crown circle displaced along shadow direction based on tree height.
 */
export function projectTreeCrownShadow(
  centerCoord: [number, number],
  radiusM: number,
  heightM: number,
  solar: SolarPosition,
): { center: [number, number]; radiusM: number } {
  const [dxM, dyM] = getShadowOffsetMetres(heightM, solar);
  const refLat = centerCoord[1];
  const mPerDegLat = 110852.0;
  const mPerDegLon = 111320.0 * Math.cos((refLat * Math.PI) / 180);

  const dLon = dxM / mPerDegLon;
  const dLat = dyM / mPerDegLat;

  return {
    center: [centerCoord[0] + dLon, centerCoord[1] + dLat],
    radiusM,
  };
}

/**
 * Monotone chain convex hull algorithm for shadow polygons.
 */
function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return [...points, points[0]];

  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const crossProduct = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

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
