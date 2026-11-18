# ShadeRoute

**Take the cooler way.**

ShadeRoute is a zero-budget, climate-aware pedestrian navigation web application that helps people choose walking routes with lower direct sun exposure. Conventional navigation applications optimize solely for vehicle travel time or shortest physical distance. ShadeRoute evaluates pedestrian pathways against physical environmental data—combining building-cast shadows, municipal tree canopies, covered walkways, and dynamic solar angles—to help pedestrians understand environmental trade-offs between alternative routes.

---

## 1. Key Features

- **Combined Built & Natural Environment Intelligence:**
  - **Building-Cast Shadows:** Dynamic ground shadow polygons computed via 2D convex hulls of building base and roof projections according to real-time astronomical solar position.
  - **Tree-Canopy Shadows:** Circular crowns ($R = D/2$) derived from 3,738 active municipal tree records (excluding dead trees) with measured canopy diameters.
  - **Covered Walkways:** Permanent architectural coverings, arcades, and transit structures.
  - **Non-Double-Counting Union:** Strict mathematical union ($A + B - A \cdot B$) prevents artificial shade inflation where building shadows fall across tree crowns.
- **5-Tier Building Height Confidence Hierarchy:**
  - Tier 1: Measured / Authoritative (LiDAR/permits)
  - Tier 2: Source-Tagged (OSM `height=*`)
  - Tier 3: Levels-Derived (OSM `building:levels=*`)
  - Tier 4: Calibrated Architectural Typology (Bibwewadi residential society areas) with explicit uncertainty tags
  - Tier 5: Unknown
- **Dynamic Departure-Time Progression:**
  - Evaluates each route segment at the estimated time the pedestrian reaches it based on a 1.25 m/s walking speed, capturing shifting shadow geometry as the pedestrian advances.
  - Quick presets: Morning (09:30), Solar Noon (12:30), Afternoon (15:30), Late Day (17:00), plus continuous time slider.
- **Three Meaningful Route Alternatives:**
  1. **Shortest Distance:** Direct path minimizing travel distance and walking time via Dijkstra shortest path search.
  2. **Cooler Way (More Shade):** Minimizes minutes in direct sun subject to a hard $\le 25\%$ distance detour constraint via bicriteria Pareto label-setting search.
  3. **Balanced Route:** Compromise route prioritizing shade with at most a 15% distance detour.
- **Transparent Environmental Trade-off Metrics:**
  - **Minutes in direct sun** (Headline Metric): Calculated as $\sum \frac{\text{length} \times (1 - \text{shade})}{v_{\text{walk}} \times 60}$ at edge arrival time.
  - Walking distance (metres) & duration (minutes at 1.25 m/s)
  - Sun minutes saved and detour percentage vs shortest route
  - Combined shade coverage (percentage and metres)
  - Independent breakdown: Building Shade % vs Tree Canopy % vs Covered Walkway %
  - Unknown coverage % (midpoints outside data coverage box, never counted as exposed)
  - Uncertainty percentage (share of route reliant on Tier 4/5 height assumptions)
  - Honest recommendation: If cooler route gains less than 1.0 minute in direct sun, it states plainly *"Shortest route is already about as shaded"*.
- **Curated Demonstration Trips:**
  - 3 trips where the cooler route clearly wins (saving 1.2 to 2.6 minutes in direct sun within 25% detour)
  - 1 trip where the shortest route is optimal / about as shaded (honestly recommending shortest with no detour)
- **Interactive Multi-Layer Cartography & Scrubber:**
  - Semicircular sun-arc scrubber controlling time of day (07:00 to 17:00) with live solar altitude/azimuth readouts and Nov/Apr season toggle.
  - Proportional shade ribbons on route cards displaying sunny, shaded, and hatched unknown fractions.
  - Independent layer toggles: 🏢 Building Shadows, 🌳 Tree Crowns, 📍 Tree Trunks, 🏛️ Buildings, 🚶 Street Network, ❓ Height Uncertainty.
- **Scientific Honesty & Validation Status:**
  - Shade estimates are modelled from OpenStreetMap footprints, estimated building heights and the 2019 PMC tree census. **No field validation has been done yet.**
  - Every network edge is labelled `accessStatus: "osm-derived"` and `verificationStatus: "unverified"`.
  - Zero fake or placeholder observation data or observation files.
  - Explains plainly that shade is radiant heat blockage, not ambient air temperature.

---

## 2. Selected Pilot Area: Chintamani Nagar & Bibwewadi

- **Identifier:** `in-mh-pune-chintamani-bibwewadi`
- **Geographic Boundary (WGS 84):**
  - West: `73.8640° E`
  - South: `18.4615° N`
  - East: `73.8710° E`
  - North: `18.4675° N`
- **Why this area was chosen:**
  1. **Connectivity:** 200 walkable highway ways forming a continuous connected graph of 698 nodes and 836 edges (23.6 km of pedestrian street network).
  2. **Public Access Status:** Every network edge is labelled `accessStatus: "osm-derived"` and `verificationStatus: "unverified"`. No field validation has been conducted yet; routes are derived from public OpenStreetMap pedestrian ways.
  3. **High-Density Environmental Evidence:** 3,738 active geo-tagged municipal trees (65 dead trees excluded) from the official Pune Tree Census (average canopy diameter 4.25 m).
  4. **Active Pedestrian Corridors:** Connects transit crossroads (Lake Town Junction, Swami Vivekanand Marg) to residential neighborhoods, community parks, clinics, and student entrances at VIT Pune Main Gate.

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Mapping:** Leaflet 1.9.4 with Canvas/GeoJSON rendering
- **Routing Engine:** Zero-dependency, pure in-memory browser-side Dijkstra / A* graph solver (`web/src/routing/routeEngine.ts`)
- **Solar Engine:** Astronomical solar position and shadow projection algorithm for Pune (`web/src/routing/solarEngine.ts`)
- **Data Engineering:** Python 3 standard library geometry and ETL pipeline (`scripts/process_pilot_data.py`)
- **Testing:** Vitest test suite (`web/src/__tests__/`) and Python schema validation (`scripts/validate_bundle.py`)
- **Zero-Budget Constraint:** ₹0 spent. No paid APIs (no Google Maps API, no Mapbox token), no backend server, no database dependency. Entirely runnable as a static client application with locally bundled pilot data.

---

## 4. Data Sources & Provenance

| Layer | Source Authority | Capture Date | License | Attributes |
| :--- | :--- | :--- | :--- | :--- |
| **Tree Inventory** | Pune Municipal Corporation (PMC) Tree Census | August 2019 | Open Data Commons / Pune Civic Open Data | 3,738 trees (65 dead excluded): Species, Height, Canopy Dia, Condition, Ownership |
| **Pedestrian Network** | OpenStreetMap API Bounded Extract | November 2026 | Open Database License (ODbL) 1.0 | 200 ways, 698 nodes, 836 walkable edges |
| **Building Footprints**| OpenStreetMap | November 2026 | ODbL 1.0 | 376 building polygons |
| **Solar Calculations** | Astronomical Almanac Formulas | Computed (Pune 18.46°N) | MIT | Elevation, Azimuth, Shadow Vector |

Detailed documentation: [DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

---

## 5. Methodology

- **Canopy Crown Modeling:** Canopy diameter is treated strictly as a diameter ($R = D / 2$). Crowns are parameterized as circular polygons and intersected with line segments using quadratic line-clipping. Overlapping intervals on the same segment are merged to prevent double-counting. See [SHADE_METHODOLOGY.md](docs/SHADE_METHODOLOGY.md).
- **Multi-Criteria Routing:** The routing engine evaluates edge costs balancing physical length, exposed distance, and shaded distance with strict detour guard limits ($\le 25\%$ detour for cooler routes, $\le 15\%$ for balanced routes). See [ROUTING_METHODOLOGY.md](docs/ROUTING_METHODOLOGY.md).
- **Known Limitations:** Tree census records date from 2019; microclimate air temperatures are not directly measured. See [LIMITATIONS_AND_FUTURE_WORK.md](docs/LIMITATIONS_AND_FUTURE_WORK.md).

---

## 6. How to Run Locally

### Prerequisites
- Node.js (v18+ or v24+)
- npm (v9+ or v11+)
- Python 3 (v3.10+ to v3.14) for data scripts

### Quick Start (Windows PowerShell)

```powershell
# 1. Navigate to the web directory
cd web

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```

Open your browser at `http://localhost:5173/` (or the URL printed in the terminal).

### Run Production Build & Preview
```powershell
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

### Run Automated Tests
```powershell
# Run frontend unit tests (Vitest)
npm run test

# Run python data validation tests
cd ..
python scripts/validate_bundle.py
```

### How to Regenerate Pilot Data
To regenerate the local pilot bundle from source data:
```powershell
python scripts/process_pilot_data.py
python scripts/validate_bundle.py
```

---

## 7. Hackathon Demo Walkthrough

A practical 5-minute judge demonstration script is provided in [DEMO_GUIDE.md](docs/DEMO_GUIDE.md).

---

## 8. Repository Layout

```
.
├── data/
│   ├── campuses/
│   │   ├── index.json                                     # Campus registry
│   │   ├── in-mh-pune-chintamani-bibwewadi/               # Published pilot area bundle
│   │   │   ├── manifest.json
│   │   │   ├── network.json                               # 698 nodes, 836 walkable edges
│   │   │   ├── shade.json                                 # 836 edge shade records
│   │   │   ├── canopy.json                                # 3,803 crown polygons
│   │   │   ├── trees.json                                 # 3,803 tree point records
│   │   │   ├── buildings.json                             # 376 building footprints
│   │   │   └── landmarks.json                             # Verified navigation landmarks
│   │   └── in-mh-pune-vit-bibwewadi/                      # Planned campus expansion
│   └── osm/                                               # Preserved raw OSM extracts & metadata
├── docs/                                                  # Architecture & methodology documentation
│   ├── ARCHITECTURE.md
│   ├── DATA_PROVENANCE.md
│   ├── SHADE_METHODOLOGY.md
│   ├── ROUTING_METHODOLOGY.md
│   ├── DEMO_GUIDE.md
│   ├── LIMITATIONS_AND_FUTURE_WORK.md
│   └── VIT_DATA_AUDIT.md
├── schemas/                                               # JSON Schemas for data contract enforcement
├── scripts/                                               # Reproducible data pipeline & validator
│   ├── process_pilot_data.py
│   └── validate_bundle.py
└── web/                                                   # React / Vite / TypeScript web app
    ├── src/
    │   ├── components/CampusMap.tsx
    │   ├── data/campusRepository.ts
    │   ├── routing/routeEngine.ts
    │   ├── routing/solarEngine.ts
    │   ├── App.tsx
    │   └── styles.css
    └── package.json
```
