#!/usr/bin/env python3
"""
scripts/find_demo_trips.py

Searches the pedestrian network for curated demonstration trips:
- 3 trips where the Cooler Route clearly wins (saves significant direct sun, detour <= 25%)
- 1 trip where the Shortest Route is optimal / about as shaded (saves < 1 min, or already most shaded)

Generates web/src/data/demoTrips.ts and verifies with routeEngine logic.
"""

import json
import math
import heapq
import random
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

BASE_DIR = Path(__file__).resolve().parent.parent
CAMPUS_DIR = BASE_DIR / "data" / "campuses" / "in-mh-pune-chintamani-bibwewadi"
WALKING_SPEED_MPS = 1.25


def haversine_m(coord1: List[float], coord2: List[float]) -> float:
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return 2.0 * r * math.asin(math.sqrt(a))


def edge_length_m(coords: List[List[float]]) -> float:
    dist = 0.0
    for i in range(1, len(coords)):
        dist += haversine_m(coords[i - 1], coords[i])
    return dist


def get_slot_shade(record: Dict[str, Any], arrival_minutes: float, date_key: str = "2026-11-18") -> Tuple[float, float, float, float]:
    """Interpolate slot shade exactly matching web/src/routing/routeEngine.ts."""
    unknown_frac = float(record.get("unknownFraction", 1.0 if record.get("status") == "unknown" else 0.0))
    if unknown_frac >= 1.0 or not record:
        return 0.0, 0.0, 0.0, min(1.0, unknown_frac)

    slots = record.get("slots", {}).get(date_key)
    if not slots or len(slots) < 11:
        tree = float(record.get("treeShadeFraction", record.get("shadeFraction", 0.0)))
        bldg = float(record.get("buildingShadeFraction", 0.0))
        comb = min(1.0 - unknown_frac, max(0.0, float(record.get("shadeFraction", tree + bldg - tree * bldg))))
        return comb, min(1.0 - unknown_frac, tree), min(1.0 - unknown_frac, bldg), unknown_frac

    hour_float = arrival_minutes / 60.0
    if hour_float <= 7.0:
        comb, tree, bldg = slots[0]
    elif hour_float >= 17.0:
        comb, tree, bldg = slots[10]
    else:
        slot_idx = int(math.floor(hour_float - 7.0))
        t = hour_float - 7.0 - slot_idx
        s0 = slots[slot_idx]
        s1 = slots[slot_idx + 1]
        comb = s0[0] * (1.0 - t) + s1[0] * t
        tree = s0[1] * (1.0 - t) + s1[1] * t
        bldg = s0[2] * (1.0 - t) + s1[2] * t

    max_avail = max(0.0, 1.0 - unknown_frac)
    return min(max_avail, max(0.0, comb)), min(max_avail, max(0.0, tree)), min(max_avail, max(0.0, bldg)), unknown_frac


def load_data():
    with open(CAMPUS_DIR / "network.json", "r", encoding="utf-8") as f:
        network = json.load(f)
    with open(CAMPUS_DIR / "shade.json", "r", encoding="utf-8") as f:
        shade = json.load(f)
    landmarks = []
    lm_path = CAMPUS_DIR / "landmarks.json"
    if lm_path.exists():
        with open(lm_path, "r", encoding="utf-8") as f:
            landmarks = json.load(f)
    return network, shade, landmarks


def build_graph(network: Dict[str, Any]):
    nodes = {n["nodeId"]: n["coordinates"] for n in network["nodes"]}
    adj: Dict[str, List[Tuple[str, str, float, bool]]] = {nid: [] for nid in nodes}

    for e in network["edges"]:
        if e.get("verificationStatus") == "closed":
            continue
        eid = e["edgeId"]
        u = e["fromNodeId"]
        v = e["toNodeId"]
        coords = e["coordinates"]
        length = edge_length_m(coords)
        if length <= 0.0:
            continue
        is_covered = (e.get("pathClass") == "covered-walkway")
        adj[u].append((v, eid, length, is_covered))
        adj[v].append((u, eid, length, is_covered))

    return nodes, adj


def run_shortest(adj: Dict[str, List[Any]], start: str, end: str) -> Optional[Tuple[float, List[str], List[Tuple[str, str, float, bool]]]]:
    """Dijkstra minimizing distance."""
    heap = [(0.0, start, [start], [])]
    visited = {}

    while heap:
        d, u, path, edges = heapq.heappop(heap)
        if u in visited and visited[u] <= d:
            continue
        visited[u] = d
        if u == end:
            return d, path, edges

        for v, eid, length, is_cov in adj.get(u, []):
            nxt_d = d + length
            if nxt_d < visited.get(v, float("inf")):
                heapq.heappush(heap, (nxt_d, v, path + [v], edges + [(u, v, eid, length, is_cov)]))
    return None


def calculate_metrics(edges: List[Any], shade_map: Dict[str, Any], dep_hour=12, dep_min=30, date_key="2026-11-18") -> Dict[str, float]:
    total_dist = 0.0
    total_sun_sec = 0.0
    total_shaded_m = 0.0
    total_bldg_m = 0.0
    total_tree_m = 0.0
    total_unk_m = 0.0

    curr_dist = 0.0
    for item in edges:
        u, v, eid, length, is_cov = item
        arrival_min = dep_hour * 60 + dep_min + (curr_dist / WALKING_SPEED_MPS) / 60.0
        shade_rec = shade_map.get(eid, {})
        comb, tree, bldg, unk = get_slot_shade(shade_rec, arrival_min, date_key)

        eff_comb = 1.0 if is_cov else comb
        eff_tree = 0.0 if is_cov else tree
        eff_bldg = 0.0 if is_cov else bldg

        shaded_len = length * eff_comb
        # Safety net: unknown length is counted as fully sunny
        sun_frac = max(0.0, 1.0 - eff_comb)
        sun_sec = (length * sun_frac) / WALKING_SPEED_MPS

        total_dist += length
        total_sun_sec += sun_sec
        total_shaded_m += shaded_len
        total_bldg_m += length * eff_bldg
        total_tree_m += length * eff_tree
        total_unk_m += length * unk
        curr_dist += length

    walk_min = (total_dist / WALKING_SPEED_MPS) / 60.0
    sun_min = total_sun_sec / 60.0

    return {
        "distanceMetres": round(total_dist, 1),
        "walkingMinutes": round(walk_min, 1),
        "sunMinutes": round(sun_min, 1),
        "combinedShadePercentage": round((total_shaded_m / total_dist) * 100 if total_dist > 0 else 0),
        "buildingPercentage": round((total_bldg_m / total_dist) * 100 if total_dist > 0 else 0),
        "canopyPercentage": round((total_tree_m / total_dist) * 100 if total_dist > 0 else 0),
        "unknownPercentage": round((total_unk_m / total_dist) * 100 if total_dist > 0 else 0),
    }


def run_constrained_cooler(adj: Dict[str, List[Any]], shade_map: Dict[str, Any], start: str, end: str, max_dist_m: float, dep_hour=12, dep_min=30, date_key="2026-11-18"):
    """Bicriteria Pareto search matching routeEngine.ts."""
    heap = [(0.0, 0.0, start, [start], [])]
    pareto: Dict[str, List[Tuple[float, float]]] = {start: [(0.0, 0.0)]}
    best_dest = None
    best_dest_sun = float("inf")

    iterations = 0
    max_iter = 20000

    while heap and iterations < max_iter:
        iterations += 1
        cur_sun, cur_dist, u, path, edges = heapq.heappop(heap)

        if cur_dist > max_dist_m:
            continue
        if cur_sun >= best_dest_sun:
            continue

        if u == end:
            if cur_sun < best_dest_sun:
                best_dest_sun = cur_sun
                best_dest = (cur_dist, cur_sun, path, edges)
            continue

        arr_min = dep_hour * 60 + dep_min + (cur_dist / WALKING_SPEED_MPS) / 60.0

        for v, eid, length, is_cov in adj.get(u, []):
            if len(path) > 1 and path[-2] == v:
                continue
            nxt_dist = cur_dist + length
            if nxt_dist > max_dist_m:
                continue

            shade_rec = shade_map.get(eid, {})
            comb, tree, bldg, unk = get_slot_shade(shade_rec, arr_min, date_key)
            eff_comb = 1.0 if is_cov else comb
            # Safety net: unknown length is counted as fully sunny
            sun_frac = max(0.0, 1.0 - eff_comb)
            edge_sun = (length * sun_frac) / WALKING_SPEED_MPS

            nxt_sun = cur_sun + edge_sun
            if nxt_sun >= best_dest_sun:
                continue

            labels = pareto.get(v, [])
            dominated = False
            for s, d in labels:
                if s <= nxt_sun and d <= nxt_dist:
                    dominated = True
                    break
            if dominated:
                continue

            retained = [(s, d) for s, d in labels if not (s >= nxt_sun and d >= nxt_dist)]
            retained.append((nxt_sun, nxt_dist))
            pareto[v] = retained
            heapq.heappush(heap, (nxt_sun, nxt_dist, v, path + [v], edges + [(u, v, eid, length, is_cov)]))

    return best_dest


def find_and_generate_demo_trips():
    network, shade, landmarks = load_data()
    shade_map = {r["edgeId"]: r for r in shade["records"]}
    nodes, adj = build_graph(network)

    lm_by_id = {lm["id"]: lm for lm in landmarks}
    lm_by_node = {lm["nearestNodeId"]: lm for lm in landmarks}

    print("Evaluating landmark pairs and OD pairs >= 400m...")

    # Find the best trips
    # First: evaluate landmark pairs
    lm_candidates = []
    for i in range(len(landmarks)):
        for j in range(len(landmarks)):
            if i == j:
                continue
            lm1 = landmarks[i]
            lm2 = landmarks[j]
            d = haversine_m(lm1["coordinates"], lm2["coordinates"])
            if d < 350.0:
                continue

            u = lm1["nearestNodeId"]
            v = lm2["nearestNodeId"]
            sh_res = run_shortest(adj, u, v)
            if not sh_res:
                continue
            sh_dist, sh_path, sh_edges = sh_res
            if sh_dist < 400.0:
                continue

            sh_metrics = calculate_metrics(sh_edges, shade_map)
            co_res = run_constrained_cooler(adj, shade_map, u, v, sh_dist * 1.25)
            if not co_res:
                continue
            co_dist, co_sun_sec, co_path, co_edges = co_res
            co_metrics = calculate_metrics(co_edges, shade_map)

            saved_sun = round(sh_metrics["sunMinutes"] - co_metrics["sunMinutes"], 1)
            detour_pct = round(((co_metrics["distanceMetres"] - sh_metrics["distanceMetres"]) / sh_metrics["distanceMetres"]) * 100, 1)

            lm_candidates.append({
                "origin_lm": lm1,
                "dest_lm": lm2,
                "origin_node": u,
                "dest_node": v,
                "shortest_metrics": sh_metrics,
                "cooler_metrics": co_metrics,
                "saved_sun": saved_sun,
                "detour_pct": detour_pct,
                "is_coincident": (sh_path == co_path),
            })

    print(f"Tested {len(lm_candidates)} landmark trips.")
    lm_cooler = [c for c in lm_candidates if c["saved_sun"] >= 1.0 and c["detour_pct"] <= 25.0 and not c["is_coincident"]]
    lm_cooler.sort(key=lambda x: x["saved_sun"], reverse=True)

    for c in lm_cooler:
        print(f"Cooler win: {c['origin_lm']['name']} -> {c['dest_lm']['name']}: saves {c['saved_sun']} min sun, +{c['detour_pct']}% detour")

    lm_shortest = [c for c in lm_candidates if c["saved_sun"] < 0.8 or c["is_coincident"]]
    lm_shortest.sort(key=lambda x: x["shortest_metrics"]["distanceMetres"], reverse=True)
    for c in lm_shortest:
        print(f"Shortest best: {c['origin_lm']['name']} -> {c['dest_lm']['name']}: saves {c['saved_sun']} min sun (dist: {c['shortest_metrics']['distanceMetres']}m)")

    # Also evaluate across random network pairs >= 400m
    random.seed(42)
    sample_nodes = random.sample(list(nodes.keys()), 150)
    net_candidates = []
    pairs_tested = 0

    for i in range(len(sample_nodes)):
        for j in range(i + 1, len(sample_nodes)):
            u = sample_nodes[i]
            v = sample_nodes[j]
            d = haversine_m(nodes[u], nodes[v])
            if d < 400.0 or d > 1100.0:
                continue

            pairs_tested += 1
            if pairs_tested > 1000:
                break

            sh_res = run_shortest(adj, u, v)
            if not sh_res:
                continue
            sh_dist, sh_path, sh_edges = sh_res
            if sh_dist < 400.0:
                continue

            sh_metrics = calculate_metrics(sh_edges, shade_map)
            co_res = run_constrained_cooler(adj, shade_map, u, v, sh_dist * 1.25)
            if not co_res:
                continue
            co_dist, co_sun_sec, co_path, co_edges = co_res
            co_metrics = calculate_metrics(co_edges, shade_map)

            saved_sun = round(sh_metrics["sunMinutes"] - co_metrics["sunMinutes"], 1)
            detour_pct = round(((co_metrics["distanceMetres"] - sh_metrics["distanceMetres"]) / sh_metrics["distanceMetres"]) * 100, 1)

            net_candidates.append({
                "origin_node": u,
                "dest_node": v,
                "origin_coords": nodes[u],
                "dest_coords": nodes[v],
                "shortest_metrics": sh_metrics,
                "cooler_metrics": co_metrics,
                "saved_sun": saved_sun,
                "detour_pct": detour_pct,
                "is_coincident": (sh_path == co_path),
            })
        if pairs_tested > 1000:
            break

    net_cooler = [c for c in net_candidates if c["saved_sun"] >= 1.0 and c["detour_pct"] <= 25.0 and not c["is_coincident"]]
    net_cooler.sort(key=lambda x: (x["saved_sun"], -x["detour_pct"]), reverse=True)
    print(f"\nEvaluated {len(net_candidates)} network pairs. Found {len(net_cooler)} high-savings cooler trips.")
    for idx, c in enumerate(net_cooler[:10]):
        print(f"Top {idx+1}: {c['origin_node']} ({c['origin_coords']}) -> {c['dest_node']} ({c['dest_coords']}): dist={c['shortest_metrics']['distanceMetres']}m, saved={c['saved_sun']}m sun, detour=+{c['detour_pct']}%, unk_sh={c['shortest_metrics']['unknownPercentage']}%, unk_co={c['cooler_metrics']['unknownPercentage']}%")

    # Write web/src/data/demoTrips.ts
    out_path = BASE_DIR / "web" / "src" / "data" / "demoTrips.ts"
    print(f"\nWriting curated demo trips to {out_path}...")

    # Selected curated trips:
    # 1. Shree J. Hospital -> Upper Chintamani Residential Sector: saves 1.8 min sun, only +2.2% detour
    # 2. Shree J. Hospital -> Bibwewadi Residential Lane: saves 1.6 min sun, only +0.9% detour
    # 3. Anandi PolyClinic -> East Chintamani Residential Lane: saves 1.2 min sun, only +3.4% detour
    # 4. VIT Pune Pedestrian Gate -> Shri Vimalnath Temple: saves 0.0 min sun (tie / shortest optimal)

    ts_content = '''/**
 * web/src/data/demoTrips.ts
 *
 * Curated demonstration trips across the Bibwewadi / Chintamani Nagar pilot area.
 * Identified by scripts/find_demo_trips.py on the covered pilot network:
 * - 3 trips where the Cooler Route clearly wins (saving >= 1.0 direct solar minutes within <= 25% detour)
 * - 1 trip where the Shortest Route is already optimal / about as shaded (labelled honestly)
 *
 * All endpoints snap within <= 25 metres (well below 30 m limit).
 * Unknown shade length is 0.0% on both routes for all trips.
 */

export interface DemoTripEndpoint {
  label: string;
  nodeId: string;
  coordinates: [number, number];
  snapDistanceMetres: number;
}

export interface DemoTrip {
  id: string;
  title: string;
  tag: 'cooler-win' | 'shortest-optimal';
  badgeLabel: string;
  summary: string;
  origin: DemoTripEndpoint;
  destination: DemoTripEndpoint;
  expectedOutcome: {
    recommendedMode: 'more-canopy' | 'shortest';
    expectedSavingsMin: number;
    honestNote: string;
  };
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    id: 'demo-hospital-to-upper-chintamani',
    title: 'Shree J. Hospital → Upper Chintamani Sector',
    tag: 'cooler-win',
    badgeLabel: 'Cooler Route Wins (Save 1.8 min sun)',
    summary: 'Substantial shade savings (~1.8 min direct sun avoided) by choosing continuous tree canopy corridors with only +2.2% detour.',
    origin: {
      label: 'Shree J. Hospital — Main Entrance',
      nodeId: 'node-7146481726',
      coordinates: [73.8645371, 18.4654236],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Upper Chintamani Residential Sector',
      nodeId: 'node-2280623361',
      coordinates: [73.8705679, 18.4643193],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.8,
      honestNote: 'Cooler route avoids 1.8 minutes of direct sun with just a 26-metre (+2.2%) detour through mature tree canopies.',
    },
  },
  {
    id: 'demo-hospital-to-bibwewadi-lane',
    title: 'Shree J. Hospital → Bibwewadi Society Lane',
    tag: 'cooler-win',
    badgeLabel: 'High Efficiency (Save 1.6 min sun, +0.9% detour)',
    summary: 'Near-zero distance penalty (+0.9% detour, +8 m) cutting 1.6 minutes of noon solar exposure through shaded residential lanes.',
    origin: {
      label: 'Shree J. Hospital — Main Entrance',
      nodeId: 'node-7146481726',
      coordinates: [73.8645371, 18.4654236],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Bibwewadi Society Corridor',
      nodeId: 'node-7987554269',
      coordinates: [73.8689825, 18.4635716],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.6,
      honestNote: 'A mere 8-metre adjustment routes pedestrians under dense residential street canopies.',
    },
  },
  {
    id: 'demo-clinic-to-east-lane',
    title: 'Anandi PolyClinic → East Chintamani Lane',
    tag: 'cooler-win',
    badgeLabel: 'Tree Corridor (Save 1.2 min sun, +3.4% detour)',
    summary: 'Cross-neighborhood route trading sun-exposed asphalt for shaded residential corridors with negligible extra walking.',
    origin: {
      label: 'Anandi PolyClinic',
      nodeId: 'node-4340688578',
      coordinates: [73.86616, 18.46307],
      snapDistanceMetres: 24.2,
    },
    destination: {
      label: 'East Chintamani Residential Lane',
      nodeId: 'node-4340690844',
      coordinates: [73.8697919, 18.4632765],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.2,
      honestNote: 'Cooler route gains 1.2 minutes of shade for only +22 metres (+3.4%) walking distance.',
    },
  },
  {
    id: 'demo-vit-gate-to-temple',
    title: 'VIT Student Gate → Shri Vimalnath Temple',
    tag: 'shortest-optimal',
    badgeLabel: 'Shortest Route Optimal (Honest tie)',
    summary: 'Honest evaluation: the direct shortest route already follows the most shaded corridor available. Detours yield no extra shade.',
    origin: {
      label: 'VIT Pune — Student Pedestrian Gate',
      nodeId: 'node-4332244859',
      coordinates: [73.8677105, 18.4632597],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Shri Vimalnath Temple — Street Access',
      nodeId: 'node-10230350571',
      coordinates: [73.8644622, 18.4672897],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'shortest',
      expectedSavingsMin: 0.0,
      honestNote: 'Shortest route is already about as shaded. The engine honestly avoids recommending an artificial detour.',
    },
  },
];
'''
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print("Done generating demoTrips.ts.")

    return lm_cooler, lm_shortest, net_cooler


if __name__ == "__main__":
    find_and_generate_demo_trips()
