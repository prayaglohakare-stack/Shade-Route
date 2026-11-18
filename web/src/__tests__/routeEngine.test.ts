import { describe, it, expect } from 'vitest';
import {
  calculateAllRoutes,
  haversineMetres,
  edgeLength,
  snapCoordinateToNetwork,
  interpolateSlotShade,
  resolveSeasonDateKey,
  MinHeap,
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

  it('validates MinHeap priority queue ordering', () => {
    const heap = new MinHeap<string>();
    heap.push(50, 'fifty');
    heap.push(10, 'ten');
    heap.push(30, 'thirty');
    heap.push(5, 'five');
    heap.push(20, 'twenty');

    expect(heap.size).toBe(5);
    expect(heap.pop()?.value).toBe('five');
    expect(heap.pop()?.value).toBe('ten');
    expect(heap.pop()?.value).toBe('twenty');
    expect(heap.pop()?.value).toBe('thirty');
    expect(heap.pop()?.value).toBe('fifty');
    expect(heap.isEmpty()).toBe(true);
  });

  it('strictly enforces <= 25% detour constraint on cooler route', () => {
    // Add an extreme detour node E that is 100% shaded but has a 40% detour
    const nodesWithE: CampusNode[] = [
      ...sampleNodes,
      { nodeId: 'node-E', coordinates: [73.866, 18.465] }, // 40%+ longer detour
    ];
    const edgesWithE: CampusEdge[] = [
      ...sampleEdges,
      {
        edgeId: 'edge-AE',
        fromNodeId: 'node-A',
        toNodeId: 'node-E',
        coordinates: [[73.865, 18.463], [73.866, 18.465]],
        pathClass: 'footway',
        accessStatus: 'osm-derived',
        verificationStatus: 'unverified',
        sourceRef: { type: 'osm', sourceId: '6' },
      },
      {
        edgeId: 'edge-EC',
        fromNodeId: 'node-E',
        toNodeId: 'node-C',
        coordinates: [[73.866, 18.465], [73.867, 18.463]],
        pathClass: 'footway',
        accessStatus: 'osm-derived',
        verificationStatus: 'unverified',
        sourceRef: { type: 'osm', sourceId: '7' },
      },
    ];
    const shadeWithE: ShadeRecord[] = [
      ...sampleShade,
      { edgeId: 'edge-AE', status: 'modeled', shadeFraction: 1.0, buildingShadeFraction: 1.0, treeShadeFraction: 1.0 },
      { edgeId: 'edge-EC', status: 'modeled', shadeFraction: 1.0, buildingShadeFraction: 1.0, treeShadeFraction: 1.0 },
    ];

    const netWithE: RouteNetwork = {
      schemaVersion: 1,
      campusId: 'test-pilot',
      dataRevision: 1,
      nodes: nodesWithE,
      edges: edgesWithE,
    };

    const result = calculateAllRoutes(netWithE, 'node-A', 'node-C', shadeWithE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Cooler route detour must never exceed 25%
    expect(result.routes.moreCanopy.metrics.detourPercentage).toBeLessThanOrEqual(25);
    // AE+EC is ~40% detour, so it must NOT be selected despite being 100% shaded!
    const coolerEdgeIds = result.routes.moreCanopy.edges.map((e) => e.edgeId);
    expect(coolerEdgeIds).not.toContain('edge-AE');
  });

  it('honestly states shortest route is about as shaded when savings < 1.0 minute', () => {
    // If the shaded detour saves less than 1.0 minute of direct sun,
    // it must state "Shortest route is already about as shaded" and recommend shortest.
    const minimalSavingsShade: ShadeRecord[] = [
      { edgeId: 'edge-AB', status: 'modeled', shadeFraction: 0.60, treeShadeFraction: 0.60 },
      { edgeId: 'edge-BC', status: 'modeled', shadeFraction: 0.60, treeShadeFraction: 0.60 },
      { edgeId: 'edge-AD', status: 'modeled', shadeFraction: 0.70, treeShadeFraction: 0.70 },
      { edgeId: 'edge-DC', status: 'modeled', shadeFraction: 0.70, treeShadeFraction: 0.70 },
    ];

    const result = calculateAllRoutes(network, 'node-A', 'node-C', minimalSavingsShade);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Sun savings is < 1 min, so shortest must be recommended!
    expect(result.routes.recommendedMode).toBe('shortest');
    expect(result.routes.summaryExplanation).toContain('Shortest route is already about as shaded');
  });

  it('Phase A (a): a route through unknown edges can never show fewer sun-minutes than the same route with those edges counted as sunny', () => {
    // Edge with unknownFraction = 1.0
    const shadeWithUnknown: ShadeRecord[] = [
      { edgeId: 'edge-AB', status: 'unknown', shadeFraction: 0.0, unknownFraction: 1.0 },
      { edgeId: 'edge-BC', status: 'unknown', shadeFraction: 0.0, unknownFraction: 1.0 },
      { edgeId: 'edge-AD', status: 'modeled', shadeFraction: 0.8, treeShadeFraction: 0.8 },
      { edgeId: 'edge-DC', status: 'modeled', shadeFraction: 0.8, treeShadeFraction: 0.8 },
    ];

    // Reference shade where AB and BC are explicitly 100% exposed/sunny
    const shadeWithSunny: ShadeRecord[] = [
      { edgeId: 'edge-AB', status: 'modeled', shadeFraction: 0.0, unknownFraction: 0.0 },
      { edgeId: 'edge-BC', status: 'modeled', shadeFraction: 0.0, unknownFraction: 0.0 },
      { edgeId: 'edge-AD', status: 'modeled', shadeFraction: 0.8, treeShadeFraction: 0.8 },
      { edgeId: 'edge-DC', status: 'modeled', shadeFraction: 0.8, treeShadeFraction: 0.8 },
    ];

    const resultUnknown = calculateAllRoutes(network, 'node-A', 'node-C', shadeWithUnknown);
    const resultSunny = calculateAllRoutes(network, 'node-A', 'node-C', shadeWithSunny);

    expect(resultUnknown.ok).toBe(true);
    expect(resultSunny.ok).toBe(true);
    if (!resultUnknown.ok || !resultSunny.ok) return;

    // Unknown route headline sun-minutes must be >= sunny route sun-minutes (never fewer sun minutes!)
    expect(resultUnknown.routes.shortest.metrics.sunMinutes).toBeGreaterThanOrEqual(
      resultSunny.routes.shortest.metrics.sunMinutes,
    );
    // Headline pessimistic sun-minutes must equal fully sunny exposure
    expect(resultUnknown.routes.shortest.metrics.sunMinutes).toBe(
      resultSunny.routes.shortest.metrics.sunMinutes,
    );
    // Range must reflect optimistic vs pessimistic: optimistic <= pessimistic
    expect(resultUnknown.routes.shortest.metrics.sunMinutesOptimistic).toBeLessThanOrEqual(
      resultUnknown.routes.shortest.metrics.sunMinutes,
    );
    expect(resultUnknown.routes.shortest.metrics.sunMinutesRange).toContain('–');
  });

  it('Phase A (b): changing departure time changes both route metrics and slot shade consistently', () => {
    // Generate precomputed slot shade records for test edges
    const hourlySlotsNov: [number, number, number][] = [
      [0.85, 0.40, 0.70], // 07:00
      [0.75, 0.35, 0.60], // 08:00
      [0.60, 0.30, 0.45], // 09:00
      [0.45, 0.25, 0.30], // 10:00
      [0.30, 0.20, 0.15], // 11:00
      [0.20, 0.15, 0.10], // 12:00
      [0.25, 0.18, 0.12], // 13:00
      [0.40, 0.25, 0.25], // 14:00
      [0.55, 0.30, 0.40], // 15:00
      [0.70, 0.35, 0.55], // 16:00
      [0.85, 0.40, 0.70], // 17:00
    ];

    const slotShade: ShadeRecord[] = [
      { edgeId: 'edge-AB', status: 'modeled', shadeFraction: 0.2, slots: { '2026-11-18': hourlySlotsNov, '2026-04-25': hourlySlotsNov } },
      { edgeId: 'edge-BC', status: 'modeled', shadeFraction: 0.2, slots: { '2026-11-18': hourlySlotsNov, '2026-04-25': hourlySlotsNov } },
      { edgeId: 'edge-AD', status: 'modeled', shadeFraction: 0.6, slots: { '2026-11-18': hourlySlotsNov, '2026-04-25': hourlySlotsNov } },
      { edgeId: 'edge-DC', status: 'modeled', shadeFraction: 0.6, slots: { '2026-11-18': hourlySlotsNov, '2026-04-25': hourlySlotsNov } },
    ];

    const morningResult = calculateAllRoutes(network, 'node-A', 'node-C', slotShade, 9, 30);
    const noonResult = calculateAllRoutes(network, 'node-A', 'node-C', slotShade, 12, 30);
    const afternoonResult = calculateAllRoutes(network, 'node-A', 'node-C', slotShade, 16, 30);

    expect(morningResult.ok).toBe(true);
    expect(noonResult.ok).toBe(true);
    expect(afternoonResult.ok).toBe(true);
    if (!morningResult.ok || !noonResult.ok || !afternoonResult.ok) return;

    // Direct sun minutes at noon must be higher than morning and late afternoon
    expect(noonResult.routes.shortest.metrics.sunMinutes).toBeGreaterThan(
      morningResult.routes.shortest.metrics.sunMinutes,
    );
    expect(noonResult.routes.shortest.metrics.sunMinutes).toBeGreaterThan(
      afternoonResult.routes.shortest.metrics.sunMinutes,
    );
  });

  it('Phase A (c): arrival after 17:00 is handled explicitly and clamps with visible note', () => {
    // Departure at 16:55 with a walk that extends past 17:00
    const result = calculateAllRoutes(network, 'node-A', 'node-C', sampleShade, 16, 58, 0.5); // slow speed so walk takes > 5 min
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Must flag arrival after 17:00
    expect(result.routes.shortest.metrics.isArrivalAfter17).toBe(true);
    expect(result.routes.shortest.explanation).toContain('17:00 IST');
  });

  it('Phase A (6): season control strictly supports Nov and Apr, throws on uncalibrated dates', () => {
    expect(resolveSeasonDateKey('2026-11-18')).toBe('2026-11-18');
    expect(resolveSeasonDateKey('2026-04-25')).toBe('2026-04-25');
    expect(resolveSeasonDateKey(new Date('2026-11-05T12:00:00Z'))).toBe('2026-11-18');
    expect(resolveSeasonDateKey(new Date('2026-04-10T12:00:00Z'))).toBe('2026-04-25');

    // Any other month/season must throw an explicit error rather than silently falling back
    expect(() => resolveSeasonDateKey('2026-07-15')).toThrow(
      /Uncalibrated solar season month/,
    );
  });
});
