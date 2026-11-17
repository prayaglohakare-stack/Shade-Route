# ShadeRoute — Limitations and Future Work

## 1. Current Scientific & Technical Limitations

Transparency is a fundamental core principle of ShadeRoute. Below is the complete record of verified constraints in the MVP:

### A. Environmental Data Limitations
1. **Tree Census Age (2019):**
   - The municipal tree records for Pune originate from the 2019 PMC Tree Census. While it provides high-density coordinates and measured canopy diameters for 3,803 trees in our pilot, trees planted, trimmed, pruned, or felled between 2019 and 2026 are not captured.
2. **Crown Geometry Approximation:**
   - Crowns are modeled geometrically as regular circular polygons based on `canopy_dia_m / 2`. In reality, urban tree canopies exhibit asymmetrical foliage distribution, varying leaf area index (LAI), and seasonal deciduous defoliation.
3. **No Direct Ambient Temperature Measurement:**
   - ShadeRoute does not measure microclimate air temperatures. Canopy overlap indicates direct solar radiation interception, which significantly reduces human mean radiant temperature (MRT) and heat stress, but does not guarantee a specific thermodynamic temperature drop (e.g. "30% cooler").
4. **Missing Vertical Foliage Information:**
   - While tree height is recorded, the distance from the ground to the base of the crown (trunk clearance) is not recorded in the municipal census.

### B. Routing & Network Limitations
1. **Static OpenStreetMap Network:**
   - Pedestrian routing relies on OSM public highway geometry. Temporary physical impediments (construction blockades, temporary gate locks, potholes, water-logging during monsoons) are not reflected without real-time crowdsourcing or municipal integration.
2. **Elevation & Incline:**
   - The routing engine models 2D horizontal network distance and does not yet penalize steep pedestrian stairways or slopes in walking effort calculations.

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
