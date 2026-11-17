# ShadeRoute — Routing Engine Methodology

## 1. Engine Architecture

The ShadeRoute routing engine is a **pure, zero-dependency browser-side graph module** implemented in TypeScript (`web/src/routing/routeEngine.ts`). It operates entirely in memory on client devices without requiring runtime backend servers, database queries, or third-party paid APIs.

### Core Architectural Principles
1. **Combined Built and Natural Intelligence:** Pedestrian route optimization treats building-cast shadows, tree canopies, and permanent coverings as independent, first-class contributors to pedestrian protection.
2. **Dynamic Departure-Time Progression:** Each street segment is evaluated at the exact solar timestamp the pedestrian is projected to reach it based on walking velocity, rather than assuming static solar conditions throughout the walk.
3. **Network Integrity:** Routes are computed strictly over a topological graph of verified pedestrian nodes and edges. Geometry lines crossing visually on a map never generate shortcuts without an explicit connecting junction.
4. **Access-First Principle:** No route will ever guide a pedestrian through a restricted, private, or prohibited path simply to gain shade.
5. **Detour Prudence:** Shading preferences are bounded by strict detour limits so pedestrians are never sent on disproportionate diversions.
6. **Honest Coincidence:** When two routing modes select the identical physical edge sequence, the engine explicitly reports them as coincident rather than manufacturing artificial differences.

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
  - Component analysis isolates the primary connected component (**698 nodes, 836 edges, 23.6 km**).

---

## 3. Combined Environmental Multi-Criteria Cost Functions

For an edge $e$ with physical length $L(e)$ traversed at estimated elapsed time $t_{\text{arrival}}(e)$:

### A. Dynamic Solar Scaling for Building Shadows
At the segment's arrival time, the solar position algorithm calculates solar altitude $\alpha$ and azimuth $\psi$.
The dynamic building shadow fraction is scaled from solar noon baseline according to the solar shadow multiplier:
$$f_{\text{bldg}}(e, t) = \min\left(1.0, f_{\text{bldg,base}}(e) \times \frac{M(\alpha_t)}{M_{\text{noon}}}\right)$$
where $M(\alpha) = 1 / \tan\alpha$.
- At morning (09:30 IST, $\alpha \approx 46^\circ$), $M \approx 1.0$, stretching building shadows by $+150\%$ over solar noon ($M \approx 0.40$).
- At late afternoon (17:00 IST, $\alpha \approx 18^\circ$), shadows stretch across east-west residential streets.

### B. Strict Mathematical Union (Zero Double Counting)
$$f_{\text{combined}}(e, t) = f_{\text{covered}}(e) + (1 - f_{\text{covered}}(e)) \cdot \left[ f_{\text{bldg}}(e, t) + f_{\text{tree}}(e) - f_{\text{bldg}}(e, t) \cdot f_{\text{tree}}(e) \right]$$
Total shaded distance is $L_{\text{shaded}}(e) = L(e) \times f_{\text{combined}}(e, t)$.
Total exposed distance is $L_{\text{exposed}}(e) = L(e) - L_{\text{shaded}}(e)$.

---

## 4. Routing Modes & Cost Formulations

### Mode 1: Shortest Route
$$\text{Cost}_{\text{shortest}}(e) = L(e)$$
- **Objective:** Minimize total walking distance and duration.
- **Walking Speed:** Standard pedestrian speed of $1.25 \text{ m/s}$ ($4.5 \text{ km/h}$).

### Mode 2: Cooler / More Canopy Route
$$\text{Cost}_{\text{more-canopy}}(e) = L_{\text{exposed}}(e) + \beta \times L_{\text{shaded}}(e)$$
- **Weighting Parameter:** $\beta = 0.25$ (a $75\%$ cost discount for walking under building shadows, tree canopies, or covered arcades).
- **Detour Protection Guard:**
  Let $D_{\text{shortest}}$ be the distance of the shortest route. If the resulting route distance $D > 1.35 \times D_{\text{shortest}}$ (more than a $35\%$ detour), the engine automatically clamps or selects the balanced candidate to prevent impractical diversions.

### Mode 3: Balanced Route
$$\text{Cost}_{\text{balanced}}(e) = L_{\text{exposed}}(e) + \alpha \times L_{\text{shaded}}(e)$$
- **Weighting Parameter:** $\alpha = 0.65$ (a $35\%$ cost discount for shaded sections).
- **Detour Protection Guard:** Maximum allowed detour is $15\%$ over the shortest path. If an alternative exceeds $15\%$ detour, the route clamps to the shortest path.

---

## 5. Snapping & Map Interaction

When a user taps an arbitrary location on the interactive map:
1. The engine calculates the Haversine distance from $(lon, lat)$ to all candidate network nodes:
   $$d = 2 R \arcsin\left(\sqrt{\sin^2(\Delta\phi/2) + \cos\phi_1\cos\phi_2\sin^2(\Delta\lambda/2)}\right)$$
2. The closest node $N_{\text{snap}}$ is identified.
3. A visual snap indicator chip displays the snapped distance (e.g. *"Snapped 4.2m to network"*).
4. A dashed snap guide line connects the user's click pin to the actual network entry point on the map.

---

## 6. Route Comparison & Recommendation Algorithm

Upon calculating all 3 routes for an origin-destination pair, the engine evaluates whether the environmental benefit justifies the additional walking distance:
- **Recommend "More Canopy":**
  $$\text{if } \Delta_{\text{shade}} \ge +15\% \text{ and } \text{Detour} \le 25\%$$
  The engine highlights the Cooler route as recommended and explains:
  *"Recommended: Cooler route provides significantly more shade (X% vs Y%) for only +Z% added distance."*
- **Recommend "Balanced":**
  $$\text{if } \Delta_{\text{shade}} \ge +8\% \text{ and } \text{Detour} \le 15\%$$
  The engine highlights the Balanced route.
- **Recommend "Shortest":**
  If alternatives provide negligible shade gains ($< 8\%$) or require disproportionate detours, the engine recommends the Shortest path and explains:
  *"Recommended: Shortest route is optimal. Alternative detours do not offer enough extra shade to justify the added walking distance."*
