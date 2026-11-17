# ShadeRoute — Data Provenance & Lineage Specification

## 1. Executive Summary

ShadeRoute is a zero-budget, climate-aware pedestrian navigation system that integrates civic municipal tree inventories and OpenStreetMap pedestrian topology to help pedestrians evaluate environmental trade-offs between walking routes.

Every environmental and network feature used in ShadeRoute adheres to strict lineage, confidence categorization, and licensing rules.

---

## 2. Selected Pilot Area: Chintamani Nagar & Surrounding Bibwewadi Streets

- **Pilot Identifier:** `in-mh-pune-chintamani-bibwewadi`
- **Geographic Extent (WGS 84 / EPSG:4326):**
  - West Longitude: `73.8640° E`
  - South Latitude: `18.4615° N`
  - East Longitude: `73.8710° E`
  - North Latitude: `18.4675° N`
- **Area Rationale:** 
  Selected over the restricted VIT campus interior because:
  1. High pedestrian connectivity: 200 walkable ways forming a 698-node connected pedestrian graph.
  2. Public access certainty: Unrestricted municipal residential streets, public avenues, and pedestrian footways.
  3. Abundant environmental evidence: 3,803 individual geo-tagged trees with 3,752 measured canopy diameters from the official Pune Tree Census.
  4. Active pedestrian corridor connecting transit nodes (Lake Town Junction, Swami Vivekanand Marg) to student destinations (VIT Main Gate, parks, healthcare clinics).

---

## 3. Data Sources & Provenance Records

### A. Pune Municipal Corporation (PMC) Tree Census 2019
- **Source Authority:** Pune Municipal Corporation (Garden & Tree Authority Department) in collaboration with Saar IT Solutions and Open Data Pune / Datameet Pune.
- **Original Census Period:** Completed August 2019.
- **Extraction & Filter Date:** November 2026.
- **Licensing:** Open Data Commons / Pune Smart City Civic Open Data.
- **Raw Records Extracted in Pilot Boundary:** 3,803 trees.
- **Coordinate Reference System:** WGS 84 (EPSG:4326). Raw `easting` represents decimal longitude (~73.87°E) and `northing` represents decimal latitude (~18.46°N), verified against `geom: POINT (lon lat)`.
- **Attributes Captured:**
  - `id` / `saar_uid`: Unique municipal tree identifier.
  - `canopy_dia_m`: Measured canopy diameter in metres (1.0 m to 21.0 m; average 4.25 m).
  - `height_m`: Measured tree height in metres (3.0 m to 16.0 m; average 7.2 m).
  - `girth_cm`: Measured trunk girth at breast height.
  - `condition`: Health status (`Healthy` 3,676; `Dead` 65; `Poor` 49; `Average` 13).
  - `ownership`: `Private` (residential plots), `Garden` (public parks), `On Foot Path` (avenues), `On Road`.
  - `common_name` / `botanical_name`: Species classification (Ashoka, Mango, Coconut, Silver Oak, Subabul, Yellow Bells, Neem, Jamun, etc.).
- **Validation Results:**
  - Coordinate validity: 100% within defensible pilot bounding box.
  - Co-located duplicates: 0 co-located records in filtered bounding box.
  - Valid canopy measurements: 3,752 of 3,803 (98.7%). Missing/zero values (1.3%) imputed with conservative local median (3.5 m) and flagged.

### B. OpenStreetMap Pedestrian & Built Environment Data
- **Source Authority:** OpenStreetMap Foundation & Volunteer Contributors.
- **Extraction Timestamp:** 2026-11-18T00:43:25Z via official OpenStreetMap API (`https://api.openstreetmap.org/api/0.6/map`).
- **Preserved Archive:** `data/osm/chintamani-bibwewadi-2026-11-18.osm`
- **Archive SHA-256 Checksum:** `FA21890250E8DE088033621471375B8D148BDDC0C7F9DE11762B34B4582C0EBA`
- **Licensing:** Open Database License (ODbL) 1.0. Attribution required: `© OpenStreetMap contributors`.
- **Network Scope:**
  - Total nodes in snapshot: 3,363
  - Total ways in snapshot: 627
  - Walkable pedestrian highways extracted: 200 ways
  - Largest connected graph component: 698 nodes, 836 edges (23.6 km of pedestrian path).
  - Building footprints: 376 mapped building polygons.

### C. Building Heights & 5-Tier Confidence Taxonomy
Building-cast shadow calculations require 3D building envelopes. To avoid arbitrary default heights, ShadeRoute implements an explicit 5-tier source hierarchy:

1. **Tier 1 (Measured / Authoritative):** Terrestrial LiDAR, municipal building permits, high-resolution DSM/DTM (none publicly available for this pilot without commercial licensing). Confidence: High. `isUncertain: false`.
2. **Tier 2 (Source-Tagged):** OSM `height=*` tag explicitly recorded by surveyor. Confidence: High. `isUncertain: false`.
3. **Tier 3 (Levels-Derived):** OSM `building:levels=*` converted via $H = \text{levels} \times 3.0\text{ m} + 0.5\text{ m}$ (parapet). Confidence: Medium. `isUncertain: false`.
4. **Tier 4 (Calibrated Architectural Typology):** Documented typology calibrated for Bibwewadi Pune residential societies based on footprint polygon area. Confidence: Low. `isUncertain: true`.
   - Area $< 100\text{ m}^2$: 5.5 m (1–2 floors)
   - Area $100–300\text{ m}^2$: 8.5 m (2–3 floors)
   - Area $300–800\text{ m}^2$: 13.5 m (4–5 floors apartment society)
   - Area $> 800\text{ m}^2$: 16.5 m (5–6 floors multi-wing society)
5. **Tier 5 (Unknown):** Uncontextualized footprints; excluded from shadow casting.

All 376 buildings in the pilot area are preserved with original OSM attributes, derived heights, explicit typology rationales, and uncertainty metadata.

### D. Solar Position & Shadow Projections
- **Model:** Solar Position Algorithm (NOAA / Astronomical Almanac formulas calibrated for Pune at 18.464°N, 73.867°E, UTC+05:30).
- **Attributes Generated:** Solar altitude, solar azimuth, shadow length multiplier, and directional offset.
- **Confidence Category:** Model-estimated.

---

## 4. Confidence Tiering Taxonomy

Features in ShadeRoute are assigned explicit confidence categories rendered transparently in the user interface:

1. **Official Municipal Inventory (`official-inventory`):**
   - Individual tree trunk coordinates, species, measured canopy diameter, height, and health condition originating directly from the PMC Tree Census.
2. **OpenStreetMap Mapped (`osm-mapped`):**
   - Public street geometries, pedestrian crossings, footpaths, steps, and building footprints from OSM.
3. **Model Estimated (`model-estimated`):**
   - Circular canopy crown polygons derived from measured canopy diameters ($R = D/2$).
   - Parametric line-segment canopy overlap percentages.
   - Solar shadow directional projections.
4. **Field Verified (`field-verified`):**
   - Verified pedestrian gates, landmark destinations (VIT Main Gate, Chintamani Garden, Jain Temple, Shree J Hospital), and public access status.
5. **Unknown (`unknown`):**
   - Segments lacking tree data, microclimate ambient temperature, or recent unrecorded tree felling. Unknown is explicitly displayed as unknown; it is never converted into an assumption of shade or sun.

---

## 5. Storage and Data Regeneration

- All raw downloads (large zip archives, CSV caches) reside strictly in the untracked `.system_generated/` and `scratch/` folders to keep Git repositories lightweight.
- Versioned, schema-validated bundles are committed under `data/campuses/in-mh-pune-chintamani-bibwewadi/`.
- The pipeline can be reproduced at any time by executing:
  ```powershell
  python scripts/process_pilot_data.py
  python scripts/validate_bundle.py
  ```
