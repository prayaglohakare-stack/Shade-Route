import type { CampusEdge, CampusNode, RouteNetwork, ShadeRecord } from '../data/types';

export const DEFAULT_WALKING_SPEED_METRES_PER_SECOND = 1.25;

export interface RouteMetrics {
  distanceMetres: number;
  walkingMinutes: number;
  shadedMetres: number;
  exposedMetres: number;
  unknownMetres: number;
}

export interface RouteResult {
  nodeIds: string[];
  edges: CampusEdge[];
  metrics: RouteMetrics;
}

export type RouteFailure =
  | { code: 'network-unavailable'; message: string }
  | { code: 'endpoint-unavailable'; message: string }
  | { code: 'no-route'; message: string }
  | { code: 'invalid-network'; message: string };

export type RouteOutcome = { ok: true; route: RouteResult } | { ok: false; error: RouteFailure };

function haversineMetres(a: [number, number], b: [number, number]): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(b[0] - a[0]);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function edgeLength(edge: CampusEdge): number {
  let length = 0;
  for (let index = 1; index < edge.coordinates.length; index += 1) {
    length += haversineMetres(edge.coordinates[index - 1], edge.coordinates[index]);
  }
  return length;
}

function routeable(edge: CampusEdge): boolean {
  return (edge.accessStatus === 'osm-derived' || edge.accessStatus === 'permitted') && edge.verificationStatus !== 'closed';
}

function validGraph(network: RouteNetwork): boolean {
  const nodeIds = new Set(network.nodes.map((node) => node.nodeId));
  if (nodeIds.size !== network.nodes.length) return false;
  const edgeIds = new Set(network.edges.map((edge) => edge.edgeId));
  if (edgeIds.size !== network.edges.length) return false;
  return network.edges.every((edge) =>
    nodeIds.has(edge.fromNodeId) &&
    nodeIds.has(edge.toNodeId) &&
    edge.coordinates.length >= 2 &&
    Number.isFinite(edgeLength(edge)) &&
    edgeLength(edge) > 0,
  );
}

function metrics(edges: CampusEdge[], shadeRecords: ShadeRecord[], speedMps: number): RouteMetrics {
  const shadeByEdge = new Map(shadeRecords.map((record) => [record.edgeId, record]));
  let distanceMetres = 0;
  let shadedMetres = 0;
  let exposedMetres = 0;
  let unknownMetres = 0;

  for (const edge of edges) {
    const distance = edgeLength(edge);
    const shade = shadeByEdge.get(edge.edgeId);
    distanceMetres += distance;
    const uFrac = shade?.unknownFraction ?? (shade?.status === 'unknown' ? 1.0 : 0.0);
    const sFrac = (shade?.status === 'observed' || shade?.status === 'modeled') && typeof shade.shadeFraction === 'number'
      ? shade.shadeFraction
      : 0.0;
    const effectiveShade = Math.min(1.0 - uFrac, Math.max(0.0, sFrac));
    const effectiveUnknown = Math.max(0.0, Math.min(1.0, uFrac));
    const effectiveExposed = Math.max(0.0, 1.0 - effectiveShade - effectiveUnknown);

    shadedMetres += distance * effectiveShade;
    unknownMetres += distance * effectiveUnknown;
    exposedMetres += distance * effectiveExposed;
  }

  return {
    distanceMetres,
    walkingMinutes: distanceMetres / speedMps / 60,
    shadedMetres,
    exposedMetres,
    unknownMetres,
  };
}

export function findShortestRoute(
  network: RouteNetwork | null,
  originNodeId: string | null,
  destinationNodeId: string | null,
  shadeRecords: ShadeRecord[] = [],
  walkingSpeedMps = DEFAULT_WALKING_SPEED_METRES_PER_SECOND,
): RouteOutcome {
  if (!network) {
    return { ok: false, error: { code: 'network-unavailable', message: 'No verified pedestrian network is published.' } };
  }
  if (!originNodeId || !destinationNodeId || originNodeId === destinationNodeId) {
    return { ok: false, error: { code: 'endpoint-unavailable', message: 'Choose two distinct endpoints snapped to verified network junctions.' } };
  }
  if (!validGraph(network) || walkingSpeedMps <= 0) {
    return { ok: false, error: { code: 'invalid-network', message: 'The campus network is incomplete or invalid.' } };
  }

  const nodes = new Map<string, CampusNode>(network.nodes.map((node) => [node.nodeId, node]));
  if (!nodes.has(originNodeId) || !nodes.has(destinationNodeId)) {
    return { ok: false, error: { code: 'endpoint-unavailable', message: 'Selected endpoints are not present in the published route network.' } };
  }

  const adjacency = new Map<string, Array<{ next: string; edge: CampusEdge; weight: number }>>();
  for (const nodeId of nodes.keys()) adjacency.set(nodeId, []);
  for (const edge of network.edges) {
    if (!routeable(edge)) continue;
    const weight = edgeLength(edge);
    adjacency.get(edge.fromNodeId)?.push({ next: edge.toNodeId, edge, weight });
    adjacency.get(edge.toNodeId)?.push({ next: edge.fromNodeId, edge, weight });
  }

  const distances = new Map<string, number>([[originNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: CampusEdge }>();
  const pending = new Set(nodes.keys());
  while (pending.size > 0) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of pending) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < best) { current = nodeId; best = distance; }
    }
    if (!current || !Number.isFinite(best)) break;
    if (current === destinationNodeId) break;
    pending.delete(current);
    for (const adjacent of adjacency.get(current) ?? []) {
      if (!pending.has(adjacent.next)) continue;
      const candidate = best + adjacent.weight;
      if (candidate < (distances.get(adjacent.next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(adjacent.next, candidate);
        previous.set(adjacent.next, { nodeId: current, edge: adjacent.edge });
      }
    }
  }

  if (!Number.isFinite(distances.get(destinationNodeId) ?? Number.POSITIVE_INFINITY)) {
    return { ok: false, error: { code: 'no-route', message: 'No connected path is available between these verified endpoints.' } };
  }

  const nodeIds = [destinationNodeId];
  const edges: CampusEdge[] = [];
  let cursor = destinationNodeId;
  while (cursor !== originNodeId) {
    const step = previous.get(cursor);
    if (!step) return { ok: false, error: { code: 'invalid-network', message: 'The route could not be reconstructed.' } };
    edges.unshift(step.edge);
    cursor = step.nodeId;
    nodeIds.unshift(cursor);
  }

  return { ok: true, route: { nodeIds, edges, metrics: metrics(edges, shadeRecords, walkingSpeedMps) } };
}

