import { describe, it, expect } from 'vitest';
import { campusRepository } from '../data/campusRepository';
import { calculateAllRoutes } from '../routing/routeEngine';

describe('Pilot Bundle & Real Route Integration', () => {
  it('lists the published pilot area in campus registry', () => {
    const campuses = campusRepository.listCampuses();
    const pilot = campuses.find((c) => c.campusId === 'in-mh-pune-chintamani-bibwewadi');
    expect(pilot).toBeDefined();
    expect(pilot?.dataStatus).toBe('published');
  });

  it('loads the full route bundle with network, shade, and landmarks', async () => {
    const result = await campusRepository.loadRouteBundle('in-mh-pune-chintamani-bibwewadi');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    const { network, shadeRecords, geoData } = result.bundle;
    expect(network.nodes.length).toBe(698);
    expect(network.edges.length).toBe(836);
    expect(shadeRecords.length).toBe(836);
    expect(geoData?.landmarks.length).toBeGreaterThanOrEqual(7);
    expect(geoData?.trees.features.length).toBe(3738);
    expect(geoData?.buildings.features.length).toBe(376);

    // Verify 5-tier height taxonomy in buildings
    const buildingProps = geoData?.buildings.features.map((f) => f.properties);
    expect(buildingProps?.length).toBe(376);
    const hasTier4 = buildingProps?.some((p) => p?.heightConfidenceTier === 'tier-4-typology-estimate');
    expect(hasTier4).toBe(true);

    // Verify shade records contain building, tree, and uncertainty metadata
    const sampleRecord = shadeRecords[0];
    expect(sampleRecord).toHaveProperty('buildingShadeFraction');
    expect(sampleRecord).toHaveProperty('treeShadeFraction');
    expect(sampleRecord).toHaveProperty('uncertainFraction');
  }, 15000);

  it('calculates real routes between Lake Town Junction and VIT Main Gate', async () => {
    const result = await campusRepository.loadRouteBundle('in-mh-pune-chintamani-bibwewadi');
    if (result.status !== 'ready') throw new Error('Bundle not ready');

    const { network, shadeRecords, geoData } = result.bundle;
    const lakeTown = geoData?.landmarks.find((l) => l.id === 'lake-town-junction');
    const vitGate = geoData?.landmarks.find((l) => l.id === 'vit-main-gate');

    expect(lakeTown).toBeDefined();
    expect(vitGate).toBeDefined();

    if (!lakeTown || !vitGate) return;

    const routeOutcome = calculateAllRoutes(
      network,
      lakeTown.nearestNodeId,
      vitGate.nearestNodeId,
      shadeRecords,
    );

    expect(routeOutcome.ok).toBe(true);
    if (!routeOutcome.ok) return;

    const { shortest, moreCanopy, balanced } = routeOutcome.routes;
    expect(shortest.metrics.distanceMetres).toBeGreaterThan(300);
    expect(shortest.metrics.distanceMetres).toBeLessThan(1200);
    expect(moreCanopy.metrics.distanceMetres).toBeGreaterThanOrEqual(shortest.metrics.distanceMetres);
    expect(balanced.metrics.distanceMetres).toBeGreaterThanOrEqual(shortest.metrics.distanceMetres);
  });
});
