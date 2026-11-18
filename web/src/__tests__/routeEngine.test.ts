import { describe, it, expect } from 'vitest';
import {
  calculateAllRoutes,
  haversineMetres,
  edgeLength,
  snapCoordinateToNetwork,
  interpolateSlotShade,
} from '../routing/routeEngine';
import type { CampusEdge, CampusNode, RouteNetwork, ShadeRecord } from '../data/types';

describe('Route Engine', () => {
  const sampleNodes: CampusNode[] = [
    { nodeId: 'node-A', coordinates: [73.865, 18.463] },
    { nodeId: 'node-B', coordinates: [73.866, 18.463] },
    { nodeId: 'node-C', coordinates: [73.867, 18.463] },
    { nodeId: 'node-D', coordinates: [73.866, 18.4635] },
    { nodeId: 'node-Isolated', coordinates: [73.870, 18.470] },
  ];

  // Path 1 (direct A -> B -> C): length ~ 211m, exposed
  // Path 2 (shaded detour A -> D -> C): length ~ 237m (+12% detour), shaded
  const sampleEdges: CampusEdge[] = [
    {
      edgeId: 'edge-AB',
      fromNodeId: 'node-A',
      toNodeId: 'node-B',
      coordinates: [[73.865, 18.463], [73.866, 18.463]],
      pathClass: 'footway',
      accessStatus: 'osm-derived',
      verificationStatus: 'unverified',
      sourceRef: { type: 'osm', sourceId: '1' },
    },
    {
      edgeId: 'edge-BC',
      fromNodeId: 'node-B',
      toNodeId: 'node-C',
      coordinates: [[73.866, 18.463], [73.867, 18.463]],
      pathClass: 'footway',
      accessStatus: 'osm-derived',
      verificationStatus: 'unverified',
      sourceRef: { type: 'osm', sourceId: '2' },
    },
    {
      edgeId: 'edge-AD',
      fromNodeId: 'node-A',
      toNodeId: 'node-D',
      coordinates: [[73.865, 18.463], [73.866, 18.4635]],
      pathClass: 'footway',
      accessStatus: 'osm-derived',
      verificationStatus: 'unverified',
      sourceRef: { type: 'osm', sourceId: '3' },
    },
    {
      edgeId: 'edge-DC',
      fromNodeId: 'node-D',
      toNodeId: 'node-C',
      coordinates: [[73.866, 18.4635], [73.867, 18.463]],
      pathClass: 'footway',
      accessStatus: 'osm-derived',
      verificationStatus: 'unverified',
      sourceRef: { type: 'osm', sourceId: '4' },
    },
    {
      edgeId: 'edge-Private',
      fromNodeId: 'node-A',
      toNodeId: 'node-C',
      coordinates: [[73.865, 18.463], [73.867, 18.463]],
      pathClass: 'service-road',
      accessStatus: 'restricted', // Should be excluded!
      verificationStatus: 'unverified',
      sourceRef: { type: 'osm', sourceId: '5' },
    },
  ];

  const sampleShade: ShadeRecord[] = [
    {
      edgeId: 'edge-AB',
      status: 'modeled',
      shadeFraction: 0.1,
      buildingShadeFraction: 0.05,
      treeShadeFraction: 0.05,
      confidence: 'model-calibrated',
      isUncertain: false,
    },
    {
      edgeId: 'edge-BC',
      status: 'modeled',
      shadeFraction: 0.1,
      buildingShadeFraction: 0.05,
      treeShadeFraction: 0.05,
      confidence: 'model-calibrated',
      isUncertain: false,
    },
    {
      edgeId: 'edge-AD',
      status: 'modeled',
      shadeFraction: 0.88,
      buildingShadeFraction: 0.60,
      treeShadeFraction: 0.70, // 0.60 + 0.70 - 0.42 = 0.88 (strict non-double-counting union)
      uncertainFraction: 0.60,
      confidence: 'model-calibrated',
      isUncertain: true, // building height is Tier 4
    },
    {
      edgeId: 'edge-DC',
      status: 'modeled',
      shadeFraction: 0.85,
      buildingShadeFraction: 0.50,
      treeShadeFraction: 0.70,
      uncertainFraction: 0.50,
      confidence: 'model-calibrated',
      isUncertain: true,
    },
  ];

  const network: RouteNetwork = {
    schemaVersion: 1,
    campusId: 'test-pilot',
    dataRevision: 1,
    nodes: sampleNodes,
    edges: sampleEdges,
  };

  it('calculates Haversine distance correctly', () => {
    const dist = haversineMetres([73.865, 18.463], [73.866, 18.463]);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(110);
  });

  it('computes edge lengths', () => {
    const len = edgeLength(sampleEdges[0]);
    expect(len).toBeGreaterThan(100);
    expect(len).toBeLessThan(110);
  });

  it('excludes restricted edges', () => {
    // edge-Private connects A directly to C, but is restricted.
    // Shortest path should use A->B->C, not A->C.
    const result = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const shortestEdgeIds = result.routes.shortest.edges.map((e) => e.edgeId);
    expect(shortestEdgeIds).not.toContain('edge-Private');
    expect(shortestEdgeIds).toEqual(['edge-AB', 'edge-BC']);
  });

  it('finds cooler detour with higher canopy coverage when beneficial', () => {
    const result = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { shortest, moreCanopy } = result.routes;

    // Shortest uses AB + BC (mostly exposed)
    expect(shortest.metrics.canopyPercentage).toBeLessThan(20);

    // More Canopy route should use AD + DC
    expect(moreCanopy.edges.map((e) => e.edgeId)).toEqual(['edge-AD', 'edge-DC']);
    expect(moreCanopy.metrics.canopyPercentage).toBeGreaterThan(60);
    expect(moreCanopy.metrics.buildingPercentage).toBeGreaterThan(40);
    expect(moreCanopy.metrics.combinedShadePercentage).toBeGreaterThan(80);
    expect(moreCanopy.isCoincidentWithShortest).toBe(false);
  });

  it('correctly tracks building, canopy, covered, and uncertainty metrics without double-counting', () => {
    const result = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade, 9, 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { moreCanopy } = result.routes;
    // Strict union check: combined percentage should be <= 100% and <= building + canopy
    expect(moreCanopy.metrics.combinedShadePercentage).toBeLessThanOrEqual(100);
    expect(moreCanopy.metrics.combinedShadePercentage).toBeLessThan(
      moreCanopy.metrics.buildingPercentage + moreCanopy.metrics.canopyPercentage
    );
    // AD and DC are marked isUncertain: true with uncertain fractions of 0.60 and 0.50
    expect(moreCanopy.metrics.uncertainPercentage).toBeGreaterThan(45);
    expect(moreCanopy.metrics.uncertainPercentage).toBeLessThan(70);
  });

  it('evaluates dynamic route progression across departure times', () => {
    const morningResult = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade, 9, 30);
    const afternoonResult = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade, 15, 30);

    expect(morningResult.ok).toBe(true);
    expect(afternoonResult.ok).toBe(true);
  });

  it('reports error when endpoints are disconnected', () => {
    const result = calculateAllRoutes(network, 'node-A', 'node-Isolated', sampleShade);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('no-route');
  });

  it('snaps coordinates to nearest network node', () => {
    const snap = snapCoordinateToNetwork([73.86501, 18.46301], network);
    expect(snap).not.toBeNull();
    expect(snap?.nearestNodeId).toBe('node-A');
    expect(snap?.distanceMetres).toBeLessThan(5);
  });

  it('interpolates hourly slots linearly at edge arrival time', () => {
    const slottedRecord: ShadeRecord = {
      edgeId: 'edge-slot-test',
      status: 'modeled',
      slots: {
        '2026-11-18': [
          [0.10, 0.05, 0.05], // 07:00 (index 0)
          [0.20, 0.10, 0.10], // 08:00 (index 1)
          [0.30, 0.15, 0.15], // 09:00 (index 2)
          [0.40, 0.20, 0.20], // 10:00 (index 3)
          [0.50, 0.25, 0.25], // 11:00 (index 4)
          [0.60, 0.30, 0.30], // 12:00 (index 5)
          [0.80, 0.40, 0.40], // 13:00 (index 6)
          [0.70, 0.35, 0.35], // 14:00 (index 7)
          [0.50, 0.25, 0.25], // 15:00 (index 8)
          [0.30, 0.15, 0.15], // 16:00 (index 9)
          [0.10, 0.05, 0.05], // 17:00 (index 10)
        ],
      },
    };

    // Exactly at 12:00 (720 min) -> slot 5: [0.60, 0.30, 0.30]
    const at12 = interpolateSlotShade(slottedRecord, 12 * 60, '2026-11-18');
    expect(at12.combinedFrac).toBeCloseTo(0.60, 2);
    expect(at12.treeFrac).toBeCloseTo(0.30, 2);
    expect(at12.bldgFrac).toBeCloseTo(0.30, 2);

    // Exactly at 13:00 (780 min) -> slot 6: [0.80, 0.40, 0.40]
    const at13 = interpolateSlotShade(slottedRecord, 13 * 60, '2026-11-18');
    expect(at13.combinedFrac).toBeCloseTo(0.80, 2);

    // At 12:30 (750 min) -> midpoint between 12:00 (0.60) and 13:00 (0.80) = 0.70
    const at1230 = interpolateSlotShade(slottedRecord, 12 * 60 + 30, '2026-11-18');
    expect(at1230.combinedFrac).toBeCloseTo(0.70, 2);
    expect(at1230.treeFrac).toBeCloseTo(0.35, 2);
    expect(at1230.bldgFrac).toBeCloseTo(0.35, 2);

    // Clamping: before 07:00 (e.g. 06:00) clamps to slot 0
    const early = interpolateSlotShade(slottedRecord, 6 * 60, '2026-11-18');
    expect(early.combinedFrac).toBeCloseTo(0.10, 2);

    // Clamping: after 17:00 (e.g. 18:00) clamps to slot 10
    const late = interpolateSlotShade(slottedRecord, 18 * 60, '2026-11-18');
    expect(late.combinedFrac).toBeCloseTo(0.10, 2);
  });

  it('respects unknown status and bounds shade by available coverage', () => {
    const unknownRecord: ShadeRecord = {
      edgeId: 'edge-unknown-test',
      status: 'unknown',
      unknownFraction: 1.0,
      slots: {
        '2026-11-18': Array(11).fill([0.5, 0.3, 0.2]),
      },
    };

    const result = interpolateSlotShade(unknownRecord, 12 * 60, '2026-11-18');
    expect(result.unknownFrac).toBe(1.0);
    expect(result.combinedFrac).toBe(0.0);
    expect(result.treeFrac).toBe(0.0);
    expect(result.bldgFrac).toBe(0.0);
  });
});
