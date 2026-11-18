import type { CampusEdge, CampusNode, Coordinate, RouteNetwork, ShadeRecord } from '../data/types';
import { parseDateInput } from './solarEngine';

export const DEFAULT_WALKING_SPEED_MPS = 1.25; // 1.25 m/s ≈ 4.5 km/h standard pedestrian speed

export type RouteMode = 'shortest' | 'balanced' | 'more-canopy';

export interface RouteMetrics {
  sunMinutes: number; // Headline metric: minutes in direct sun (1 decimal), pessimistic safety net
  sunMinutesOptimistic: number; // Minutes in direct sun if unknown edges are treated as shaded
  sunMinutesPessimistic: number; // Minutes in direct sun with unknown edges counted as fully sunny
  sunMinutesRange: string; // Formatted range e.g. "8.2 min" or "8.2 – 9.5 min"
  isArrivalAfter17: boolean; // Flag if pedestrian arrives after 17:00 IST
  distanceMetres: number;
  walkingMinutes: number;
  sunMinutesSavedVsShortest: number; // Minutes in direct sun saved vs shortest route (pessimistic)
  detourDistanceMetres: number; // Extra metres vs shortest route
  detourPercentage: number; // % longer than shortest route
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

export type SolarSeasonKey = '2026-11-18' | '2026-04-25';

/**
 * Resolves solar season key strictly between November (winter) and April (summer).
 * Throws an explicit error for any uncalibrated month so other dates cannot silently fall back.
 */
export function resolveSeasonDateKey(dateInput: Date | string = '2026-11-18'): SolarSeasonKey {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim().toLowerCase();
    if (trimmed === '2026-11-18' || trimmed === 'nov' || trimmed === 'winter') return '2026-11-18';
    if (trimmed === '2026-04-25' || trimmed === 'apr' || trimmed === 'summer') return '2026-04-25';
  }
  const { month } = parseDateInput(dateInput);
  if (month === 11) return '2026-11-18';
  if (month === 4) return '2026-04-25';
  throw new Error(
    `Uncalibrated solar season month: ${month}. Solar shadow model is strictly calibrated for November (2026-11-18) and April (2026-04-25).`,
  );
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

  const dateKey = resolveSeasonDateKey(dateInput);
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
    // Explicit clamp to sunset slot (17:00 IST) for arrivals after 17:00
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
 * Efficient Min-Binary Heap implementation for Dijkstra and Constrained Shortest Path search.
 */
export class MinHeap<T> {
  private data: Array<{ key: number; value: T }> = [];

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  push(key: number, value: T): void {
    this.data.push({ key, value });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { key: number; value: T } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  peek(): { key: number; value: T } | undefined {
    return this.data[0];
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.data[idx].key < this.data[parentIdx].key) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[parentIdx];
        this.data[parentIdx] = tmp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private bubbleDown(idx: number): void {
    const len = this.data.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < len && this.data[left].key < this.data[smallest].key) {
        smallest = left;
      }
      if (right < len && this.data[right].key < this.data[smallest].key) {
        smallest = right;
      }

      if (smallest !== idx) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[smallest];
        this.data[smallest] = tmp;
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Calculates time-progressed combined metrics for an edge sequence.
 * Evaluates each edge at the estimated timestamp the pedestrian reaches it!
 * Headline metric: minutes in direct sun (sum over edges of length * (1 - shade) / walking speed).
 */
export function calculateRouteMetrics(
  edges: CampusEdge[],
  shadeMap: Map<string, ShadeRecord>,
  shortestDistance: number,
  shortestSunMinutes: number,
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
  let totalPessimisticSunSeconds = 0;
  let totalOptimisticSunSeconds = 0;
  let isArrivalAfter17 = false;

  let elapsedSeconds = 0;

  for (const edge of edges) {
    const len = edgeLength(edge);
    totalDist += len;

    // Time when pedestrian arrives at this edge
    const edgeArrivalMinutes = departureHour * 60 + departureMinute + elapsedSeconds / 60;
    if (edgeArrivalMinutes > 17 * 60) {
      isArrivalAfter17 = true;
    }

    const isCovered = edge.pathClass === 'covered-walkway';
    const shade = shadeMap.get(edge.edgeId);
    const dynamicShade = interpolateSlotShade(shade, edgeArrivalMinutes, dateInput);

    const edgeCombinedShade = isCovered ? len : len * dynamicShade.combinedFrac;
    const edgeUnknown = isCovered ? 0.0 : len * dynamicShade.unknownFrac;

    // Safety net: unknown length is counted as fully sunny in pessimistic headline metric
    const edgeExposedPessimistic = isCovered ? 0.0 : len * Math.max(0.0, 1.0 - dynamicShade.combinedFrac);
    // Optimistic calculation: unknown length is treated as shaded
    const edgeExposedOptimistic = isCovered ? 0.0 : len * Math.max(0.0, 1.0 - dynamicShade.combinedFrac - dynamicShade.unknownFrac);

    combinedShadeDist += edgeCombinedShade;
    unknownDist += edgeUnknown;
    exposedDist += edgeExposedPessimistic;

    if (isCovered) {
      coveredDist += len;
    } else {
      buildingDist += len * dynamicShade.bldgFrac;
      canopyDist += len * dynamicShade.treeFrac;
      uncertainDist += len * dynamicShade.uncertainFrac;
    }

    totalPessimisticSunSeconds += edgeExposedPessimistic / walkingSpeedMps;
    totalOptimisticSunSeconds += edgeExposedOptimistic / walkingSpeedMps;

    elapsedSeconds += len / walkingSpeedMps;
  }

  const distSafe = totalDist > 0 ? totalDist : 1;
  const detourDistanceMetres = shortestDistance > 0 && totalDist > shortestDistance
    ? Math.max(0, Math.round(totalDist - shortestDistance))
    : 0;
  const detourPercentage = shortestDistance > 0 && totalDist > shortestDistance
    ? Math.round(((totalDist - shortestDistance) / shortestDistance) * 1000) / 10
    : 0;

  const sunMinutes = Math.round((totalPessimisticSunSeconds / 60) * 10) / 10;
  const sunMinutesOptimistic = Math.round((totalOptimisticSunSeconds / 60) * 10) / 10;
  const sunMinutesPessimistic = sunMinutes;
  const sunMinutesRange = (unknownDist > 0.5 && sunMinutes !== sunMinutesOptimistic)
    ? `${sunMinutesOptimistic.toFixed(1)} – ${sunMinutes.toFixed(1)} min`
    : `${sunMinutes.toFixed(1)} min`;

  const sunMinutesSavedVsShortest = shortestSunMinutes > 0
    ? Math.round(Math.max(0, shortestSunMinutes - sunMinutes) * 10) / 10
    : 0;

  return {
    sunMinutes,
    sunMinutesOptimistic,
    sunMinutesPessimistic,
    sunMinutesRange,
    isArrivalAfter17,
    distanceMetres: Math.round(totalDist),
    walkingMinutes: Math.round((totalDist / walkingSpeedMps / 60) * 10) / 10,
    sunMinutesSavedVsShortest,
    detourDistanceMetres,
    detourPercentage,
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

interface AdjacencyEdge {
  next: string;
  edge: CampusEdge;
  len: number;
}

function buildAdjacency(network: RouteNetwork): Map<string, AdjacencyEdge[]> {
  const adjacency = new Map<string, AdjacencyEdge[]>();
  for (const n of network.nodes) adjacency.set(n.nodeId, []);

  for (const edge of network.edges) {
    if (!isEdgePermitted(edge)) continue;
    const len = edgeLength(edge);
    if (len <= 0) continue;

    adjacency.get(edge.fromNodeId)?.push({ next: edge.toNodeId, edge, len });
    adjacency.get(edge.toNodeId)?.push({ next: edge.fromNodeId, edge, len });
  }
  return adjacency;
}

/**
 * Runs Shortest-Distance Dijkstra with a binary-heap implementation.
 */
function runShortestDistance(
  network: RouteNetwork,
  originNodeId: string,
  destinationNodeId: string,
): { nodeIds: string[]; edges: CampusEdge[]; distanceMetres: number } | null {
  const nodeMap = new Map<string, CampusNode>(network.nodes.map((n) => [n.nodeId, n]));
  if (!nodeMap.has(originNodeId) || !nodeMap.has(destinationNodeId)) return null;

  const adjacency = buildAdjacency(network);
  const distances = new Map<string, number>([[originNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: CampusEdge }>();
  const heap = new MinHeap<string>();
  heap.push(0, originNodeId);

  while (!heap.isEmpty()) {
    const item = heap.pop()!;
    const current = item.value;
    const currentDist = item.key;

    if (currentDist > (distances.get(current) ?? Number.POSITIVE_INFINITY)) continue;
    if (current === destinationNodeId) break;

    for (const { next, edge, len } of adjacency.get(current) ?? []) {
      const candidateDist = currentDist + len;
      if (candidateDist < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, candidateDist);
        previous.set(next, { nodeId: current, edge });
        heap.push(candidateDist, next);
      }
    }
  }

  if (!distances.has(destinationNodeId)) return null;

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

  return { nodeIds, edges, distanceMetres: distances.get(destinationNodeId)! };
}

interface PathState {
  nodeId: string;
  distMeters: number;
  cost: number;
  edge: CampusEdge | null;
  parent: PathState | null;
}

/**
 * Runs Constrained Search for the Cooler Route:
 * Minimises sun-minutes (direct sun exposure) subject to hard distance detour constraint <= 25% (dist <= 1.25 * shortestDistance).
 * Uses a binary min-heap with Pareto-frontier domination pruning.
 */
function runConstrainedCoolerRoute(
  network: RouteNetwork,
  originNodeId: string,
  destinationNodeId: string,
  shadeMap: Map<string, ShadeRecord>,
  shortestDistance: number,
  departureHour: number,
  departureMinute: number,
  walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
  dateInput: Date | string = '2026-11-18',
): { nodeIds: string[]; edges: CampusEdge[] } | null {
  const maxDistanceMetres = shortestDistance * 1.25; // Hard <= 25% detour constraint
  const adjacency = buildAdjacency(network);

  const heap = new MinHeap<PathState>();
  const rootState: PathState = {
    nodeId: originNodeId,
    distMeters: 0,
    cost: 0, // sunSeconds
    edge: null,
    parent: null,
  };
  heap.push(0, rootState);

  // Pareto frontier per node: list of [cost, distMeters] non-dominated labels
  const paretoLabels = new Map<string, Array<{ cost: number; dist: number }>>();
  paretoLabels.set(originNodeId, [{ cost: 0, dist: 0 }]);

  let bestDestState: PathState | null = null;
  let iterations = 0;
  const MAX_ITERATIONS = 20000;

  while (!heap.isEmpty() && iterations++ < MAX_ITERATIONS) {
    const top = heap.pop()!;
    const state = top.value;

    if (state.distMeters > maxDistanceMetres) continue;

    if (state.nodeId === destinationNodeId) {
      bestDestState = state;
      break; // First arrival at destination from sun-ordered heap is optimal under the constraint
    }

    const currentArrivalMin = departureHour * 60 + departureMinute + (state.distMeters / walkingSpeedMps) / 60;

    for (const { next, edge, len } of adjacency.get(state.nodeId) ?? []) {
      if (state.parent && state.parent.nodeId === next) continue; // avoid 2-node cycles

      const newDist = state.distMeters + len;
      if (newDist > maxDistanceMetres) continue; // Prune if exceeds 25% detour

      const isCovered = edge.pathClass === 'covered-walkway';
      const shade = shadeMap.get(edge.edgeId);
      const dynamicShade = interpolateSlotShade(shade, currentArrivalMin, dateInput);

      const combinedFrac = isCovered ? 1.0 : dynamicShade.combinedFrac;
      // Safety net: unknown length is counted as fully sunny in the search cost
      const exposedFrac = Math.max(0.0, 1.0 - combinedFrac);
      const edgeSunSeconds = (len * exposedFrac) / walkingSpeedMps;
      const newCost = state.cost + edgeSunSeconds;

      // Pareto domination check: reject if another label at next has both <= cost and <= dist
      const labels = paretoLabels.get(next) ?? [];
      let dominated = false;
      for (const l of labels) {
        if (l.cost <= newCost && l.dist <= newDist) {
          dominated = true;
          break;
        }
      }
      if (dominated) continue;

      // Filter out labels at next that are strictly dominated by this new label
      const retained = labels.filter((l) => !(l.cost >= newCost && l.dist >= newDist));
      retained.push({ cost: newCost, dist: newDist });
      paretoLabels.set(next, retained);

      const nextState: PathState = {
        nodeId: next,
        distMeters: newDist,
        cost: newCost,
        edge,
        parent: state,
      };
      heap.push(newCost, nextState);
    }
  }

  if (!bestDestState) return null;

  const nodeIds = [destinationNodeId];
  const edges: CampusEdge[] = [];
  let curr: PathState | null = bestDestState;

  while (curr && curr.parent) {
    if (curr.edge) edges.unshift(curr.edge);
    curr = curr.parent;
    nodeIds.unshift(curr.nodeId);
  }

  return { nodeIds, edges };
}

/**
 * Runs Constrained Search for Balanced Route:
 * Weighted cost function: weight = exposedLen + 0.50 * shadedLen (50% discount for shade)
 * subject to hard distance detour constraint <= 15% (dist <= 1.15 * shortestDistance).
 */
function runBalancedRoute(
  network: RouteNetwork,
  originNodeId: string,
  destinationNodeId: string,
  shadeMap: Map<string, ShadeRecord>,
  shortestDistance: number,
  departureHour: number,
  departureMinute: number,
  walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
  dateInput: Date | string = '2026-11-18',
): { nodeIds: string[]; edges: CampusEdge[] } | null {
  const maxDistanceMetres = shortestDistance * 1.15; // Hard <= 15% detour constraint
  const adjacency = buildAdjacency(network);

  const heap = new MinHeap<PathState>();
  const rootState: PathState = {
    nodeId: originNodeId,
    distMeters: 0,
    cost: 0,
    edge: null,
    parent: null,
  };
  heap.push(0, rootState);

  const paretoLabels = new Map<string, Array<{ cost: number; dist: number }>>();
  paretoLabels.set(originNodeId, [{ cost: 0, dist: 0 }]);

  let bestDestState: PathState | null = null;
  let iterations = 0;
  const MAX_ITERATIONS = 20000;

  while (!heap.isEmpty() && iterations++ < MAX_ITERATIONS) {
    const top = heap.pop()!;
    const state = top.value;

    if (state.distMeters > maxDistanceMetres) continue;

    if (state.nodeId === destinationNodeId) {
      bestDestState = state;
      break;
    }

    const currentArrivalMin = departureHour * 60 + departureMinute + (state.distMeters / walkingSpeedMps) / 60;

    for (const { next, edge, len } of adjacency.get(state.nodeId) ?? []) {
      if (state.parent && state.parent.nodeId === next) continue;

      const newDist = state.distMeters + len;
      if (newDist > maxDistanceMetres) continue;

      const isCovered = edge.pathClass === 'covered-walkway';
      const shade = shadeMap.get(edge.edgeId);
      const dynamicShade = interpolateSlotShade(shade, currentArrivalMin, dateInput);

      const combinedFrac = isCovered ? 1.0 : dynamicShade.combinedFrac;
      const shadedLen = len * combinedFrac;
      // Safety net: unknown length is counted as fully sunny in the search cost
      const exposedLen = Math.max(0.0, len * (1.0 - combinedFrac));
      // Documented weight: exposedLen + 0.50 * shadedLen
      const edgeWeight = exposedLen + 0.50 * shadedLen;
      const newCost = state.cost + edgeWeight;

      const labels = paretoLabels.get(next) ?? [];
      let dominated = false;
      for (const l of labels) {
        if (l.cost <= newCost && l.dist <= newDist) {
          dominated = true;
          break;
        }
      }
      if (dominated) continue;

      const retained = labels.filter((l) => !(l.cost >= newCost && l.dist >= newDist));
      retained.push({ cost: newCost, dist: newDist });
      paretoLabels.set(next, retained);

      const nextState: PathState = {
        nodeId: next,
        distMeters: newDist,
        cost: newCost,
        edge,
        parent: state,
      };
      heap.push(newCost, nextState);
    }
  }

  if (!bestDestState) return null;

  const nodeIds = [destinationNodeId];
  const edges: CampusEdge[] = [];
  let curr: PathState | null = bestDestState;

  while (curr && curr.parent) {
    if (curr.edge) edges.unshift(curr.edge);
    curr = curr.parent;
    nodeIds.unshift(curr.nodeId);
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

  // 1. Calculate Shortest Route via MinHeap Dijkstra
  const shortestRaw = runShortestDistance(network, originNodeId, destinationNodeId);
  if (!shortestRaw) {
    return { ok: false, error: { code: 'no-route', message: 'No connected pedestrian route exists between these locations.' } };
  }

  const shortestMetrics = calculateRouteMetrics(
    shortestRaw.edges,
    shadeMap,
    0,
    0,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  const shortestPoly = reconstructPolyline(shortestRaw.nodeIds, shortestRaw.edges);

  const shortestSunsetNote = shortestMetrics.isArrivalAfter17 ? ' Note: Pedestrian arrives after 17:00 IST (solar model clamped to sunset slot).' : '';
  const shortestRoute: ComputedRoute = {
    mode: 'shortest',
    modeTitle: 'Shortest Distance',
    nodeIds: shortestRaw.nodeIds,
    edges: shortestRaw.edges,
    coordinates: shortestPoly,
    metrics: shortestMetrics,
    isCoincidentWithShortest: true,
    explanation: `Direct route prioritizing minimum distance (${shortestMetrics.distanceMetres} m, ~${shortestMetrics.walkingMinutes} min). Direct sun: ${shortestMetrics.sunMinutes} min. Combined shade is ${shortestMetrics.combinedShadePercentage}% (Buildings: ${shortestMetrics.buildingPercentage}%, Trees: ${shortestMetrics.canopyPercentage}%).${shortestSunsetNote}`,
  };

  // 2. Calculate Cooler Route via Constrained Search (min sun-minutes subject to detour <= 25%)
  const moreCanopyRaw = runConstrainedCoolerRoute(
    network,
    originNodeId,
    destinationNodeId,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  const moreCanopyEdges = moreCanopyRaw ? moreCanopyRaw.edges : shortestRaw.edges;
  const moreCanopyNodes = moreCanopyRaw ? moreCanopyRaw.nodeIds : shortestRaw.nodeIds;
  const moreCanopyMetrics = calculateRouteMetrics(
    moreCanopyEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    shortestMetrics.sunMinutes,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );

  const moreCanopyIsCoincident = areRoutesIdentical(shortestRaw.edges, moreCanopyEdges);
  const sunMinutesSavedByCooler = Math.max(0, Math.round((shortestMetrics.sunMinutes - moreCanopyMetrics.sunMinutes) * 10) / 10);
  const coolerSunsetNote = moreCanopyMetrics.isArrivalAfter17 ? ' Note: Pedestrian arrives after 17:00 IST (solar model clamped to sunset slot).' : '';

  let moreCanopyExplanation = '';
  if (moreCanopyIsCoincident) {
    moreCanopyExplanation = `The shortest route already follows the most shaded corridor available for this destination.${coolerSunsetNote}`;
  } else if (sunMinutesSavedByCooler < 1.0) {
    moreCanopyExplanation = `Shortest route is already about as shaded${coolerSunsetNote}`;
  } else {
    moreCanopyExplanation = `Saves ${sunMinutesSavedByCooler.toFixed(1)} min in direct sun (${moreCanopyMetrics.sunMinutes} min vs ${shortestMetrics.sunMinutes} min) with a +${moreCanopyMetrics.detourPercentage}% detour (+${moreCanopyMetrics.detourDistanceMetres} m).${coolerSunsetNote}`;
  }

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

  // 3. Calculate Balanced Route via Constrained Search (weighted cost subject to detour <= 15%)
  const balancedRaw = runBalancedRoute(
    network,
    originNodeId,
    destinationNodeId,
    shadeMap,
    shortestMetrics.distanceMetres,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );
  const balancedEdges = balancedRaw ? balancedRaw.edges : shortestRaw.edges;
  const balancedNodes = balancedRaw ? balancedRaw.nodeIds : shortestRaw.nodeIds;
  const balancedMetrics = calculateRouteMetrics(
    balancedEdges,
    shadeMap,
    shortestMetrics.distanceMetres,
    shortestMetrics.sunMinutes,
    departureHour,
    departureMinute,
    walkingSpeedMps,
    dateInput,
  );

  const balancedIsCoincident = areRoutesIdentical(shortestRaw.edges, balancedEdges);
  const sunMinutesSavedByBalanced = Math.max(0, Math.round((shortestMetrics.sunMinutes - balancedMetrics.sunMinutes) * 10) / 10);
  const balancedSunsetNote = balancedMetrics.isArrivalAfter17 ? ' Note: Pedestrian arrives after 17:00 IST (solar model clamped to sunset slot).' : '';

  let balancedExplanation = '';
  if (balancedIsCoincident) {
    balancedExplanation = `Identical to shortest route; no intermediate shaded corridor exists within a 15% distance limit.${balancedSunsetNote}`;
  } else if (sunMinutesSavedByBalanced < 0.5) {
    balancedExplanation = `Shortest route is already about as shaded${balancedSunsetNote}`;
  } else {
    balancedExplanation = `Balanced route avoids ${sunMinutesSavedByBalanced.toFixed(1)} min of direct sun for only +${balancedMetrics.detourPercentage}% walking distance (+${balancedMetrics.detourDistanceMetres} m).${balancedSunsetNote}`;
  }

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

  if (!moreCanopyIsCoincident && sunMinutesSavedByCooler >= 1.0 && moreCanopyMetrics.detourPercentage <= 25) {
    recommendedMode = 'more-canopy';
    summaryExplanation = `Recommended: Cooler route avoids direct sun by ${sunMinutesSavedByCooler.toFixed(1)} minutes (${moreCanopyMetrics.sunMinutes} min vs ${shortestMetrics.sunMinutes} min) with a +${moreCanopyMetrics.detourPercentage}% distance difference.`;
  } else if (!balancedIsCoincident && sunMinutesSavedByBalanced >= 0.8 && balancedMetrics.detourPercentage <= 15) {
    recommendedMode = 'balanced';
    summaryExplanation = `Recommended: Balanced route avoids ${sunMinutesSavedByBalanced.toFixed(1)} minutes of direct sun with minimal extra distance (+${balancedMetrics.detourPercentage}%).`;
  } else {
    recommendedMode = 'shortest';
    summaryExplanation = 'Shortest route is already about as shaded';
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
