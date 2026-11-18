import { describe, it, expect } from 'vitest';
import { DEMO_TRIPS } from '../data/demoTrips';
import { campusRepository } from '../data/campusRepository';
import { calculateAllRoutes } from '../routing/routeEngine';

describe('Curated Demo Trips Verification', () => {
  it('defines exactly 4 curated demo trips (3 cooler wins, 1 shortest optimal)', () => {
    expect(DEMO_TRIPS.length).toBe(4);

    const coolerWins = DEMO_TRIPS.filter((t) => t.tag === 'cooler-win');
    const shortestOptimal = DEMO_TRIPS.filter((t) => t.tag === 'shortest-optimal');

    expect(coolerWins.length).toBe(3);
    expect(shortestOptimal.length).toBe(1);
  });

  it('evaluates all 4 demo trips on the real Bibwewadi network and verifies honest behavior', async () => {
    const result = await campusRepository.loadRouteBundle('in-mh-pune-chintamani-bibwewadi');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    const { network, shadeRecords } = result.bundle;

    for (const trip of DEMO_TRIPS) {
      const outcome = calculateAllRoutes(
        network,
        trip.origin.nodeId,
        trip.destination.nodeId,
        shadeRecords,
        12, // 12:30 IST solar noon
        30,
        undefined,
        '2026-11-18',
      );

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;

      const { routes } = outcome;
      expect(routes.shortest.metrics.distanceMetres).toBeGreaterThanOrEqual(400);

      if (trip.tag === 'cooler-win') {
        // Cooler route must clearly win
        expect(routes.recommendedMode).toBe('more-canopy');
        expect(routes.moreCanopy.metrics.sunMinutesSavedVsShortest).toBeGreaterThanOrEqual(1.0);
        expect(routes.moreCanopy.metrics.detourPercentage).toBeLessThanOrEqual(25);
        expect(routes.moreCanopy.isCoincidentWithShortest).toBe(false);
      } else {
        // Shortest route is optimal or about as shaded
        expect(routes.recommendedMode).toBe('shortest');
        expect(routes.moreCanopy.metrics.sunMinutesSavedVsShortest).toBeLessThan(1.0);
        expect(routes.summaryExplanation).toMatch(/about as shaded/i);
      }
    }
  }, 20000);
});
