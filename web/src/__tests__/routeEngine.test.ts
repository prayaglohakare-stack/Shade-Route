import { describe, it, expect } from 'vitest';
import {
  calculateAllRoutes,
  haversineMetres,
  edgeLength,
  snapCoordinateToNetwork,
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
      accessStatus: 'permitted',
      verificationStatus: 'field-verified',
      sourceRef: { type: 'osm', sourceId: '1' },
    },
    {
      edgeId: 'edge-BC',
      fromNodeId: 'node-B',
      toNodeId: 'node-C',
      coordinates: [[73.866, 18.463], [73.867, 18.463]],
      pathClass: 'footway',
      accessStatus: 'permitted',
      verificationStatus: 'field-verified',
      sourceRef: { type: 'osm', sourceId: '2' },
    },
    {
      edgeId: 'edge-AD',
      fromNodeId: 'node-A',
      toNodeId: 'node-D',
      coordinates: [[73.865, 18.463], [73.866, 18.4635]],
      pathClass: 'footway',
      accessStatus: 'permitted',
      verificationStatus: 'field-verified',
      sourceRef: { type: 'osm', sourceId: '3' },
    },
    {
      edgeId: 'edge-DC',
      fromNodeId: 'node-D',
      toNodeId: 'node-C',
      coordinates: [[73.866, 18.4635], [73.867, 18.463]],
      pathClass: 'footway',
      accessStatus: 'permitted',
      verificationStatus: 'field-verified',
      sourceRef: { type: 'osm', sourceId: '4' },
    },
    {
      edgeId: 'edge-Private',
      fromNodeId: 'node-A',
      toNodeId: 'node-C',
      coordinates: [[73.865, 18.463], [73.867, 18.463]],
      pathClass: 'service-road',
      accessStatus: 'restricted', // Should be excluded!
      verificationStatus: 'field-verified',
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
});
