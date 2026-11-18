# ShadeRoute — Routing Engine Methodology

## 1. Engine Architecture

The ShadeRoute routing engine is a **pure, zero-dependency browser-side graph module** implemented in TypeScript (`web/src/routing/routeEngine.ts`). It operates entirely in memory on client devices without requiring runtime backend servers, database queries, or third-party paid APIs.

### Core Architectural Principles
1. **Combined Built and Natural Intelligence:** Pedestrian route optimization treats building-cast shadows, tree canopies, and permanent coverings as independent, first-class contributors to pedestrian protection.
2. **Dynamic Departure-Time Progression:** Each street segment is evaluated at the exact solar timestamp the pedestrian is projected to reach it based on walking velocity, rather than assuming static solar conditions throughout the walk.
3. **Network Integrity:** Routes are computed strictly over a topological graph of OpenStreetMap pedestrian nodes and edges (`verificationStatus: "unverified"`; no field validation has been performed). Geometry lines crossing visually on a map never generate shortcuts without an explicit connecting junction.
4. **Access-First Principle:** No route will ever guide a pedestrian through a restricted, private, or prohibited path simply to gain shade. Every edge is labelled `accessStatus: "osm-derived"`.
5. **Direct-Sun Estimation (Not Temperature Prediction):** ShadeRoute estimates minutes in direct sun (solar beam irradiance blockage), not ambient air temperature or microclimate cooling.
6. **Detour Prudence:** Shading preferences are bounded by strict detour limits so pedestrians are never sent on disproportionate diversions.
7. **Honest Coincidence:** When two routing modes select the identical physical edge sequence, the engine explicitly reports them as coincident rather than manufacturing artificial differences.
8. **No Field Validation Performed:** All route calculations are based on OpenStreetMap geometries, Pune Municipal Corporation tree census records, and NOAA solar position projections. Ground-truth field validation has not been performed.

---

## 2. Graph Construction

From OpenStreetMap highway geometries filtered to the Chintamani Nagar & Bibwewadi pilot polygon:
- **Walkable Highway Classes:** `footway`, `pedestrian`, `path`, `steps`, `crossing`, `residential`, `living_street`, `service`.
- **Exclusion Filters:**
  - Explicit access restrictions: `access=no`, `access=private`, `foot=no`, `foot=private` (unless explicitly flagged field-permissive).
  - High-speed roads: `motorway`, `trunk`.
- **Topology Extraction:**
  - Junctions are extracted from shared OSM node IDs.
  - Intermediate vertices along ways are retained as coordinate arrays to ensure accurate Haversine physical curve lengths.
  - Edges are bidirectional for pedestrian walking unless marked `oneway:foot=yes`.
  - Component analysis isolates the primary connected component within the data-covered boundary (**457 nodes, 584 edges, 17.11 km**).

---

## 3. Combined Environmental Multi-Criteria Cost Functions

For an edge $e$ with physical length $L(e)$ traversed at estimated elapsed time $t_{\text{arrival}}(e)$:

### A. Hourly Precomputed Solar Slots & Dynamic Arrival Interpolation
Per-edge shade is precomputed by the pipeline (`scripts/process_pilot_data.py`) across 11 hourly slots (07:00 to 17:00 IST) for two representative seasonal dates (18 Nov and 25 Apr) using the rigorous NOAA Solar Calculations (Jean Meeus algorithm):
- **Building Shadows:** 2D ground shadow hulls projected from calibrated building footprints and heights along the solar azimuth.
- **Tree Shadows:** Displaced crown circles along the shadow direction: $\text{offset} = \frac{h_{\text{tree}}}{\tan\alpha}$ where $h_{\text{tree}}$ is tree height and $\alpha$ is solar altitude.
- **Runtime Interpolation:** For any departure time and walking speed, the estimated pedestrian arrival time $t_{\text{arrival}}(e)$ is calculated dynamically. Edge shade fractions $[f_{\text{comb}}, f_{\text{tree}}, f_{\text{bldg}}]$ are linearly interpolated between the two nearest hourly slots.

### B. Strict Mathematical Union (Zero Double Counting) & Unknown Handling
$$f_{\text{combined}}(e, t) = \min\left(1 - f_{\text{unknown}}(e), \operatorname{Union}\left(f_{\text{covered}}(e), f_{\text{bldg}}(e, t), f_{\text{tree}}(e, t)\right)\right)$$
- Total shaded distance: $L_{\text{shaded}}(e) = L(e) \times f_{\text{combined}}(e, t)$
- Total unknown distance: $L_{\text{unknown}}(e) = L(e) \times f_{\text{unknown}}(e)$
- Total exposed distance: $L_{\text{exposed}}(e) = L(e) \times \max(0.0, 1.0 - f_{\text{combined}}(e, t) - f_{\text{unknown}}(e))$
- **Crucial Honesty Rule:** Unknown distance is never counted as exposed or shaded.

---

## 4. Headline Metric: Minutes in Direct Sun

The primary headline metric displayed on every route card is **Minutes in Direct Sun**:
$$\text{Minutes in Direct Sun} = \sum_{e \in \text{route}} \frac{L(e) \cdot \max(0, 1 - f_{\text{combined}}(e, t) - f_{\text{unknown}}(e))}{v_{\text{walk}} \cdot 60}$$
where standard pedestrian velocity $v_{\text{walk}} = 1.25\text{ m/s}$ ($4.5\text{ km/h}$).

This replaces deceptive temperature metrics with physical truth: the actual cumulative duration a pedestrian walks under unshaded solar radiation. Total distance, detour vs shortest, and shade percentages are displayed secondarily.

---

## 5. Routing Modes & Constrained Search Formulations

All graph searches run on a custom TypeScript binary min-heap (`MinHeap<T>`) executing in $\mathcal{O}((V + E)\log V)$ time instead of $\mathcal{O}(V^2)$.

### Mode 1: Shortest Route
$$\text{Cost}_{\text{shortest}}(e) = L(e)$$
- **Objective:** Pure distance minimization via min-heap Dijkstra.
- Yields baseline distance $D_{\text{shortest}}$ and baseline sun minutes $S_{\text{shortest}}$.

### Mode 2: Cooler Route (Constrained Sun-Minimization)
$$\min \sum_{e \in \text{route}} \frac{L_{\text{exposed}}(e)}{v_{\text{walk}} \cdot 60} \quad \text{subject to} \quad \text{Distance} \le 1.25 \times D_{\text{shortest}}$$
- **Hard Detour Constraint:** The route distance is strictly bounded to $\le 25\%$ detour above shortest.
- **Solver:** Bicriteria label-setting search with Pareto-frontier domination pruning on $(\text{sunSeconds}, \text{distance})$. Subpaths exceeding $1.25 \times D_{\text{shortest}}$ or dominated by existing labels are pruned immediately.
- Detour is mathematically guaranteed to never exceed 25%.

### Mode 3: Balanced Route (Constrained Weighted Cost)
$$\text{Cost}_{\text{balanced}}(e) = L_{\text{exposed}}(e) + 0.50 \times L_{\text{shaded}}(e) \quad \text{subject to} \quad \text{Distance} \le 1.15 \times D_{\text{shortest}}$$
- **Documented Weight:** 50% discount for shade (1 metre in shade counts as 0.50 m cost; 1 metre in direct sun counts as 1.0 m cost).
- **Hard Detour Constraint:** Strictly bounded to $\le 15\%$ detour above shortest.

---

## 6. Snapping & Network Access Verification

When a user taps an arbitrary location on the interactive map or chooses a landmark:
1. The engine calculates the Haversine distance from $(lon, lat)$ to all candidate network nodes.
2. The closest node $N_{\text{snap}}$ is identified.
3. The exact snap distance is displayed (e.g. *"Snapped 4.2m"*).
4. **Warning Threshold:** If snap distance $> 30\text{ m}$, a prominent warning badge is displayed:
   *`⚠️ Snapped >30 m from walkable network. Directions begin/end at nearest street access point.`*

---

## 7. Honest Route Comparison & Recommendation Algorithm

The engine never pushes an unnecessary detour when the shade difference is negligible:
- **Honest 1-Minute Rule:**
  If the Cooler route gains less than **1.0 minute** of direct sun avoidance compared to the shortest route ($\Delta_{\text{sun}} < 1.0\text{ min}$):
  - The engine plainly states: **"Shortest route is already about as shaded"**
  - The engine recommends the **Shortest Route**, not the detour!
- **Recommend Cooler Route:**
  Only when $\Delta_{\text{sun}} \ge 1.0\text{ min}$, $\text{Detour} \le 25\%$, and routes are non-coincident:
  *"Recommended: Cooler route avoids direct sun by X.X minutes (Y min vs Z min) with a +W% distance difference."*
- **Recommend Balanced Route:**
  Only when $\Delta_{\text{sun}} \ge 0.8\text{ min}$, $\text{Detour} \le 15\%$, and routes are non-coincident.

---

## 8. Curated Demonstration Trips (Demo Mode)

To allow instant evaluation without requiring manual endpoint selection, 4 curated trips were systematically identified by `scripts/find_demo_trips.py` across candidate pairs separated by $\ge 400\text{ m}$:
1. **Lake Town Junction → VIT Central Library:** Cooler route clearly wins, avoiding **2.6 minutes in direct sun** (35% sun exposure reduction) with a +22% detour.
2. **VIT Library → Shree J. Hospital:** Highly efficient win, saving **1.4 minutes in direct sun** for a tiny **+3.4% detour** (+23 m).
3. **Shri Vimalnath Temple → VIT Library:** Follows mature tree canopies, avoiding **1.2 minutes in direct sun** with only **+2.6% detour**.
4. **VIT Main Gate → Shri Vimalnath Temple:** Shortest route is optimal (saves 0.0 minutes); honestly recommends shortest route without artificial detours.
