# ShadeRoute — Limitations and Future Work

## 1. Current Scientific & Technical Limitations

Transparency is a fundamental core principle of ShadeRoute. Below is the complete record of known technical constraints in the MVP:

### A. Environmental Data Limitations
1. **Tree Census Age (2019):**
   - The municipal tree records for Pune originate from the 2019 PMC Tree Census. While it provides high-density coordinates and measured canopy diameters for 3,738 active trees (65 dead excluded) in our pilot, trees planted, trimmed, pruned, or felled between 2019 and 2026 are not captured.
2. **Crown Geometry Approximation:**
   - Crowns are modeled geometrically as regular circular polygons based on `canopy_dia_m / 2`. In reality, urban tree canopies exhibit asymmetrical foliage distribution, varying leaf area index (LAI), and seasonal deciduous defoliation.
3. **Direct-Sun Estimation Only (No Direct Ambient Temperature Measurement):**
   - ShadeRoute is a direct-sun and shade estimation tool, NOT an ambient air temperature prediction tool. It does not measure or predict microclimate air temperatures. Canopy overlap indicates direct shortwave solar radiation interception (~800–1,000 W/m² in Pune), which significantly reduces human mean radiant temperature (MRT) and heat stress, but does not guarantee a specific thermodynamic temperature drop (e.g. "30% cooler").
4. **Missing Vertical Foliage Information:**
   - While tree height is recorded, the distance from the ground to the base of the crown (trunk clearance) is not recorded in the municipal census.

### B. Routing & Network Limitations
1. **Static OpenStreetMap Network:**
   - Pedestrian routing relies on OSM public highway geometry (457 nodes, 584 edges, 17.11 km). Temporary physical impediments (construction blockades, temporary gate locks, potholes, water-logging during monsoons) are not reflected without real-time crowdsourcing or municipal integration.
2. **Elevation & Incline:**
   - The routing engine models 2D horizontal network distance and does not yet penalize steep pedestrian stairways or slopes in walking effort calculations.

### C. Validation Status & Honest Model Disclosure
1. **Modelled Estimates — No Field Validation Has Been Performed:**
   - **No field validation has been performed.** All network edges, building heights, tree canopies, and shade values are derived from OpenStreetMap geometry, PMC 2019 tree census records, and astronomical solar algorithms. No physical ground-truth survey, sensor measurement, or field audit has been conducted.
   - Every network edge is labelled `accessStatus: "osm-derived"` and `verificationStatus: "unverified"`.
   - No fake or placeholder ground observation data or observation files are created.
2. **Field Validation Roadmap:**
   - **Physical Field Walk:** Walk selected corridors across Bibwewadi with GPS tracking during 3 times of day: morning (09:30 IST), solar noon (12:30 IST), and late afternoon (16:30 IST).
   - **Timestamped Ground Truth Photos:** Georeferenced photographs capturing physical building shadow cast extents and tree crown ground shadows.
   - **Quantitative Concordance Check:** Systematic comparison of predicted hourly slot shade fractions against physical shadows to calibrate building height assumptions and crown opacity.

---

## 2. Defensible Roadmap for Future Development

### Phase 2: Live Sensor & Microclimate Integration
- **Microclimate Thermal Sensors:**
  Deploy low-cost IoT ambient temperature and globe thermometer sensors along high-traffic pedestrian corridors (e.g. VIT Bibwewadi gate, Lake Town transit bus stop) to correlate canopy overlap with empirical urban heat island reduction.
- **Seasonal Leaf Phenology:**
  Integrate tree flowering and foliage phenology databases (using botanical species classification already stored in our database, such as deciduous vs evergreen species) to adjust canopy density dynamically by month.

### Phase 3: High-Resolution Satellite Canopy Verification
- **Multispectral NDVI Canopy Updates:**
  Ingest free public Sentinel-2 (10m) or high-resolution open aerial orthophotos to compute Normalized Difference Vegetation Index (NDVI) masks, flagging where 2019 municipal trees have matured, expanded, or been removed.

### Phase 4: Dynamic Solar Shadow Simulation
- **Building Height & 3D Extrusion Ray-Tracing:**
  Incorporate building floor counts (`building:levels`) and heights from municipal GIS or LiDAR to project tall building shadows onto pedestrian sidewalks in morning and evening hours.

### Phase 5: Civic Pedestrian Ground Reporting
- **Field Verification Write-Path:**
  Implement a lightweight, moderated citizen reporting interface allowing students and neighborhood residents to submit GPS-tagged ground photos, flag missing pedestrian shortcuts, or report newly planted/removed avenue trees.
