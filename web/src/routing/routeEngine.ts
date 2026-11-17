import type { CampusEdge, CampusNode, Coordinate, RouteNetwork, ShadeRecord } from '../data/types';
import { calculateSolarPosition, type SolarPosition } from './solarEngine';

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
  return edge.accessStatus === 'permitted' && edge.verificationStatus !== 'closed';
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
): RouteMetrics {
  let totalDist = 0;
  let combinedShadeDist = 0;
  let buildingDist = 0;
  let canopyDist = 0;
  let coveredDist = 0;
  let exposedDist = 0;
  let uncertainDist = 0;

  let elapsedSeconds = 0;

  for (const edge of edges) {
    const len = edgeLength(edge);
    totalDist += len;

    // Time when pedestrian arrives at this edge
    const edgeArrivalMinutes = (departureHour * 60 + departureMinute) + elapsedSeconds / 60;
    const currentHour = Math.floor((edgeArrivalMinutes / 60) % 24);
    const currentMin = Math.floor(edgeArrivalMinutes % 60);

    const solarPos = calculateSolarPosition(currentHour, currentMin);
    const isCovered = edge.pathClass === 'covered-walkway';
    const shade = shadeMap.get(edge.edgeId);

    // Baseline fractions from bundle
    let treeFrac = shade?.treeShadeFraction ?? (shade?.shadeFraction ?? 0.0);
    let bldgFrac = shade?.buildingShadeFraction ?? 0.0;
    let uncertainFrac = shade?.uncertainFraction ?? (shade?.isUncertain ? (shade?.buildingShadeFraction ?? 0.0) : 0.0);

    // Dynamic solar altitude scaling for building shadows:
    // When sun is lower (morning/afternoon), building shadows stretch proportionally
    // At noon (altitude ~68°), multiplier is ~0.4. At morning (46°), multiplier is ~1.0 (+150% shadow stretch!)
    const noonMultiplier = 0.4;
    const currentMultiplier = solarPos.shadowMultiplier;
    const shadowStretchFactor = Math.min(2.5, Math.max(0.6, currentMultiplier / noonMultiplier));
    const dynamicBldgFrac = Math.min(1.0, bldgFrac * shadowStretchFactor);

    if (isCovered) {
      coveredDist += len;
      combinedShadeDist += len;
    } else {
      // Non-double-counting union of building shadow and tree canopy
      // Overlap formula: Union(A, B) = A + B - (A * B)
      const combinedFrac = Math.min(1.0, dynamicBldgFrac + treeFrac - (dynamicBldgFrac * treeFrac));
      
      const edgeCombinedShade = len * combinedFrac;
      combinedShadeDist += edgeCombinedShade;
      buildingDist += len * dynamicBldgFrac;
      canopyDist += len * treeFrac;
      exposedDist += len * (1.0 - combinedFrac);
      uncertainDist += len * uncertainFrac;
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
 * Runs Dijkstra shortest-path with edge weights reflecting combined built and natural shade.
 */
function runDijkstra(
  network: RouteNetwork,
  originNodeId: string,
  destinationNodeId: string,
  shadeMap: Map<string, ShadeRecord>,
  mode: RouteMode,
  solarPos: SolarPosition,
): { nodeIds: string[]; edges: CampusEdge[] } | null {
  const nodeMap = new Map<string, CampusNode>(network.nodes.map((n) => [n.nodeId, n]));
  if (!nodeMap.has(originNodeId) || !nodeMap.has(destinationNodeId)) return null;

  const adjacency = new Map<string, Array<{ next: string; edge: CampusEdge; weight: number }>>();
  for (const n of network.nodes) adjacency.set(n.nodeId, []);

  const noonMultiplier = 0.4;
  const shadowStretchFactor = Math.min(2.5, Math.max(0.6, solarPos.shadowMultiplier / noonMultiplier));

  for (const edge of network.edges) {
    if (!isEdgePermitted(edge)) continue;

    const len = edgeLength(edge);
    if (len <= 0) continue;

    const isCovered = edge.pathClass === 'covered-walkway';
    const shade = shadeMap.get(edge.edgeId);

    const treeFrac = shade?.treeShadeFraction ?? (shade?.shadeFraction ?? 0.0);
    const bldgFrac = Math.min(1.0, (shade?.buildingShadeFraction ?? 0.0) * shadowStretchFactor);

    // Combined union fraction without double counting
    const combinedFrac = isCovered ? 1.0 : Math.min(1.0, bldgFrac + treeFrac - (bldgFrac * treeFrac));
    const shadedLen = len * combinedFrac;
    const exposedLen = len - shadedLen;

    let weight = len;
    if (mode === 'shortest') {
      weight = len;
    } else if (mode === 'balanced') {
      // 35% discount for combined building + tree shaded sections
      weight = exposedLen + 0.65 * shadedLen;
    } else if (mode === 'more-canopy') {
      // 75% discount for combined building + tree shaded sections
      weight = exposedLen + 0.25 * shadedLen;
    }

    adjacency.get(edge.fromNodeId)?.push({ next: edge.toNodeId, edge, weight });
    adjacency.get(edge.toNodeId)?.push({ next: edge.fromNodeId, edge, weight });
  }

  const distances = new Map<string, number>([[originNodeId, 0]]);
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

    for (const { next, edge, weight } of adjacency.get(current) ?? []) {
      if (!unvisited.has(next)) continue;
      const candidate = bestDist + weight;
      if (candidate < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, candidate);
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
  const departureSolarPos = calculateSolarPosition(departureHour, departureMinute);
  const depTimeStr = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')} IST`;

  // 1. Calculate Shortest Route
  const shortestRaw = runDijkstra(network, originNodeId, destinationNodeId, shadeMap, 'shortest', departureSolarPos);
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
  let moreCanopyRaw = runDijkstra(network, originNodeId, destinationNodeId, shadeMap, 'more-canopy', departureSolarPos);
  let moreCanopyEdges = moreCanopyRaw ? moreCanopyRaw.edges : shortestRaw.edges;
  let moreCanopyNodes = moreCanopyRaw ? moreCanopyRaw.nodeIds : shortestRaw.nodeIds;
  let moreCanopyMetrics = calculateRouteMetrics(
    moreCanopyEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
  );

  if (moreCanopyMetrics.detourPercentage > 35) {
    const balancedCandidate = runDijkstra(network, originNodeId, destinationNodeId, shadeMap, 'balanced', departureSolarPos);
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
  let balancedRaw = runDijkstra(network, originNodeId, destinationNodeId, shadeMap, 'balanced', departureSolarPos);
  let balancedEdges = balancedRaw ? balancedRaw.edges : shortestRaw.edges;
  let balancedNodes = balancedRaw ? balancedRaw.nodeIds : shortestRaw.nodeIds;
  let balancedMetrics = calculateRouteMetrics(
    balancedEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
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
