# ShadeRoute Simulated Routing Benchmark Claims (Bibwewadi Pilot)

This document establishes the **only permitted performance claims** for ShadeRoute presentations, pitches, and documentation. All statistics are derived from a simulated routing benchmark across 300 reproducible random origin-destination pairs on the clipped pilot pedestrian network. No field validation has been performed. ShadeRoute is a direct-sun/shade estimation tool, not a temperature prediction tool.

- **Generated**: 2026-11-18 10:01 UTC
- **Commit**: `1190e9e99ce73c18cd53a74af9169e960d8e7790`
- **Pilot Area**: Chintamani Nagar & Bibwewadi, Pune (`in-mh-pune-chintamani-bibwewadi`)
- **Network Extent**: 457 nodes, 584 edges, 17.11 km walkable pathways
- **Data Coverage**: 100% building footprints and tree census coverage (0.0% unknown edges)
- **Constraint Limits**: Detour $\le 25\%$ distance penalty, minimum network distance $\ge 400$ metres

---

## 1. Summary Performance Table (300 Random Trips $\ge 400$ m)

| Scenario | Trips Tested | Trips Saving $\ge 1$ min Sun (0% Unknown) | Share (%) | Avg Detour on Winners (%) | Median Detour on Winners (%) | Avg Detour (m) | Avg Sun Saved All Trips (min) |
|---|---|---|---|---|---|---|---|
| **Nov 18, 09:30 IST (Morning)** | 300 | 75 | **25.0%** | +4.5% | +3.7% | +43.2 m | **0.66 min** |
| **Nov 18, 12:30 IST (Solar Noon)** | 300 | 24 | **8.0%** | +3.5% | +2.5% | +31.9 m | **0.32 min** |
| **Nov 18, 16:30 IST (Late Afternoon)** | 300 | 109 | **36.3%** | +7.7% | +5.8% | +67.5 m | **0.86 min** |
| **Apr 25, 12:30 IST (Summer Zenith Noon)** | 300 | 0 | **0.0%** | +0.0% | +0.0% | +0.0 m | **0.11 min** |

---

## 2. Permitted Pitch & Hackathon Claims

1. **Headline Win Rate**:
   > *"Across 300 random trips $\ge 400$ m in our Bibwewadi pilot area, the Cooler Route provides $\ge 1.0$ minute of direct solar avoidance on **17.3%** of trips (ranging from **0.0%** to **36.3%** depending on time of day and solar elevation). On those trips, the median detour is just **+3.7%** (average **+5.2%**)."*

2. **Detour Efficiency**:
   > *"When a cooler alternative is recommended, pedestrians avoid direct noon sun exposure with a modest median detour of **+3.7%**, keeping walking times realistic and practical."*

3. **Honest Baseline (Shortest is Optimal)**:
   > *"On the remaining **82.7%** of trips, ShadeRoute honestly reports that the direct route is already the most shaded available corridor, recommending zero artificial detour."*

4. **Zero Unknown Inflation**:
   > *"All 300 evaluated trips have **0.0% unknown edge length**. Direct solar savings reflect physical building shadow geometry and Pune Municipal Corporation tree crowns, not missing data loopholes."*

---

## 3. Scientific Methodology & Auditability

1. **OD Pair Selection**:
   - 300 unique node pairs drawn uniformly at random using Python `random.seed(42)`.
   - Filtered strictly to network shortest paths $\ge 400$ metres (average network length: 760.5 m).
2. **Routing Constraints**:
   - Shortest path: Dijkstra's algorithm on metric edge lengths.
   - Cooler route: Bicriteria Pareto search minimizing direct solar minutes subject to `detourDistance <= 0.25 * shortestDistance`.
   - Walking speed: Standard pedestrian velocity of $1.25\text{ m/s}$ ($4.5\text{ km/h}$).
3. **Solar & Shadow Model**:
   - NOAA Solar Position algorithm calculating true solar elevation and azimuth for Pune ($18.464^\circ\text{N}, 73.867^\circ\text{E}$, IST, UTC+05:30).
   - Building shadows projected via $L = H / \tan(\alpha)$ along azimuth $+ 180^\circ$.
   - Tree crown shadows projected as displaced circles based on individual tree height and canopy radius.
   - Slot interpolation: hourly slots evaluated dynamically at the estimated timestamp when the pedestrian arrives at each edge.
5. **Data Honesty Invariant**:
   - Verification status: All edges remain labeled `verificationStatus: "unverified"` and `accessStatus: "osm-derived"`.
   - No field validation has been performed: All pedestrian ways, building heights, tree canopies, and shade values are derived from OpenStreetMap geometry and the 2019 PMC tree census.
   - Direct-sun estimation only: ShadeRoute is a direct-sun exposure and shade estimation tool, NOT a temperature prediction tool. Models direct solar irradiance blockage (radiant heat reduction), NOT ambient air temperature. No claims of microclimate temperature reduction or field verification are made.
