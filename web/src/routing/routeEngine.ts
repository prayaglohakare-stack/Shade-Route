import type { CampusEdge, CampusNode, Coordinate, RouteNetwork, ShadeRecord } from '../data/types';
import { parseDateInput } from './solarEngine';

export const DEFAULT_WALKING_SPEED_MPS = 1.25; // 1.25 m/s ≈ 4.5 km/h standard pedestrian speed

export type RouteMode = 'shortest' | 'balanced' | 'more-canopy';

export interface RouteMetrics {
  distanceMetres: number;
  walkingMinutes: number;
  combinedShadeMetres: number;
  combinedShadePercentage: number;
  buildingMetres: number;
  buildingPercentage: number;
  canopyMetres: number;
  canopyPercentage: number;
  coveredMetres: number;
  coveredPercentage: number;
  exposedMetres: number;
  exposedPercentage: number;
  unknownMetres: number;
  unknownPercentage: number;
  uncertainMetres: number;
  uncertainPercentage: number;
  detourPercentage: number; // % longer than shortest route
}

export interface ComputedRoute {
  mode: RouteMode;
  modeTitle: string;
  nodeIds: string[];
  edges: CampusEdge[];
  coordinates: Coordinate[];
  metrics: RouteMetrics;
  isCoincidentWithShortest: boolean;
  explanation: string;
}

export interface RouteComparisonResult {
  shortest: ComputedRoute;
  balanced: ComputedRoute;
  moreCanopy: ComputedRoute;
  recommendedMode: RouteMode;
  summaryExplanation: string;
  departureTimeText: string;
}

export type RouteFailure =
  | { code: 'network-unavailable'; message: string }
  | { code: 'endpoint-unavailable'; message: string }
  | { code: 'no-route'; message: string }
  | { code: 'invalid-network'; message: string };

export type RouteOutcome =
  | { ok: true; routes: RouteComparisonResult }
  | { ok: false; error: RouteFailure };

export function haversineMetres(a: Coordinate, b: Coordinate): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(b[0] - a[0]);
  const val = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(val));
}

export function edgeLength(edge: CampusEdge): number {
  let length = 0;
  for (let i = 1; i < edge.coordinates.length; i += 1) {
    length += haversineMetres(edge.coordinates[i - 1], edge.coordinates[i]);
  }
  return length;
}

export function isEdgePermitted(edge: CampusEdge): boolean {
  return (edge.accessStatus === 'osm-derived' || edge.accessStatus === 'permitted') && edge.verificationStatus !== 'closed';
}

/**
 * Snaps any [lon, lat] map point to the closest network node.
 */
export function snapCoordinateToNetwork(
  coord: Coordinate,
  network: RouteNetwork,
): { nearestNodeId: string; snappedCoordinate: Coordinate; distanceMetres: number } | null {
  if (!network.nodes || network.nodes.length === 0) return null;

  let bestNode: CampusNode | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const node of network.nodes) {
    const d = haversineMetres(coord, node.coordinates);
    if (d < bestDist) {
      bestDist = d;
      bestNode = node;
    }
  }

  if (!bestNode) return null;
  return {
    nearestNodeId: bestNode.nodeId,
    snappedCoordinate: bestNode.coordinates,
    distanceMetres: Math.round(bestDist * 10) / 10,
  };
}

export interface DynamicEdgeShade {
  combinedFrac: number;
  treeFrac: number;
  bldgFrac: number;
  unknownFrac: number;
  uncertainFrac: number;
}

/**
 * Interpolates shade fractions between the two nearest hourly slots
 * at the edge arrival time, using precomputed NOAA solar slot data.
 */
export function interpolateSlotShade(
  shade: ShadeRecord | undefined,
  arrivalMinutes: number,
  dateInput: Date | string = '2026-11-18',
): DynamicEdgeShade {
  const unknownFrac = shade?.unknownFraction ?? (shade?.status === 'unknown' ? 1.0 : 0.0);
  if (unknownFrac >= 1.0 || !shade) {
    return {
      combinedFrac: 0.0,
      treeFrac: 0.0,
      bldgFrac: 0.0,
      unknownFrac: Math.min(1.0, unknownFrac),
      uncertainFrac: shade?.uncertainFraction ?? 0.0,
    };
  }

  const { month } = parseDateInput(dateInput);
  // Match precomputed slot dates: 2026-04-25 (month 4) or 2026-11-18 (default/winter)
  const dateKey = month === 4 ? '2026-04-25' : '2026-11-18';
  const slots = shade.slots?.[dateKey];

  if (!slots || slots.length < 11) {
    // Fallback if slot array is not present (e.g. test fixtures without precomputed slots)
    const tree = shade.treeShadeFraction ?? (shade.shadeFraction ?? 0.0);
    const bldg = shade.buildingShadeFraction ?? 0.0;
    const combined = Math.min(
      1.0 - unknownFrac,
      Math.max(0.0, shade.shadeFraction ?? Math.min(1.0, tree + bldg - tree * bldg)),
    );
    return {
      combinedFrac: combined,
      treeFrac: Math.min(1.0 - unknownFrac, tree),
      bldgFrac: Math.min(1.0 - unknownFrac, bldg),
      unknownFrac,
      uncertainFrac: shade.uncertainFraction ?? 0.0,
    };
  }

  // Precomputed hourly slots: index 0 is 07:00 (420 min), index 10 is 17:00 (1020 min)
  const hourFloat = arrivalMinutes / 60.0;
  let combinedFrac = 0.0;
  let treeFrac = 0.0;
  let bldgFrac = 0.0;

  if (hourFloat <= 7.0) {
    [combinedFrac, treeFrac, bldgFrac] = slots[0];
  } else if (hourFloat >= 17.0) {
    [combinedFrac, treeFrac, bldgFrac] = slots[10];
  } else {
    // Linear interpolation between the two nearest hourly slots
    const slotIndex = Math.floor(hourFloat - 7.0);
    const t = hourFloat - 7.0 - slotIndex;
    const s0 = slots[slotIndex];
    const s1 = slots[slotIndex + 1];
    combinedFrac = s0[0] * (1.0 - t) + s1[0] * t;
    treeFrac = s0[1] * (1.0 - t) + s1[1] * t;
    bldgFrac = s0[2] * (1.0 - t) + s1[2] * t;
  }

  const maxAvail = Math.max(0.0, 1.0 - unknownFrac);
  const effectiveCombined = Math.min(maxAvail, Math.max(0.0, combinedFrac));
  const effectiveTree = Math.min(maxAvail, Math.max(0.0, treeFrac));
  const effectiveBldg = Math.min(maxAvail, Math.max(0.0, bldgFrac));

  return {
    combinedFrac: effectiveCombined,
    treeFrac: effectiveTree,
    bldgFrac: effectiveBldg,
    unknownFrac,
    uncertainFrac: shade.uncertainFraction ?? (shade.isUncertain ? effectiveBldg : 0.0),
  };
}

/**
 * Calculates time-progressed combined metrics for an edge sequence.
 * Evaluates each edge at the estimated timestamp the pedestrian reaches it!
 */
function calculateRouteMetrics(
  edges: CampusEdge[],
  shadeMap: Map<string, ShadeRecord>,
  shortestDistance: number,
  departureHour: number,
  departureMinute: number,
  walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
  dateInput: Date | string = '2026-11-18',
): RouteMetrics {
  let totalDist = 0;
  let combinedShadeDist = 0;
  let buildingDist = 0;
  let canopyDist = 0;
  let coveredDist = 0;
  let exposedDist = 0;
  let unknownDist = 0;
  let uncertainDist = 0;

  let elapsedSeconds = 0;

  for (const edge of edges) {
    const len = edgeLength(edge);
    totalDist += len;

    // Time when pedestrian arrives at this edge
    const edgeArrivalMinutes = departureHour * 60 + departureMinute + elapsedSeconds / 60;
    const isCovered = edge.pathClass === 'covered-walkway';
    const shade = shadeMap.get(edge.edgeId);
    const dynamicShade = interpolateSlotShade(shade, edgeArrivalMinutes, dateInput);

    if (dynamicShade.unknownFrac >= 1.0) {
      unknownDist += len;
    } else if (isCovered) {
      coveredDist += len;
      combinedShadeDist += len;
    } else {
      combinedShadeDist += len * dynamicShade.combinedFrac;
      buildingDist += len * dynamicShade.bldgFrac;
      canopyDist += len * dynamicShade.treeFrac;
      unknownDist += len * dynamicShade.unknownFrac;
      exposedDist += len * Math.max(0.0, 1.0 - dynamicShade.combinedFrac - dynamicShade.unknownFrac);
      uncertainDist += len * dynamicShade.uncertainFrac;
    }

    elapsedSeconds += len / walkingSpeedMps;
  }

  const distSafe = totalDist > 0 ? totalDist : 1;
  const detourPercentage = shortestDistance > 0 && totalDist > shortestDistance
    ? Math.round(((totalDist - shortestDistance) / shortestDistance) * 1000) / 10
    : 0;

  return {
    distanceMetres: Math.round(totalDist),
    walkingMinutes: Math.round((totalDist / walkingSpeedMps / 60) * 10) / 10,
    combinedShadeMetres: Math.round(combinedShadeDist),
    combinedShadePercentage: Math.round((combinedShadeDist / distSafe) * 100),
    buildingMetres: Math.round(buildingDist),
    buildingPercentage: Math.round((buildingDist / distSafe) * 100),
    canopyMetres: Math.round(canopyDist),
    canopyPercentage: Math.round((canopyDist / distSafe) * 100),
    coveredMetres: Math.round(coveredDist),
    coveredPercentage: Math.round((coveredDist / distSafe) * 100),
    exposedMetres: Math.round(exposedDist),
    exposedPercentage: Math.round((exposedDist / distSafe) * 100),
    unknownMetres: Math.round(unknownDist),
    unknownPercentage: Math.round((unknownDist / distSafe) * 100),
    uncertainMetres: Math.round(uncertainDist),
    uncertainPercentage: Math.round((uncertainDist / distSafe) * 100),
    detourPercentage,
  };
}

/**
 * Builds continuous coordinates array for polyline map rendering.
 */
function reconstructPolyline(nodeIds: string[], edges: CampusEdge[]): Coordinate[] {
  const coords: Coordinate[] = [];
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    const fromId = nodeIds[i];
    const edgePts = [...edge.coordinates];
    if (i === 0 && edge.fromNodeId !== fromId) {
      edgePts.reverse();
    }
    for (let j = (i === 0 ? 0 : 1); j < edgePts.length; j += 1) {
      coords.push(edgePts[j]);
    }
  }
  return coords;
}

/**
 * Runs Dijkstra shortest-path with edge weights reflecting combined built and natural shade,
 * dynamically interpolated at the estimated arrival time for each edge.
 */
function runDijkstra(
  network: RouteNetwork,
  originNodeId: string,
  destinationNodeId: string,
  shadeMap: Map<string, ShadeRecord>,
  mode: RouteMode,
  departureHour: number,
  departureMinute: number,
  walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
  dateInput: Date | string = '2026-11-18',
): { nodeIds: string[]; edges: CampusEdge[] } | null {
  const nodeMap = new Map<string, CampusNode>(network.nodes.map((n) => [n.nodeId, n]));
  if (!nodeMap.has(originNodeId) || !nodeMap.has(destinationNodeId)) return null;

  const adjacency = new Map<string, Array<{ next: string; edge: CampusEdge; len: number }>>();
  for (const n of network.nodes) adjacency.set(n.nodeId, []);

  for (const edge of network.edges) {
    if (!isEdgePermitted(edge)) continue;
    const len = edgeLength(edge);
    if (len <= 0) continue;

    adjacency.get(edge.fromNodeId)?.push({ next: edge.toNodeId, edge, len });
    adjacency.get(edge.toNodeId)?.push({ next: edge.fromNodeId, edge, len });
  }

  const distances = new Map<string, number>([[originNodeId, 0]]);
  const distanceMeters = new Map<string, number>([[originNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: CampusEdge }>();
  const unvisited = new Set<string>(nodeMap.keys());

  while (unvisited.size > 0) {
    let current: string | undefined;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const nid of unvisited) {
      const d = distances.get(nid) ?? Number.POSITIVE_INFINITY;
      if (d < bestDist) {
        bestDist = d;
        current = nid;
      }
    }

    if (!current || !Number.isFinite(bestDist)) break;
    if (current === destinationNodeId) break;

    unvisited.delete(current);
    const currentDistM = distanceMeters.get(current) ?? 0;
    const currentArrivalMin = (departureHour * 60 + departureMinute) + (currentDistM / walkingSpeedMps) / 60;

    for (const { next, edge, len } of adjacency.get(current) ?? []) {
      if (!unvisited.has(next)) continue;

      const isCovered = edge.pathClass === 'covered-walkway';
      const shade = shadeMap.get(edge.edgeId);
      const dynamicShade = interpolateSlotShade(shade, currentArrivalMin, dateInput);

      const combinedFrac = isCovered ? 1.0 : dynamicShade.combinedFrac;
      const shadedLen = len * combinedFrac;
      const exposedLen = Math.max(0.0, len * (1.0 - combinedFrac - dynamicShade.unknownFrac));

      let weight = len;
      if (mode === 'shortest') {
        weight = len;
      } else if (mode === 'balanced') {
        weight = exposedLen + 0.65 * shadedLen;
      } else if (mode === 'more-canopy') {
        weight = exposedLen + 0.25 * shadedLen;
      }

      const candidate = bestDist + weight;
      if (candidate < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, candidate);
        distanceMeters.set(next, currentDistM + len);
        previous.set(next, { nodeId: current, edge });
      }
    }
  }

  if (!Number.isFinite(distances.get(destinationNodeId) ?? Number.POSITIVE_INFINITY)) {
    return null;
  }

  const nodeIds = [destinationNodeId];
  const edges: CampusEdge[] = [];
  let cursor = destinationNodeId;

  while (cursor !== originNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edges.unshift(step.edge);
    cursor = step.nodeId;
    nodeIds.unshift(cursor);
  }

  return { nodeIds, edges };
}

function areRoutesIdentical(a: CampusEdge[], b: CampusEdge[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].edgeId !== b[i].edgeId) return false;
  }
  return true;
}

/**
 * Main Routing Engine: Computes and compares all 3 pedestrian route alternatives
 * integrating building-cast shadows, tree-canopy crowns, and permanent covered structures.
 */
export function calculateAllRoutes(
  network: RouteNetwork | null,
  originNodeId: string | null,
  destinationNodeId: string | null,
  shadeRecords: ShadeRecord[] = [],
  departureHour = 12,
  departureMinute = 30,
  walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
  dateInput: Date | string = '2026-11-18',
): RouteOutcome {
  if (!network || !network.nodes || network.nodes.length === 0) {
    return { ok: false, error: { code: 'network-unavailable', message: 'No pedestrian network data loaded.' } };
  }
  if (!originNodeId || !destinationNodeId) {
    return { ok: false, error: { code: 'endpoint-unavailable', message: 'Choose two distinct endpoints on the network.' } };
  }
  if (originNodeId === destinationNodeId) {
    return { ok: false, error: { code: 'endpoint-unavailable', message: 'Start and destination must be different.' } };
  }

  const shadeMap = new Map<string, ShadeRecord>(shadeRecords.map((r) => [r.edgeId, r]));
  const depTimeStr = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')} IST`;

  // 1. Calculate Shortest Route
  const shortestRaw = runDijkstra(
    network,
    originNodeId,
    destinationNodeId,
    shadeMap,
    'shortest',
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  if (!shortestRaw) {
    return { ok: false, error: { code: 'no-route', message: 'No connected pedestrian route exists between these locations.' } };
  }

  const shortestMetrics = calculateRouteMetrics(
    shortestRaw.edges,
    shadeMap,
    0,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  const shortestPoly = reconstructPolyline(shortestRaw.nodeIds, shortestRaw.edges);

  const shortestRoute: ComputedRoute = {
    mode: 'shortest',
    modeTitle: 'Shortest Distance',
    nodeIds: shortestRaw.nodeIds,
    edges: shortestRaw.edges,
    coordinates: shortestPoly,
    metrics: shortestMetrics,
    isCoincidentWithShortest: true,
    explanation: `Direct route prioritizing minimum distance (${shortestMetrics.distanceMetres} m, ~${shortestMetrics.walkingMinutes} min). Combined shade is ${shortestMetrics.combinedShadePercentage}% (Buildings: ${shortestMetrics.buildingPercentage}%, Trees: ${shortestMetrics.canopyPercentage}%).`,
  };

  // 2. Calculate More Canopy / Cooler Route (with 35% max detour guard)
  let moreCanopyRaw = runDijkstra(
    network,
    originNodeId,
    destinationNodeId,
    shadeMap,
    'more-canopy',
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  let moreCanopyEdges = moreCanopyRaw ? moreCanopyRaw.edges : shortestRaw.edges;
  let moreCanopyNodes = moreCanopyRaw ? moreCanopyRaw.nodeIds : shortestRaw.nodeIds;
  let moreCanopyMetrics = calculateRouteMetrics(
    moreCanopyEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );

  if (moreCanopyMetrics.detourPercentage > 35) {
    const balancedCandidate = runDijkstra(
      network,
      originNodeId,
      destinationNodeId,
      shadeMap,
      'balanced',
      departureHour,
      departureMinute,
      walkingSpeedMps,
      dateInput,
    );
    if (balancedCandidate) {
      moreCanopyEdges = balancedCandidate.edges;
      moreCanopyNodes = balancedCandidate.nodeIds;
      moreCanopyMetrics = calculateRouteMetrics(
        moreCanopyEdges,
        shadeMap,
        shortestMetrics.distanceMetres,
        departureHour,
        departureMinute,
        walkingSpeedMps,
        dateInput,
      );
    }
  }

  const moreCanopyIsCoincident = areRoutesIdentical(shortestRaw.edges, moreCanopyEdges);
  const moreCanopyExplanation = moreCanopyIsCoincident
    ? 'The shortest route already follows the most shaded corridor available for this destination.'
    : `Offers ${moreCanopyMetrics.combinedShadeMetres} m of combined shade (${moreCanopyMetrics.combinedShadePercentage}% of route: ${moreCanopyMetrics.buildingPercentage}% building shadow + ${moreCanopyMetrics.canopyPercentage}% tree canopy), with a +${moreCanopyMetrics.detourPercentage}% detour (${moreCanopyMetrics.distanceMetres - shortestMetrics.distanceMetres} m).`;

  const moreCanopyRoute: ComputedRoute = {
    mode: 'more-canopy',
    modeTitle: 'Cooler Way (More Shade)',
    nodeIds: moreCanopyNodes,
    edges: moreCanopyEdges,
    coordinates: reconstructPolyline(moreCanopyNodes, moreCanopyEdges),
    metrics: moreCanopyMetrics,
    isCoincidentWithShortest: moreCanopyIsCoincident,
    explanation: moreCanopyExplanation,
  };

  // 3. Calculate Balanced Route
  let balancedRaw = runDijkstra(
    network,
    originNodeId,
    destinationNodeId,
    shadeMap,
    'balanced',
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  let balancedEdges = balancedRaw ? balancedRaw.edges : shortestRaw.edges;
  let balancedNodes = balancedRaw ? balancedRaw.nodeIds : shortestRaw.nodeIds;
  let balancedMetrics = calculateRouteMetrics(
    balancedEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );

  if (balancedMetrics.detourPercentage > 15) {
    balancedEdges = shortestRaw.edges;
    balancedNodes = shortestRaw.nodeIds;
    balancedMetrics = shortestMetrics;
  }

  const balancedIsCoincident = areRoutesIdentical(shortestRaw.edges, balancedEdges);
  const balancedExplanation = balancedIsCoincident
    ? 'Identical to shortest route; no intermediate shaded corridor exists within a 15% distance limit.'
    : `Balanced route balances walking effort (+${balancedMetrics.detourPercentage}% distance) with ${balancedMetrics.combinedShadePercentage}% combined shade (${balancedMetrics.buildingPercentage}% buildings, ${balancedMetrics.canopyPercentage}% trees).`;

  const balancedRoute: ComputedRoute = {
    mode: 'balanced',
    modeTitle: 'Balanced Route',
    nodeIds: balancedNodes,
    edges: balancedEdges,
    coordinates: reconstructPolyline(balancedNodes, balancedEdges),
    metrics: balancedMetrics,
    isCoincidentWithShortest: balancedIsCoincident,
    explanation: balancedExplanation,
  };

  // Recommendation logic
  let recommendedMode: RouteMode = 'shortest';
  let summaryExplanation = '';

  if (!moreCanopyIsCoincident && moreCanopyMetrics.combinedShadePercentage >= shortestMetrics.combinedShadePercentage + 12 && moreCanopyMetrics.detourPercentage <= 25) {
    recommendedMode = 'more-canopy';
    summaryExplanation = `Recommended: Cooler route provides significantly more shade (${moreCanopyMetrics.combinedShadePercentage}% vs ${shortestMetrics.combinedShadePercentage}%) combining building shadows and tree crowns for a +${moreCanopyMetrics.detourPercentage}% distance difference.`;
  } else if (!balancedIsCoincident && balancedMetrics.combinedShadePercentage >= shortestMetrics.combinedShadePercentage + 6) {
    recommendedMode = 'balanced';
    summaryExplanation = `Recommended: Balanced route offers improved combined shade (+${balancedMetrics.combinedShadePercentage - shortestMetrics.combinedShadePercentage}%) with minimal extra distance.`;
  } else {
    recommendedMode = 'shortest';
    summaryExplanation = `Recommended: Shortest route is optimal. Alternative streets do not offer enough extra combined shade to justify the added walking distance.`;
  }

  return {
    ok: true,
    routes: {
      shortest: shortestRoute,
      balanced: balancedRoute,
      moreCanopy: moreCanopyRoute,
      recommendedMode,
      summaryExplanation,
      departureTimeText: depTimeStr,
    },
  };
}
