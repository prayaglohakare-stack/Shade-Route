import { describe, it, expect } from 'vitest';
import {
  calculateSolarPosition,
  getShadowOffsetMetres,
  projectBuildingShadowPolygon,
} from '../routing/solarEngine';

describe('Solar Engine', () => {
  it('computes plausible solar elevation for Pune at noon', () => {
    // 12:30 IST in Pune
    const pos = calculateSolarPosition(12, 30);
    expect(pos.altitudeDeg).toBeGreaterThan(45);
    expect(pos.altitudeDeg).toBeLessThan(90);
    expect(pos.shadowMultiplier).toBeLessThan(1.2);
  });

  it('computes low solar elevation and longer shadows in late afternoon', () => {
    // 17:00 IST in Pune
    const pos = calculateSolarPosition(17, 0);
    expect(pos.altitudeDeg).toBeLessThan(25);
    expect(pos.shadowMultiplier).toBeGreaterThan(1.8);
  });

  it('calculates shadow offset coordinates', () => {
    const pos = calculateSolarPosition(15, 30);
    const [dx, dy] = getShadowOffsetMetres(6.0, pos);
    expect(Number.isFinite(dx)).toBe(true);
    expect(Number.isFinite(dy)).toBe(true);
    // In afternoon, sun is in the west/southwest, so shadow extends east/northeast (dx > 0)
    expect(dx).toBeGreaterThan(0);
  });

  it('projects building shadow polygon as convex hull extending away from sun', () => {
    const squareFootprint: [number, number][] = [
      [73.8650, 18.4630],
      [73.8652, 18.4630],
      [73.8652, 18.4632],
      [73.8650, 18.4632],
      [73.8650, 18.4630],
    ];
    const solar = calculateSolarPosition(15, 30); // afternoon
    const shadowPolygon = projectBuildingShadowPolygon(squareFootprint, 12.0, solar);

    expect(shadowPolygon.length).toBeGreaterThan(4);
    // Convex hull polygon should be closed or have distinct outer points
    const eastCoords = shadowPolygon.map((p) => p[0]);
    // Shadow should project eastward relative to the westernmost building coordinate
    expect(Math.max(...eastCoords)).toBeGreaterThan(73.8652);
  });
});
