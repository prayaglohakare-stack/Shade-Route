import json
import os
import math

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCHEMA_DIR = os.path.join(BASE_DIR, "schemas")
CAMPUS_DIR = os.path.join(BASE_DIR, "data", "campuses", "in-mh-pune-chintamani-bibwewadi")

def validate():
    print("Validating campus bundle...")

    # Load files
    with open(os.path.join(CAMPUS_DIR, "manifest.json"), 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    with open(os.path.join(CAMPUS_DIR, "network.json"), 'r', encoding='utf-8') as f:
        network = json.load(f)
    with open(os.path.join(CAMPUS_DIR, "shade.json"), 'r', encoding='utf-8') as f:
        shade = json.load(f)

    # 1. Manifest checks
    assert manifest["schemaVersion"] == 1, "Manifest schemaVersion != 1"
    assert manifest["campusId"] == "in-mh-pune-chintamani-bibwewadi", "Manifest campusId mismatch"
    assert manifest["dataRevision"] >= 1, "Manifest dataRevision < 1"
    assert "publishedAt" in manifest, "Missing publishedAt"
    assert len(manifest["sources"]) >= 1, "No sources in manifest"
    print("  [PASS] Manifest structural check")

    # 2. Network checks
    assert network["schemaVersion"] == 1, "Network schemaVersion != 1"
    assert network["campusId"] == manifest["campusId"], "Network campusId mismatch"
    assert network["dataRevision"] == manifest["dataRevision"], "Network dataRevision mismatch"
    
    nodes = network["nodes"]
    edges = network["edges"]
    assert len(nodes) > 0, "No nodes in network"
    assert len(edges) > 0, "No edges in network"
    
    node_map = {}
    for n in nodes:
        assert "nodeId" in n, "Node missing nodeId"
        assert n["nodeId"] not in node_map, f"Duplicate nodeId: {n['nodeId']}"
        coords = n["coordinates"]
        assert len(coords) == 2, "Node coordinates not [lon, lat]"
        lon, lat = coords
        assert -180 <= lon <= 180, f"Invalid lon: {lon}"
        assert -90 <= lat <= 90, f"Invalid lat: {lat}"
        node_map[n["nodeId"]] = coords
        
    print(f"  [PASS] Network nodes check: {len(node_map)} unique valid nodes")

    edge_ids = set()
    for e in edges:
        eid = e["edgeId"]
        assert eid not in edge_ids, f"Duplicate edgeId: {eid}"
        edge_ids.add(eid)
        assert e["fromNodeId"] in node_map, f"Edge {eid} references unknown fromNodeId {e['fromNodeId']}"
        assert e["toNodeId"] in node_map, f"Edge {eid} references unknown toNodeId {e['toNodeId']}"
        assert e["pathClass"] in ["footway", "path", "pedestrian", "steps", "covered-walkway", "service-road", "other"], f"Invalid pathClass {e['pathClass']}"
        assert e["accessStatus"] in ["osm-derived", "permitted", "restricted", "unclear", "unknown"], f"Invalid accessStatus {e['accessStatus']}"
        assert e["verificationStatus"] in ["unverified", "field-verified", "osm-unverified", "survey-added", "closed", "unknown"], f"Invalid verificationStatus {e['verificationStatus']}"
        coords = e["coordinates"]
        assert len(coords) >= 2, f"Edge {eid} has < 2 coordinates"
        # Check endpoints match nodes
        u_coord = node_map[e["fromNodeId"]]
        v_coord = node_map[e["toNodeId"]]
        assert coords[0] == u_coord, f"Edge {eid} start coord {coords[0]} != node {u_coord}"
        assert coords[-1] == v_coord, f"Edge {eid} end coord {coords[-1]} != node {v_coord}"

    print(f"  [PASS] Network edges check: {len(edge_ids)} unique valid edges, 100% endpoint integrity")

    # 3. Shade checks
    assert shade["schemaVersion"] == 1, "Shade schemaVersion != 1"
    assert shade["campusId"] == manifest["campusId"], "Shade campusId mismatch"
    assert shade["networkRevision"] == network["dataRevision"], "Shade networkRevision mismatch"
    
    records = shade["records"]
    assert len(records) > 0, "No records in shade.json"
    shade_edge_ids = set()
    for r in records:
        eid = r["edgeId"]
        assert eid in edge_ids, f"Shade record references unknown edgeId {eid}"
        assert eid not in shade_edge_ids, f"Duplicate shade record for edgeId {eid}"
        shade_edge_ids.add(eid)
        assert r["status"] in ["observed", "modeled", "unknown"], f"Invalid status {r['status']}"
        if r["status"] in ["observed", "modeled"]:
            frac = r["shadeFraction"]
            assert 0 <= frac <= 1, f"Invalid shadeFraction {frac}"
            assert r["method"] in ["field-observation", "geometry-model"], f"Invalid method {r['method']}"
            assert "sourceRef" in r, "Missing sourceRef"
        elif r["status"] == "unknown":
            assert 0 <= r.get("unknownFraction", 1.0) <= 1, f"Invalid unknownFraction {r.get('unknownFraction')}"

    print(f"  [PASS] Shade records check: {len(shade_edge_ids)} records matching edges")

    # 4. Topology connectivity check
    adj = {nid: [] for nid in node_map}
    for e in edges:
        adj[e["fromNodeId"]].append(e["toNodeId"])
        adj[e["toNodeId"]].append(e["fromNodeId"])

    visited = set()
    start_node = next(iter(node_map))
    queue = [start_node]
    visited.add(start_node)
    for curr in queue:
        for neighbor in adj[curr]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    assert len(visited) == len(node_map), f"Graph has disconnected nodes! Visited {len(visited)} of {len(node_map)}"
    print(f"  [PASS] Topology check: 100% connected graph ({len(visited)} nodes)")
    print("\nALL DATA INTEGRITY AND SCHEMA TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    validate()
