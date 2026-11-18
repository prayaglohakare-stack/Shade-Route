# Raw Data Assets — Pune Municipal Corporation Tree Census

This directory contains raw source datasets used to build environmental and shade layers for ShadeRoute pilots.

## 1. File Details
- **Filename:** `chintamani_bibwewadi_trees.csv`
- **Source Authority:** Pune Municipal Corporation (PMC) Garden and Tree Authority Department, in collaboration with Saar IT Solutions and Datameet Pune / Open Data Pune.
- **Original Census Date:** August 2019.
- **Extraction / Boundary Clipping Date:** 18 November 2026.
- **Licence:** Open Data Commons Open Database License (ODbL) / Pune Smart City Civic Open Data Initiative.
- **Attribution:** Pune Municipal Corporation (PMC) Tree Census 2019.
- **Geographic Extent:**
  - West: `73.8640° E`
  - South: `18.4615° N`
  - East: `73.8710° E`
  - North: `18.4675° N`
- **Total Records in Raw CSV:** 3,803 tree records located inside the pilot bounding box.

## 2. Schema
The raw CSV retains the civic tree census attributes:
- `id` / `saar_uid`: Unique municipal tree identifier
- `latitude`, `longitude`: WGS 84 geographic coordinates (EPSG:4326)
- `canopy_dia_m`: Measured canopy diameter in metres
- `height_m`: Measured tree height in metres
- `girth_cm`: Measured trunk girth at breast height in centimetres
- `condition`: Health status (`Healthy`, `Dead`, `Poor`, `Average`)
- `ownership`: Location context (`Private`, `Garden`, `On Foot Path`, `On Road`, etc.)
- `common_name`, `botanical_name`, `local_name`: Species classification

## 3. Data Processing & Cleansing Rules
When processed by `scripts/process_pilot_data.py`:
1. **Dead Tree Exclusion:** Trees with condition `Dead` are excluded from crown polygon generation and shade simulation.
2. **Canopy Diameter Defaulting:** Trees missing a measured canopy diameter (or with non-physical values outside 0.5 m – 35.0 m) are assigned a conservative default diameter of 3.5 m and flagged with `isDefaultCanopy: true`.
3. **Height Defaulting:** Trees missing measured height (or outside 1.0 m – 60.0 m) are assigned a default height of 5.0 m and flagged with `isDefaultHeight: true`.
4. **Coordinate Integrity:** Every record is verified to lie within the pilot extent.

## 4. Reproducibility
From a clean repository clone:
```bash
python scripts/process_pilot_data.py
python scripts/validate_bundle.py
```
This regenerate all data bundle files under `data/campuses/in-mh-pune-chintamani-bibwewadi/` without requiring any external network access or absolute local paths.
