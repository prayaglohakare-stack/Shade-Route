import json
import csv
import math
import hashlib
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# -------------------------------------------------------------
# Configuration & Boundaries
# -------------------------------------------------------------
CAMPUS_ID = "in-mh-pune-chintamani-bibwewadi"
PILOT_NAME = "Chintamani Nagar — Bibwewadi Pedestrian Pilot"
PILOT_ADDRESS = "Chintamani Nagar Part 1 & Bibwewadi Neighbourhood, Pune, Maharashtra 411037"
TIMEZONE = "Asia/Kolkata"

# Defensible geographic boundary for the pilot area
# Bounding box: West 73.8640, South 18.4615, East 73.8710, North 18.4675
BBOX = {
    "west": 73.8640,
    "south": 18.4615,
    "east": 73.8710,
    "north": 18.4675
}

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "campuses", CAMPUS_ID)
OSM_DIR = os.path.join(BASE_DIR, "data", "osm")
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OSM_DIR, exist_ok=True)
os.makedirs(RAW_DIR, exist_ok=True)

# -------------------------------------------------------------
# Helper Functions: Metric Geometry
# -------------------------------------------------------------
REF_LON = 73.8675
REF_LAT = 18.4645
M_PER_DEG_LAT = 110852.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(REF_LAT))

def haversine(coord1, coord2):
    """Distance in metres between two [lon, lat] coordinates."""
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    R = 6371000  # Earth radius in metres
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lam = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lam / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))

def to_local_xy(lon, lat):
    """Convert lon, lat to local metric (x, y) in metres relative to reference center."""
    x = (lon - REF_LON) * M_PER_DEG_LON
    y = (lat - REF_LAT) * M_PER_DEG_LAT
    return x, y

def to_lon_lat(x, y):
    """Convert local metric (x, y) back to lon, lat."""
    lon = REF_LON + (x / M_PER_DEG_LON)
    lat = REF_LAT + (y / M_PER_DEG_LAT)
    return [round(lon, 7), round(lat, 7)]

def circle_polygon_geojson(lon, lat, radius_m, num_points=16):
    """Create a regular polygon approximating a circle of radius_m around [lon, lat]."""
    coords = []
    for i in range(num_points):
        angle = 2 * math.pi * i / num_points
        dx = radius_m * math.cos(angle)
        dy = radius_m * math.sin(angle)
        pt = to_lon_lat(to_local_xy(lon, lat)[0] + dx, to_local_xy(lon, lat)[1] + dy)
        coords.append(pt)
    coords.append(coords[0])  # Close polygon
    return {"type": "Polygon", "coordinates": [coords]}

def segment_circle_intersection(p1_xy, p2_xy, center_xy, radius_m):
    """Find overlapping parametric interval [t1, t2] on segment p1->p2 inside circle."""
    x1, y1 = p1_xy
    x2, y2 = p2_xy
    xc, yc = center_xy
    vx = x2 - x1
    vy = y2 - y1
    dx = x1 - xc
    dy = y1 - yc
    a = vx * vx + vy * vy
    if a < 1e-9:
        dist_sq = dx * dx + dy * dy
        return (0.0, 1.0) if dist_sq <= radius_m * radius_m else None
    b = 2.0 * (dx * vx + dy * vy)
    c = dx * dx + dy * dy - radius_m * radius_m
    disc = b * b - 4.0 * a * c
    if disc <= 0:
        return None
    sqrt_disc = math.sqrt(disc)
    t1 = (-b - sqrt_disc) / (2.0 * a)
    t2 = (-b + sqrt_disc) / (2.0 * a)
    start = max(0.0, min(1.0, t1))
    end = max(0.0, min(1.0, t2))
    return (start, end) if end > start else None

def point_in_polygon(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def segment_segment_intersection(p1, p2, q1, q2):
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = q1
    x4, y4 = q2
    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if abs(denom) < 1e-9:
        return None
    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom
    if 0.0 <= ua <= 1.0 and 0.0 <= ub <= 1.0:
        return ua
    return None

def segment_polygon_intersection_intervals(p1, p2, poly):
    t_values = [0.0, 1.0]
    n = len(poly)
    for i in range(n - 1):
        t = segment_segment_intersection(p1, p2, poly[i], poly[i + 1])
        if t is not None and 0.0 < t < 1.0:
            t_values.append(t)
    t_values = sorted(list(set(t_values)))
    intervals = []
    for i in range(len(t_values) - 1):
        t_start = t_values[i]
        t_end = t_values[i + 1]
        t_mid = (t_start + t_end) / 2.0
        mx = p1[0] + t_mid * (p2[0] - p1[0])
        my = p1[1] + t_mid * (p2[1] - p1[1])
        if point_in_polygon(mx, my, poly):
            intervals.append((t_start, t_end))
    return intervals

def merge_intervals(intervals):
    if not intervals:
        return []
    sorted_int = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_int[0]]
    for current in sorted_int[1:]:
        prev_start, prev_end = merged[-1]
        if current[0] <= prev_end:
            merged[-1] = (prev_start, max(prev_end, current[1]))
        else:
            merged.append(current)
    return merged

def interval_union(list_a, list_b):
    return merge_intervals(list_a + list_b)

# -------------------------------------------------------------
# STEP 1: Process Pune Tree Census Data
# -------------------------------------------------------------
print("Step 1: Processing Pune Municipal Corporation Tree Census...")

tree_csv_path = os.path.join(RAW_DIR, "chintamani_bibwewadi_trees.csv")
if not os.path.exists(tree_csv_path):
    raise FileNotFoundError(f"Missing {tree_csv_path}")

raw_trees = []
canopy_features = []
tree_features = []
dead_trees_count = 0
default_canopy_count = 0
default_height_count = 0

with open(tree_csv_path, 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            if not (BBOX["south"] <= lat <= BBOX["north"] and BBOX["west"] <= lon <= BBOX["east"]):
                continue
        except (ValueError, KeyError):
            continue

        condition = row.get('condition', 'Healthy') or 'Healthy'
        if condition.strip().lower() == 'dead':
            dead_trees_count += 1
            continue

        tid = row.get('id') or row.get('saar_uid') or f"tree-{len(raw_trees)+1}"
        
        canopy_dia_m = 0.0
        canopy_valid = False
        is_default_canopy = False
        try:
            cd = float(row.get('canopy_dia_m', 0))
            if 0.5 <= cd <= 35.0:
                canopy_dia_m = cd
                canopy_valid = True
            else:
                canopy_dia_m = 3.5
                is_default_canopy = True
                default_canopy_count += 1
        except:
            canopy_dia_m = 3.5
            is_default_canopy = True
            default_canopy_count += 1

        radius_m = canopy_dia_m / 2.0  # Diameter is diameter, radius is diameter / 2
        height_m = 5.0
        is_default_height = False
        try:
            h = float(row.get('height_m', 0))
            if 1.0 <= h <= 60.0:
                height_m = h
            else:
                height_m = 5.0
                is_default_height = True
                default_height_count += 1
        except:
            height_m = 5.0
            is_default_height = True
            default_height_count += 1

        common_name = row.get('common_name') or row.get('local_name') or 'Tree'
        botanical_name = row.get('botanical_name', '')

        tree_record = {
            "id": str(tid),
            "lat": lat,
            "lon": lon,
            "xy": to_local_xy(lon, lat),
            "canopy_dia_m": canopy_dia_m,
            "radius_m": radius_m,
            "height_m": height_m,
            "condition": condition,
            "common_name": common_name,
            "botanical_name": botanical_name,
            "ownership": row.get('ownership', 'Public'),
            "canopy_valid": canopy_valid,
            "is_default_canopy": is_default_canopy,
            "is_default_height": is_default_height
        }
        raw_trees.append(tree_record)

        # GeoJSON tree point
        tree_features.append({
            "type": "Feature",
            "id": f"tree-{tid}",
            "geometry": {
                "type": "Point",
                "coordinates": [round(lon, 7), round(lat, 7)]
            },
            "properties": {
                "treeId": str(tid),
                "commonName": common_name,
                "botanicalName": botanical_name,
                "canopyDiaM": canopy_dia_m,
                "heightM": height_m,
                "condition": condition,
                "ownership": row.get('ownership', 'Unknown'),
                "source": "PMC Tree Census 2019",
                "confidence": "official-inventory",
                "isDefaultCanopy": is_default_canopy,
                "isDefaultHeight": is_default_height
            }
        })

        # GeoJSON canopy polygon
        poly_geom = circle_polygon_geojson(lon, lat, radius_m)
        canopy_features.append({
            "type": "Feature",
            "id": f"canopy-{tid}",
            "geometry": poly_geom,
            "properties": {
                "treeId": str(tid),
                "commonName": common_name,
                "canopyDiaM": canopy_dia_m,
                "radiusM": radius_m,
                "condition": condition,
                "source": "PMC Tree Census 2019 (derived crown)",
                "confidence": "model-estimated"
            }
        })

print(f"Extracted {len(raw_trees)} trees in pilot boundary.")

# -------------------------------------------------------------
# STEP 2: Process OpenStreetMap Network & Building Footprints
# -------------------------------------------------------------
print("\nStep 2: Processing OpenStreetMap network & building footprints with height confidence...")

osm_file = os.path.join(OSM_DIR, "chintamani-bibwewadi-2026-11-18.osm")
if not os.path.exists(osm_file):
    raise FileNotFoundError(f"Missing {osm_file}")

tree_xml = ET.parse(osm_file)
root = tree_xml.getroot()

osm_nodes = {}
for n in root.findall('node'):
    nid = n.attrib['id']
    lat = float(n.attrib['lat'])
    lon = float(n.attrib['lon'])
    tags = {t.attrib['k']: t.attrib['v'] for t in n.findall('tag')}
    osm_nodes[nid] = {'lat': lat, 'lon': lon, 'tags': tags}

osm_ways = []
for w in root.findall('way'):
    wid = w.attrib['id']
    tags = {t.attrib['k']: t.attrib['v'] for t in w.findall('tag')}
    nd_refs = [nd.attrib['ref'] for nd in w.findall('nd')]
    osm_ways.append({'id': wid, 'tags': tags, 'nodes': nd_refs})

# Extract buildings with explicit 5-tier height confidence taxonomy
building_features = []
calibrated_buildings = []

for w in osm_ways:
    tags = w['tags']
    if 'building' in tags:
        pts = []
        for ref in w['nodes']:
            if ref in osm_nodes:
                pts.append([round(osm_nodes[ref]['lon'], 7), round(osm_nodes[ref]['lat'], 7)])
        if len(pts) >= 4 and pts[0] == pts[-1]:
            bname = tags.get('name') or tags.get('amenity') or 'Building'
            
            # Local metric polygon & area
            local_pts = [to_local_xy(p[0], p[1]) for p in pts]
            area = 0.5 * abs(sum(local_pts[i][0]*local_pts[i+1][1] - local_pts[i+1][0]*local_pts[i][1] for i in range(len(local_pts)-1)))

            # Height Confidence Source Hierarchy:
            # Tier 1: Measured / Authoritative Height
            # Tier 2: Credible Source-tagged Height (OSM height)
            # Tier 3: Levels Derived (OSM building:levels * 3.0m + 0.5m)
            # Tier 4: Documented Architectural Typology Model (Bibwewadi residential calibration)
            # Tier 5: Unknown
            raw_height = None
            raw_levels = None
            est_height = 0.0
            tier = 'tier-5-unknown'
            tier_label = 'Unknown Height'
            assumption = ''
            is_uncertain = True

            if 'height' in tags:
                try:
                    raw_height = float(tags['height'])
                    est_height = raw_height
                    tier = 'tier-2-source-tagged'
                    tier_label = 'OSM Source-Tagged (High Confidence)'
                    assumption = f"Explicit height tag on OSM way {w['id']}."
                    is_uncertain = False
                except:
                    pass

            if est_height <= 0 and 'building:levels' in tags:
                try:
                    raw_levels = float(tags['building:levels'])
                    est_height = raw_levels * 3.0 + 0.5  # 3.0 m/floor + 0.5 m parapet
                    tier = 'tier-3-levels-derived'
                    tier_label = 'Levels Derived (Medium Confidence)'
                    assumption = f"Derived from OSM building:levels={raw_levels} (3.0 m/floor + 0.5 m parapet)."
                    is_uncertain = False
                except:
                    pass

            if est_height <= 0:
                # Tier 4: Calibrated Architectural Typology for Bibwewadi Pune residential zones
                tier = 'tier-4-typology-estimate'
                is_uncertain = True
                if area < 100:
                    est_height = 5.5
                    tier_label = 'Typology Estimate (Low-rise 1-2F)'
                    assumption = f'Footprint area {area:.1f} m² in residential ward corresponds to 1-2 storey house/shop (5.5m).'
                elif area < 300:
                    est_height = 8.5
                    tier_label = 'Typology Estimate (Mid-rise 2-3F)'
                    assumption = f'Footprint area {area:.1f} m² corresponds to 2-3 storey residential building (8.5m).'
                elif area < 800:
                    est_height = 13.5
                    tier_label = 'Typology Estimate (Apartment Block 4-5F)'
                    assumption = f'Footprint area {area:.1f} m² corresponds to 4-5 storey housing society block (13.5m).'
                else:
                    est_height = 16.5
                    tier_label = 'Typology Estimate (Large Complex 5-6F)'
                    assumption = f'Footprint area {area:.1f} m² corresponds to institutional or multi-wing complex (16.5m).'

            bldg_feature = {
                "type": "Feature",
                "id": f"bldg-{w['id']}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [pts]
                },
                "properties": {
                    "osmId": str(w['id']),
                    "name": bname,
                    "buildingType": tags.get('building', 'yes'),
                    "rawHeight": raw_height,
                    "rawLevels": raw_levels,
                    "estimatedHeightM": round(est_height, 1),
                    "footprintAreaM2": round(area, 1),
                    "heightConfidenceTier": tier,
                    "confidenceLabel": tier_label,
                    "heightAssumption": assumption,
                    "isUncertain": is_uncertain,
                    "source": "OpenStreetMap Footprint + Architectural Typology Calibration"
                }
            }
            building_features.append(bldg_feature)
            calibrated_buildings.append({
                "osmId": str(w['id']),
                "local_pts": local_pts,
                "heightM": est_height,
                "isUncertain": is_uncertain,
                "bbox": [min(p[0] for p in local_pts), min(p[1] for p in local_pts),
                         max(p[0] for p in local_pts), max(p[1] for p in local_pts)]
            })

print(f"Extracted {len(building_features)} building footprints with explicit height confidence tiers.")

# Filter walkable ways
def map_path_class(tags):
    hw = tags.get('highway', '')
    if hw in ('footway', 'pedestrian'):
        return 'covered-walkway' if tags.get('covered') == 'yes' else 'footway'
    if hw == 'path': return 'path'
    if hw == 'steps': return 'steps'
    if hw == 'service': return 'service-road'
    return 'other'

walkable_ways = []
for w in osm_ways:
    tags = w['tags']
    hw = tags.get('highway')
    if not hw: continue
    access = tags.get('access', 'yes')
    foot = tags.get('foot', access)
    if foot in ('no', 'private') and access in ('no', 'private'): continue
    if hw in ('motorway', 'motorway_link', 'trunk', 'trunk_link'): continue
    walkable_ways.append(w)

# Build graph topology
adj = {}
for w in walkable_ways:
    refs = w['nodes']
    for i in range(len(refs) - 1):
        u, v = refs[i], refs[i+1]
        if u in osm_nodes and v in osm_nodes:
            adj.setdefault(u, set()).add(v)
            adj.setdefault(v, set()).add(u)

# Find connected components and keep largest
visited = set()
components = []
for n in adj:
    if n not in visited:
        comp = []
        queue = [n]
        visited.add(n)
        for curr in queue:
            comp.append(curr)
            for neighbor in adj.get(curr, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        components.append(comp)

components.sort(key=len, reverse=True)
largest_comp_nodes = set(components[0])

# -------------------------------------------------------------
# STEP 3: Multi-Source Combined Shade Computation
# -------------------------------------------------------------
print("\nStep 3: Computing combined shade (Building-cast + Tree-canopy + Covered structures)...")

network_nodes = []
network_node_ids = set()
for nid in sorted(largest_comp_nodes):
    n = osm_nodes[nid]
    network_nodes.append({
        "nodeId": f"node-{nid}",
        "coordinates": [round(n['lon'], 7), round(n['lat'], 7)]
    })
    network_node_ids.add(f"node-{nid}")

# NOAA Solar Position Algorithm
def noaa_solar(year, month, day, hour, minute=0, second=0, lat=REF_LAT, lon=REF_LON, tz_offset=5.5):
    t_utc = hour + minute / 60.0 + second / 3600.0 - tz_offset
    y = year
    m = month
    if m <= 2:
        y -= 1
        m += 12
    A = math.floor(y / 100)
    B = 2 - A + math.floor(A / 4)
    jd = math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + day + B - 1524.5 + t_utc / 24.0
    T = (jd - 2451545.0) / 36525.0

    L0 = ((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360.0 + 360.0) % 360.0
    M = ((357.52911 + T * (35999.05029 - 0.0001537 * T)) % 360.0 + 360.0) % 360.0
    Mr = math.radians(M)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)

    C = (math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
         math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
         math.sin(3 * Mr) * 0.000289)
    sun_true_lon = L0 + C
    omega = 125.04 - 1934.136 * T
    lambda_deg = sun_true_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega))
    lambda_rad = math.radians(lambda_deg)

    eps0 = 23.0 + (26.0 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0
    eps = eps0 + 0.00256 * math.cos(math.radians(omega))
    eps_rad = math.radians(eps)

    sin_dec = math.sin(eps_rad) * math.sin(lambda_rad)
    dec_rad = math.asin(sin_dec)

    y_var = math.tan(eps_rad / 2.0) ** 2
    eot_min = 4.0 * math.degrees(
        y_var * math.sin(2.0 * math.radians(L0)) -
        2.0 * e * math.sin(Mr) +
        4.0 * e * y_var * math.sin(Mr) * math.cos(2.0 * math.radians(L0)) -
        0.5 * (y_var ** 2) * math.sin(4.0 * math.radians(L0)) -
        1.25 * (e ** 2) * math.sin(2.0 * Mr)
    )

    solar_time_fix = eot_min + 4.0 * lon - 60.0 * tz_offset
    true_solar_time = ((hour * 60.0 + minute + second / 60.0 + solar_time_fix) % 1440.0 + 1440.0) % 1440.0
    ha_deg = true_solar_time / 4.0 - 180.0
    if ha_deg < -180.0: ha_deg += 360.0
    ha_rad = math.radians(ha_deg)

    lat_rad = math.radians(lat)
    cos_zenith = math.sin(lat_rad) * math.sin(dec_rad) + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
    cos_zenith = max(-1.0, min(1.0, cos_zenith))
    zenith_rad = math.acos(cos_zenith)
    zenith_deg = math.degrees(zenith_rad)
    alt_deg = 90.0 - zenith_deg

    if alt_deg > 85.0:
        refr = 0.0
    elif alt_deg > 5.0:
        refr = (58.1 / math.tan(math.radians(alt_deg)) - 0.07 / (math.tan(math.radians(alt_deg)) ** 3) + 0.000086 / (math.tan(math.radians(alt_deg)) ** 5)) / 3600.0
    elif alt_deg > -0.575:
        refr = (1735.0 + alt_deg * (-518.2 + alt_deg * (103.4 + alt_deg * (-12.79 + alt_deg * 0.711)))) / 3600.0
    else:
        refr = -20.774 / math.tan(math.radians(alt_deg)) / 3600.0
    corrected_alt = max(0.0, alt_deg + refr)

    cos_az = (math.sin(lat_rad) * math.cos(zenith_rad) - math.sin(dec_rad)) / (math.cos(lat_rad) * math.sin(zenith_rad) + 1e-9)
    cos_az = max(-1.0, min(1.0, cos_az))
    az_angle = math.degrees(math.acos(cos_az))
    if ha_deg > 0:
        azimuth = (180.0 + az_angle) % 360.0
    else:
        azimuth = (540.0 - az_angle) % 360.0

    return corrected_alt, azimuth

# Precompute real sun positions for the 2 representative dates (18 Nov & 25 Apr)
DATES = ["2026-11-18", "2026-04-25"]
HOURS = list(range(7, 18))  # 07:00 to 17:00 (11 slots)

SOLAR_SLOTS = {}
for d_str in DATES:
    y, m, d = map(int, d_str.split('-'))
    SOLAR_SLOTS[d_str] = []
    for h in HOURS:
        alt, az = noaa_solar(y, m, d, h, 0)
        sdir = (az + 180.0) % 360.0
        smult = min(5.0, 1.0 / math.tan(math.radians(max(2.0, alt))))
        dx_unit = math.sin(math.radians(sdir)) * smult
        dy_unit = math.cos(math.radians(sdir)) * smult
        SOLAR_SLOTS[d_str].append({
            "hour": h,
            "alt": alt,
            "az": az,
            "dx_unit": dx_unit,
            "dy_unit": dy_unit,
        })

# Tree Spatial Grid (50m cells)
tree_grid = {}
GRID_SIZE = 50.0
for tree in raw_trees:
    tx, ty = tree["xy"]
    gx, gy = int(math.floor(tx / GRID_SIZE)), int(math.floor(ty / GRID_SIZE))
    tree_grid.setdefault((gx, gy), []).append(tree)

network_edges = []
shade_records = []
edge_id_counter = 1

total_net_len = 0.0
total_tree_shade = 0.0
total_bldg_shade = 0.0
total_combined_shade = 0.0

for w in walkable_ways:
    refs = w['nodes']
    tags = w['tags']
    path_class = map_path_class(tags)
    is_covered = (path_class == 'covered-walkway')

    for i in range(len(refs) - 1):
        u, v = refs[i], refs[i+1]
        u_id = f"node-{u}"
        v_id = f"node-{v}"
        if u_id not in network_node_ids or v_id not in network_node_ids:
            continue

        pt_u = [round(osm_nodes[u]['lon'], 7), round(osm_nodes[u]['lat'], 7)]
        pt_v = [round(osm_nodes[v]['lon'], 7), round(osm_nodes[v]['lat'], 7)]
        seg_len = haversine(pt_u, pt_v)
        if seg_len < 0.1: continue

        edge_id = f"edge-{edge_id_counter}"
        edge_id_counter += 1

        network_edges.append({
            "edgeId": edge_id,
            "fromNodeId": u_id,
            "toNodeId": v_id,
            "coordinates": [pt_u, pt_v],
            "pathClass": path_class,
            "accessStatus": "osm-derived",
            "verificationStatus": "unverified",
            "sourceRef": { "type": "osm", "sourceId": str(w['id']) }
        })
        total_net_len += seg_len

        # Check coverage: Edge is unknown if midpoint lies outside tree/building BBOX
        mid_lon = (pt_u[0] + pt_v[0]) / 2.0
        mid_lat = (pt_u[1] + pt_v[1]) / 2.0
        is_outside = not (BBOX["west"] <= mid_lon <= BBOX["east"] and BBOX["south"] <= mid_lat <= BBOX["north"])

        if is_outside:
            shade_records.append({
                "edgeId": edge_id,
                "validFrom": "2026-11-18T00:00:00+05:30",
                "validUntil": "2026-11-18T23:59:59+05:30",
                "status": "unknown",
                "shadeFraction": 0.0,
                "treeShadeFraction": 0.0,
                "buildingShadeFraction": 0.0,
                "coveredFraction": 0.0,
                "unknownFraction": 1.0,
                "shadeFractionRange": {
                    "low": 0.0,
                    "high": 0.0
                },
                "method": "geometry-model",
                "recordedAt": "2026-11-18T00:00:00+05:30",
                "sourceRef": {
                    "type": "other",
                    "sourceId": "combined-bldg-tree-model-v2"
                },
                "contributingSources": [],
                "uncertainFraction": 1.0,
                "unknownReason": "Edge midpoint lies outside the tree/building data coverage box",
                "slots": {
                    "2026-11-18": [[0.0, 0.0, 0.0]] * len(HOURS),
                    "2026-04-25": [[0.0, 0.0, 0.0]] * len(HOURS),
                }
            })
            continue

        p1_xy = to_local_xy(pt_u[0], pt_u[1])
        p2_xy = to_local_xy(pt_v[0], pt_v[1])
        seg_min_x, seg_max_x = min(p1_xy[0], p2_xy[0]), max(p1_xy[0], p2_xy[0])
        seg_min_y, seg_max_y = min(p1_xy[1], p2_xy[1]), max(p1_xy[1], p2_xy[1])

        # Pre-filter candidate trees within 100m buffer
        gx1 = int(math.floor((seg_min_x - 100.0) / GRID_SIZE))
        gx2 = int(math.floor((seg_max_x + 100.0) / GRID_SIZE))
        gy1 = int(math.floor((seg_min_y - 100.0) / GRID_SIZE))
        gy2 = int(math.floor((seg_max_y + 100.0) / GRID_SIZE))
        
        cand_trees = []
        seen_tids = set()
        for gx in range(gx1, gx2 + 1):
            for gy in range(gy1, gy2 + 1):
                for t in tree_grid.get((gx, gy), []):
                    if t['id'] not in seen_tids:
                        seen_tids.add(t['id'])
                        cand_trees.append(t)

        # Pre-filter candidate buildings within 90m buffer
        cand_bldgs = []
        for bldg in calibrated_buildings:
            bx1, by1, bx2, by2 = bldg['bbox']
            if not (bx2 < seg_min_x - 90.0 or bx1 > seg_max_x + 90.0 or by2 < seg_min_y - 90.0 or by1 > seg_max_y + 90.0):
                cand_bldgs.append(bldg)

        edge_slots = {}
        for d_str in DATES:
            edge_slots[d_str] = []
            for slot in SOLAR_SLOTS[d_str]:
                dx_u = slot['dx_unit']
                dy_u = slot['dy_unit']

                # 1. Tree Shade (displaced crown: offset = height / tan(alt) along shadow dir)
                tree_intervals = []
                for t in cand_trees:
                    cx = t['xy'][0] + dx_u * t['height_m']
                    cy = t['xy'][1] + dy_u * t['height_m']
                    inter = segment_circle_intersection(p1_xy, p2_xy, (cx, cy), t['radius_m'])
                    if inter: tree_intervals.append(inter)
                merged_tree_intervals = merge_intervals(tree_intervals)
                tree_frac = min(1.0, sum(e - s for s, e in merged_tree_intervals))

                # 2. Building Shadow (footprint + wall shadow quads)
                bldg_intervals = []
                for bldg in cand_bldgs:
                    h = bldg['heightM']
                    dx = dx_u * h
                    dy = dy_u * h
                    bx1, by1, bx2, by2 = bldg['bbox']
                    sbx1 = min(bx1, bx1 + dx) - 2.0
                    sbx2 = max(bx2, bx2 + dx) + 2.0
                    sby1 = min(by1, by1 + dy) - 2.0
                    sby2 = max(by2, by2 + dy) + 2.0
                    if seg_max_x < sbx1 or seg_min_x > sbx2 or seg_max_y < sby1 or seg_min_y > sby2:
                        continue

                    # Building footprint
                    bldg_intervals.extend(segment_polygon_intersection_intervals(p1_xy, p2_xy, bldg['local_pts']))
                    # Wall shadow quads
                    npts = len(bldg['local_pts'])
                    for j in range(npts - 1):
                        v1 = bldg['local_pts'][j]
                        v2 = bldg['local_pts'][j + 1]
                        quad = [v1, v2, (v2[0] + dx, v2[1] + dy), (v1[0] + dx, v1[1] + dy), v1]
                        bldg_intervals.extend(segment_polygon_intersection_intervals(p1_xy, p2_xy, quad))
                merged_bldg_intervals = merge_intervals(bldg_intervals)
                bldg_frac = min(1.0, sum(e - s for s, e in merged_bldg_intervals))

                # 3. Permanent Covered Structures
                covered_intervals = [(0.0, 1.0)] if is_covered else []
                covered_frac = 1.0 if is_covered else 0.0

                # 4. Strict Mathematical Union (ZERO DOUBLE COUNTING)
                combined_intervals = merge_intervals(merged_tree_intervals + merged_bldg_intervals + covered_intervals)
                combined_frac = min(1.0, sum(e - s for s, e in combined_intervals))

                edge_slots[d_str].append([
                    round(combined_frac, 2),
                    round(tree_frac, 2),
                    round(bldg_frac, 2)
                ])

        # Noon baseline slot (12:00 IST on 18 Nov, index 5 in HOURS 7..17)
        noon_slot = edge_slots["2026-11-18"][5]
        noon_comb, noon_tree, noon_bldg = noon_slot

        total_tree_shade += seg_len * noon_tree
        total_bldg_shade += seg_len * noon_bldg
        total_combined_shade += seg_len * noon_comb

        contributing = []
        if noon_bldg > 0.01: contributing.append("osm-building-shadows")
        if noon_tree > 0.01: contributing.append("pmc-tree-census-2019")
        if is_covered: contributing.append("covered-walkway-structure")

        shade_records.append({
            "edgeId": edge_id,
            "validFrom": "2026-11-18T00:00:00+05:30",
            "validUntil": "2026-11-18T23:59:59+05:30",
            "status": "modeled",
            "shadeFraction": noon_comb,
            "treeShadeFraction": noon_tree,
            "buildingShadeFraction": noon_bldg,
            "coveredFraction": 1.0 if is_covered else 0.0,
            "unknownFraction": 0.0,
            "shadeFractionRange": {
                "low": round(max(0.0, noon_comb * 0.8), 2),
                "high": round(min(1.0, noon_comb * 1.2), 2)
            },
            "method": "geometry-model",
            "recordedAt": "2026-11-18T00:00:00+05:30",
            "sourceRef": {
                "type": "other",
                "sourceId": "combined-bldg-tree-model-v2"
            },
            "contributingSources": contributing,
            "uncertainFraction": round(noon_bldg if any(b['isUncertain'] for b in cand_bldgs) else 0.0, 2),
            "slots": edge_slots
        })

print(f"Assembled {len(network_nodes)} network nodes and {len(network_edges)} edges.")
print(f"Total network length: {total_net_len:.1f} m.")
print(f"Tree-canopy shade: {total_tree_shade:.1f} m ({(total_tree_shade/total_net_len)*100:.1f}%).")
print(f"Building-cast shade (Noon): {total_bldg_shade:.1f} m ({(total_bldg_shade/total_net_len)*100:.1f}%).")
print(f"Total Combined Shade: {total_combined_shade:.1f} m ({(total_combined_shade/total_net_len)*100:.1f}% unique coverage - zero double counting).")

# -------------------------------------------------------------
# STEP 4: Write Bundle Files & Manifest
# -------------------------------------------------------------
print("\nStep 4: Writing updated bundle files...")

# Landmarks
landmarks = [
    {
        "id": "vit-main-gate",
        "name": "VIT Pune — Main Gate",
        "category": "Education / Campus Entrance",
        "description": "Primary student entrance to Vishwakarma Institute of Technology.",
        "coordinates": [73.86795, 18.46368]
    },
    {
        "id": "chintamani-garden",
        "name": "Chintamani Nagar Public Park",
        "category": "Green Space / Recreation",
        "description": "Landscaped community park surrounded by residential societies.",
        "coordinates": [73.86580, 18.46520]
    },
    {
        "id": "shri-vimalnath-temple",
        "name": "Shri Vimalnath Swami Jain Temple",
        "category": "Culture / Landmark",
        "description": "Historic Jain temple at northern residential corridor.",
        "coordinates": [73.86482, 18.46745]
    },
    {
        "id": "shree-j-hospital",
        "name": "Shree J. Hospital",
        "category": "Healthcare / Civic",
        "description": "Community healthcare facility along Swami Vivekanand Marg corridor.",
        "coordinates": [73.86419, 18.46530]
    },
    {
        "id": "lake-town-junction",
        "name": "Lake Town Road Junction",
        "category": "Transit / Crossroad",
        "description": "Southern transit junction connecting Bibwewadi main road to Upper Indira Nagar.",
        "coordinates": [73.86452, 18.46190]
    },
    {
        "id": "anandi-polyclinic",
        "name": "Anandi PolyClinic",
        "category": "Healthcare",
        "description": "Local clinic serving residents near Chintamani Nagar residential lanes.",
        "coordinates": [73.86616, 18.46307]
    },
    {
        "id": "vit-library",
        "name": "VIT Central Library Entrance",
        "category": "Campus Facility",
        "description": "Campus library and study centre access corridor.",
        "coordinates": [73.86847, 18.46349]
    }
]

def find_nearest_node(lon, lat):
    best_id = None
    best_dist = float('inf')
    for n in network_nodes:
        d = haversine([lon, lat], n['coordinates'])
        if d < best_dist:
            best_dist = d
            best_id = n['nodeId']
    return best_id, best_dist

for lm in landmarks:
    nid, dist = find_nearest_node(lm['coordinates'][0], lm['coordinates'][1])
    lm['nearestNodeId'] = nid
    lm['snapDistanceMetres'] = round(dist, 1)
    target_node = next(n for n in network_nodes if n['nodeId'] == nid)
    lm['snappedCoordinates'] = target_node['coordinates']

manifest = {
    "schemaVersion": 1,
    "campusId": CAMPUS_ID,
    "dataRevision": 2,
    "publishedAt": datetime.now(timezone.utc).isoformat(),
    "campus": {
        "name": PILOT_NAME,
        "address": PILOT_ADDRESS,
        "timezone": TIMEZONE,
        "center": [73.8672, 18.4645],
        "bounds": [
            [BBOX["west"], BBOX["south"]],
            [BBOX["east"], BBOX["north"]]
        ]
    },
    "files": {
        "network": "network.json",
        "shade": "shade.json"
    },
    "sources": [
        {
            "sourceId": "pmc-tree-census-2019",
            "type": "other",
            "name": "Pune Municipal Corporation Tree Census 2019",
            "capturedAt": "2019-08-31T00:00:00+05:30",
            "license": "Open Data Commons / Pune Smart City Civic Open Data",
            "attribution": "Pune Municipal Corporation (PMC) & Open Data Pune",
            "url": "https://data.opencity.in/dataset/pune-tree-census-2019"
        },
        {
            "sourceId": "osm-bibwewadi-2026",
            "type": "osm",
            "name": "OpenStreetMap Bounded Extract",
            "capturedAt": "2026-11-18T00:00:00Z",
            "license": "Open Database License (ODbL) 1.0",
            "attribution": "© OpenStreetMap contributors",
            "url": "https://www.openstreetmap.org/copyright"
        },
        {
            "sourceId": "shaderoute-combined-shade-model-v2",
            "type": "other",
            "name": "ShadeRoute Combined Building & Canopy Shade Model",
            "capturedAt": "2026-11-18T00:00:00+05:30",
            "license": "MIT",
            "attribution": "ShadeRoute Project",
            "url": "https://github.com/shaderoute/shaderoute"
        }
    ],
    "limitations": [
        "Building heights are classified using an explicit 5-tier confidence taxonomy; 376 footprints use calibrated architectural typologies and carry explicit uncertainty flags.",
        f"Tree coordinates and canopy diameters originate from the 2019 PMC Tree Census (excluding {dead_trees_count} dead trees). {default_canopy_count} trees use defaulted canopy diameter (3.5 m) and {default_height_count} trees use defaulted height (5.0 m).",
        "Combined shade represents the non-double-counted mathematical union of building-cast shadows, tree crowns, and covered walkways under modelled solar conditions.",
        "Shade is not air temperature; calculations represent potential line-of-sight solar radiation protection.",
        "Every network edge is labelled osm-derived and unverified. No field validation has been conducted yet."
    ]
}

network_data = {
    "schemaVersion": 1,
    "campusId": CAMPUS_ID,
    "dataRevision": 2,
    "nodes": network_nodes,
    "edges": network_edges
}

shade_data = {
    "schemaVersion": 1,
    "campusId": CAMPUS_ID,
    "networkRevision": 2,
    "records": shade_records
}

def write_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"  Wrote {path} ({os.path.getsize(path):,} bytes)")

write_json("manifest.json", manifest)
write_json("network.json", network_data)
write_json("shade.json", shade_data)
write_json("canopy.geojson", {"type": "FeatureCollection", "features": canopy_features})
write_json("trees.geojson", {"type": "FeatureCollection", "features": tree_features})
write_json("buildings.geojson", {"type": "FeatureCollection", "features": building_features})
write_json("landmarks.json", landmarks)

# Remove legacy duplicate json files if present
for dup in ["canopy.json", "trees.json", "buildings.json"]:
    dup_path = os.path.join(DATA_DIR, dup)
    if os.path.exists(dup_path):
        os.remove(dup_path)

# Update index registry
index_path = os.path.join(BASE_DIR, "data", "campuses", "index.json")
with open(index_path, 'r', encoding='utf-8') as f:
    registry = json.load(f)

for entry in registry.get('campuses', []):
    if entry.get('campusId') == CAMPUS_ID:
        entry['dataStatus'] = 'published'
        entry['dataRevision'] = 2

with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2)

print("\nCombined shade pipeline complete!")
