# ShadeRoute: Pitch Script, Presentation Outline & Judge Q&A

This document contains the official presentation script, hackathon slide outline, and auditable judge Q&A defense for ShadeRoute. All metrics and performance claims strictly match `docs/CLAIM_STATS.md`.

---

## 1. 90-Second Spoken Pitch Script

*Target Speaking Pace: ~130–140 words per minute (~200 words total). Timed in 5 distinct beats.*

---

### [00:00 – 00:18] Beat 1: The Problem (Heat & Walking in Pune)
> *"In Pune, pedestrians don't avoid walking because of distance—they avoid walking because of direct, punishing solar radiation. A ten-minute walk under 40-degree midday heat can cause severe thermal stress. Yet current navigation tools like Google Maps treat every pedestrian path as identical, routing pedestrians straight down unshaded asphalt arterials even when a mature tree canopy or building shadow is just 20 metres away."*

---

### [00:18 – 00:36] Beat 2: The Physical Solar Engine (Real Physics, Not Static Tags)
> *"ShadeRoute is a zero-budget, offline-first pedestrian routing engine built for Pune. Instead of static 'shaded' tags, ShadeRoute implements the NOAA Solar Position algorithm. By calculating true solar altitude and azimuth dynamically, it projects real 3D building shadow hulls and displaces Pune Municipal Corporation tree crowns along the exact shadow direction for every minute of your walk."*

---

### [00:36 – 00:54] Beat 3: The Demo Trip (Shree J. Hospital → Upper Chintamani Sector)
> *"Let's look at a real trip in our Bibwewadi pilot area: walking from Shree J. Hospital to the Upper Chintamani residential sector at 12:30 PM. The direct shortest route forces 14.9 minutes of walking in direct sun. ShadeRoute finds a Cooler Route that cuts direct sun to 13.1 minutes—saving 1.8 minutes of intense solar exposure for a modest 26-metre detour—just a 2.2% distance addition."*

---

### [00:54 – 01:12] Beat 4: The Evidence Ribbon & Simulated Benchmark Claim
> *"Every route card features a dual-metric Shade Ribbon separating building shadows from tree canopies. And we are scientifically honest about our numbers: across a simulated routing benchmark of 300 random trips evaluated on our pilot network, ShadeRoute finds a cooler alternative saving at least one minute of sun on 17.3% of trips, with a median detour of just +3.7%. On the other 82.7% of trips, we plainly tell the pedestrian that the shortest route is already optimal."*

---

### [01:12 – 01:30] Beat 5: The Honest Close
> *"ShadeRoute is a direct-sun exposure and shade estimation tool, not a temperature prediction tool: shade blocks direct radiant flux (~800 to 1,000 W/m² in Pune), it does not change ambient air temperature. No field validation has been performed; all data is modelled from OpenStreetMap and the 2019 PMC tree census. Modelled, not measured. Field validation is our next step. Thank you."*

---

## 2. One-Slide Hackathon Summary Outline

```
+--------------------------------------------------------------------------------------------------------------------+
|  SHADEROUTE: Physical Shade Navigation for Pedestrian Thermal Comfort                                            |
|  Pilot Area: Chintamani Nagar & Bibwewadi, Pune · Offline-First PWA · Rs 0 Infrastructure Cost                    |
+--------------------------------------------------+-----------------------------------------------------------------+
|  1. THE PROBLEM                                  |  2. THE PHYSICAL ENGINE                                         |
|  - Midday solar radiation deters walking in Pune |  - NOAA Solar Position algorithm (altitude, azimuth, EoT)       |
|  - Standard maps route along exposed asphalt     |  - Building shadow extrusion: L = H / tan(alpha)                |
|  - Thermal discomfort is driven by radiant flux  |  - Displaced PMC tree crown geometry by height & crown radius   |
|  - Static "shade" tags fail as the sun moves     |  - Dynamic edge arrival time slot interpolation (7:00 to 17:00) |
+--------------------------------------------------+-----------------------------------------------------------------+
|  3. SIMULATED BENCHMARKS (300 Random Trips >=400m)| 4. SCIENTIFIC HONESTY & ROADMAP                               |
|  - Win Rate: 17.3% of trips save >= 1.0 min sun  |  - Shade != Ambient Air Temperature (radiant flux reduction)    |
|    (8% at solar noon, 36.3% in afternoon)        |  - Zero fake data: 100% unverified OSM & 2019 PMC census        |
|  - Median Detour on Winners: +3.7% (+32 to +68 m)|  - Honest baseline: 82.7% of trips shortest is already optimal  |
|  - 0.0% unknown edge length loophole             |  - No field validation performed: Ground-truth sensor is next   |
+--------------------------------------------------+-----------------------------------------------------------------+
```

---

## 3. Anticipated Judge Q&As (8 Defense Questions)

### Q1: Is this field-verified? Have you measured the shade with sensors on the ground?
> **Answer**: *"No. Every edge in our database is explicitly labeled `verificationStatus: "unverified"` and `accessStatus: "osm-derived"`. We do not pretend to have measured actual ground shade. What ShadeRoute computes is a geometric optical projection based on OpenStreetMap building footprints and the 2019 Pune Municipal Corporation tree census. Optical shade blocks direct beam solar irradiance (~800 to 1000 W/m² in Pune), but localized microclimates, tree health, and ambient air temperature variations require sensor validation. Our headline disclaimer on every route card states: 'Modelled, not measured. Field validation is our next step.'"*

---

### Q2: Why not just use Google Maps walking directions?
> **Answer**: *"Google Maps calculates routing purely based on metric distance and road network connectivity. It has no physical solar engine, no awareness of building heights, no tree canopy database, and no solar elevation geometry. A Google Maps route will happily send a pedestrian down a completely sun-drenched four-lane arterial road when an adjacent residential lane offers 80% tree shade for only 20 metres of extra walking. ShadeRoute bridges this gap with constrained Pareto routing: minimizing direct sun exposure while strictly enforcing a maximum detour limit (<= 25%)."*

---

### Q3: What about trees that were cut down, trimmed, or planted since the 2019 PMC census?
> **Answer**: *"This is a recognized limitation documented in our manifest. The PMC tree census was conducted in 2019. Over 5+ years, urban canopy changes due to road widening, trimming, or new sapling growth. To maintain scientific integrity, ShadeRoute marks all default-height (5.0 m) and default-canopy (3.5 m) trees with uncertainty flags, excludes dead trees reported in the census, and clips routing strictly to areas with 100% building and tree census coverage. In future versions, crowdsourced flagging and recent satellite canopy updates will help detect pruned or removed crowns."*

---

### Q4: How do you know building heights without expensive LiDAR scans?
> **Answer**: *"We developed a 5-tier height taxonomy in our data pipeline. Tier 1 uses explicit OpenStreetMap `height` tags; Tier 2 uses `building:levels` multiplied by 3.2 metres per floor; Tier 3 uses roof shape attributes; Tier 4 uses neighborhood urban typology estimates calibrated against Chintamani Nagar residential averages (typically 2 to 4 storeys / 8 to 14 metres); and Tier 5 is marked uncertain. Buildings with estimated heights are flagged in our GeoJSON properties and inspectable in the UI."*

---

### Q5: What does 'unknown' shade mean, and could it be used to game your routing?
> **Answer**: *"An edge is defined as 'unknown' if its midpoint falls outside the spatial envelope of building or tree data coverage. Early in development, an edge with unknown shade was accidentally treated as zero sun, which inflated savings by sending pedestrians through data gaps. We caught and eliminated this bug: in our clipped pilot network, 100% of walkable edges lie inside the coverage box (0.0% unknown). Furthermore, our routing engine implements an ironclad safety net: any unknown edge is penalised as 100% sunny in the search cost and pessimistic sun-minutes, and the UI displays a range if uncertainty exists."*

---

### Q6: Does shade mean the air is cooler, or is it just less sunlight?
> **Answer**: *"Scientifically, shade is the obstruction of direct beam solar radiation—it is NOT a reduction in ambient air temperature. On a 38°C day in Pune, ambient air temperature in the shade is still approximately 38°C. However, walking in direct sunlight exposes the human body to approximately 800 to 1,000 W/m² of shortwave solar irradiance, dramatically increasing Mean Radiant Temperature (MRT) and physiological heat strain. ShadeRoute calculates 'minutes in direct sun', deliberately avoiding unscientific claims of ambient temperature cooling."*

---

### Q7: Why does your model show 0.0% cooler route wins during April solar noon?
> **Answer**: *"Because physics is physics, and our model is honest. On April 25 at 12:30 PM in Pune, the sun reaches near-zenith elevation (84.7°, azimuth 173°). At an 85° angle, shadows cast by buildings and trees are almost nonexistent—building shadows extend only 0.1× building height. Every street is equally exposed from directly above. A detour under an 85° sun simply forces extra walking in the sun. ShadeRoute's algorithm recognizes this and honestly reports 0% win rate, recommending the shortest path without fabricating artificial shade."*

---

### Q8: How can this deploy with zero budget and zero runtime servers?
> **Answer**: *"ShadeRoute runs entirely in the pedestrian's browser as an offline-first Progressive Web App hosted on free GitHub Pages. The pilot pedestrian graph (457 nodes, 584 edges) and precomputed hourly solar slots (7:00 to 17:00 for November and April) compress to under 600 KB total. Once loaded, our TypeScript Min-Heap Dijkstra and Pareto search run in under 5 milliseconds on a mobile device without making a single backend API call. Zero operational cost, zero server dependencies, and 100% privacy for pedestrian location data."*
