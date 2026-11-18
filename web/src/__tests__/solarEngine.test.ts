import { describe, it, expect } from 'vitest';
import {
  calculateSolarPosition,
  projectBuildingShadowPolygon,
  projectTreeCrownShadow,
  getSolarPresets,
  PUNE_LATITUDE,
  PUNE_LONGITUDE,
} from '../routing/solarEngine';

describe('NOAA Solar Engine for Pune', () => {
  const dateNov18 = '2026-11-18';

  it('validates 12:30 IST reference values within 1 degree', () => {
    // Reference: altitude ~52.2°, azimuth ~184°
    const pos = calculateSolarPosition(12, 30, dateNov18, 0, PUNE_LATITUDE, PUNE_LONGITUDE);
    expect(Math.abs(pos.altitudeDeg - 52.2)).toBeLessThan(1.0);
    expect(Math.abs(pos.azimuthDeg - 184.0)).toBeLessThan(1.0);
    expect(pos.equationOfTimeMin).toBeGreaterThan(10); // EoT in mid-November is ~+14 min
  });

  it('validates 15:30 IST reference values within 1 degree', () => {
    // Reference: altitude ~30.0°, azimuth ~233.6°
    const pos = calculateSolarPosition(15, 30, dateNov18, 0, PUNE_LATITUDE, PUNE_LONGITUDE);
    expect(Math.abs(pos.altitudeDeg - 30.0)).toBeLessThan(1.0);
    expect(Math.abs(pos.azimuthDeg - 233.6)).toBeLessThan(1.0);
  });

  it('validates 17:00 IST reference values within 1 degree', () => {
    // Reference: altitude ~11.6°, azimuth ~244.9°
    const pos = calculateSolarPosition(17, 0, dateNov18, 0, PUNE_LATITUDE, PUNE_LONGITUDE);
    expect(Math.abs(pos.altitudeDeg - 11.6)).toBeLessThan(1.0);
    expect(Math.abs(pos.azimuthDeg - 244.9)).toBeLessThan(1.0);
    expect(pos.shadowMultiplier).toBeGreaterThan(3.0); // low sun produces long shadows
  });

  it('reflects seasonal variation between November winter and April summer', () => {
    // At noon (12:30 IST) in Pune:
    // 18 Nov: altitude ~52° (sun in south)
    // 25 Apr: altitude > 80° (near-zenith overhead sun)
    const winterNoon = calculateSolarPosition(12, 30, '2026-11-18');
    const summerNoon = calculateSolarPosition(12, 30, '2026-04-25');

    expect(winterNoon.altitudeDeg).toBeLessThan(60.0);
    expect(summerNoon.altitudeDeg).toBeGreaterThan(80.0);
    expect(summerNoon.shadowMultiplier).toBeLessThan(winterNoon.shadowMultiplier);
  });

  it('generates dynamic preset descriptions containing computed numbers', () => {
    const presets = getSolarPresets('2026-11-18');
    expect(presets.length).toBe(4);
    for (const p of presets) {
      expect(p.description).toMatch(/Sun altitude \d+\.\d+°, azimuth \d+\.\d+°/);
      expect(p.description).toMatch(/Ground shadows extend \d+\.\d+× height/);
    }
  });

  it('projects building shadow polygon extending opposite the solar azimuth', () => {
    const squareFootprint: [number, number][] = [
      [73.865, 18.463],
      [73.8652, 18.463],
      [73.8652, 18.4632],
      [73.865, 18.4632],
      [73.865, 18.463],
    ];
    // In afternoon, azimuth is ~234° (SW), so shadow extends toward ~54° (NE: dx > 0, dy > 0)
    const solar = calculateSolarPosition(15, 30, dateNov18);
    const shadowPolygon = projectBuildingShadowPolygon(squareFootprint, 12.0, solar);

    expect(shadowPolygon.length).toBeGreaterThan(4);
    const eastCoords = shadowPolygon.map((p) => p[0]);
    const northCoords = shadowPolygon.map((p) => p[1]);
    expect(Math.max(...eastCoords)).toBeGreaterThan(73.8652);
    expect(Math.max(...northCoords)).toBeGreaterThan(18.4632);
  });

  it('projects displaced tree crown based on tree height and shadow direction', () => {
    const center: [number, number] = [73.865, 18.463];
    const solar = calculateSolarPosition(15, 30, dateNov18);
    const treeShadow = projectTreeCrownShadow(center, 4.0, 10.0, solar);

    expect(treeShadow.radiusM).toBe(4.0);
    // Shadow center must be displaced northeast
    expect(treeShadow.center[0]).toBeGreaterThan(center[0]);
    expect(treeShadow.center[1]).toBeGreaterThan(center[1]);
  });
});
