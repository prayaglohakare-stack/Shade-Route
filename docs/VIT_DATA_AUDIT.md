# VIT Bibwewadi geographic data audit

**Audit date:** 2026-11-17
**Data source:** OpenStreetMap API, bounded source snapshot saved under `data/osm/`.
**Status:** initial desktop topology review; campus access and feature geometry still require field verification.

## What was inspected

The OSM college feature is [way 213874316](https://www.openstreetmap.org/way/213874316), named “Vishwakarma Institute of Technology (VIT)” and tagged `amenity=college`, `alt_name=VIT`, and `wheelchair=limited`. It has 15 boundary vertices and OSM version 3, last edited `2025-11-09T07:27:32Z` at the time of the audit.

The saved [raw extract](../data/osm/vit-bibwewadi-2026-11-17.osm) was fetched from the OpenStreetMap API using the college way’s bounding box: west `73.8673428`, south `18.4628630`, east `73.8693322`, north `18.4646223` (WGS 84 longitude/latitude). It contains 328 nodes, 48 ways and 1 relation. The extract is rectangular and includes nearby features outside the college polygon. Retrieval time, URL, extent, element counts, SHA-256 and ODbL attribution are in the adjacent metadata file. The snapshot is unedited.

## Mapped features found

### Walking network and connectivity

Within the bounding rectangle, OSM has:

- 2 `highway=footway` ways, both tagged `access=private`.
- 5 `highway=service` ways, all tagged `access=private`.
- 4 `highway=steps` ways, with no explicit access value.
- 14 `highway=residential` ways in the extract; no consecutive segment midpoint from these ways fell inside the mapped college polygon.
- No `highway=path` or `highway=pedestrian` way in the extract.

To assess topology, each consecutive OSM way-node pair was treated as a segment when its midpoint fell inside the college polygon. Connections were determined by shared OSM node IDs. This is a reproducible first-pass clip; it is not a precise geometric clipping or a ground survey.

The resulting internal segment set has 56 segments. Including private service roads and private footways, it forms **2 connected components** with 53 and 3 nodes. Considering only footways and steps gives 20 segments in **3 components** with 12, 9 and 2 nodes. Excluding ways tagged private/no leaves four step segments in four disconnected two-node components.

**Conclusion:** the current mapped pedestrian network is not sufficiently connected to support reliable campus-wide routing as-is. A route between two points in the largest component may be computable, but that would demonstrate only a connected slice. The private-access tags also mean the team must verify whether the intended VIT users are permitted on those paths before routing them.

### Buildings and named places

The extract contains 20 building footprints: 18 generic `building=yes` footprints and two `building=cafe` footprints. A polygon-area centroid check places 11 centroids inside the mapped college polygon (9 generic footprints and both cafés); 9 footprints lie outside it. The centroids are a screening measure, not a definitive boundary or footprint validation.

None of the 20 footprints has `height` or `building:levels` in the extract. Named features include [VIT Canteen](https://www.openstreetmap.org/way/1371963261), [VIT Fruit Canteen](https://www.openstreetmap.org/way/1371963468), and a [VIT Library point](https://www.openstreetmap.org/node/11832252014). A recreation-ground polygon and a park polygon are also mapped. Most building names and entrances are absent.

The mismatch between the mapped college polygon and the footprint distribution should be checked on site. It may reflect an incomplete/approximate boundary, buildings outside the institution’s campus area, or both; this audit cannot decide which.

### Entrances, crossings and vegetation

- There are no explicit `entrance=*` features in the extract.
- Five nodes are tagged `barrier=gate` and `access=private`. One is within the mapped college polygon; four sit just west of its boundary. These are mapped gates, not verified public/student entrances.
- One `highway=crossing` node is inside the polygon.
- Three `natural=tree` points are inside the polygon, tagged broadleaved with OSM heights of 2 m, 4 m and 5 m. These are OSM attributes, not ShadeRoute measurements. No canopy diameter/outline is supplied.
- No `covered=yes` way was found. Covered corridors and arcades therefore remain unrepresented in this extract.

## Limits of this finding

OSM is a volunteer-maintained database, not an authoritative campus plan. This bounded snapshot may miss features outside its extent, OSM tagging may not match campus access rules, and the college polygon itself is unverified. The graph check uses OSM node topology and a midpoint-in-polygon rule; it does not verify whether paths physically meet, remain open, are walkable, or are accessible. It also does not establish the full legal access network for students or visitors.

No commercial satellite imagery was traced or used to create features. The raw extract and any database derived from it require OSM attribution and ODbL handling. See `DATA_AND_LICENSES.md` and the [OSM copyright/licence page](https://www.openstreetmap.org/copyright).

## Field verification plan

1. Walk the mapped campus boundary and identify every actual pedestrian gate. Confirm which are available to students/visitors and how they connect to paths. Do not treat an OSM `access=private` way as available until campus access is confirmed.
2. Walk every intended routeable path, courtyard connection, ramp, staircase, covered corridor and crossing. Record GPS traces and intersections; note closures, restricted areas, surface, steps and accessible alternatives. A trace is evidence for a route geometry, not a reason to invent a shortcut between nearby lines.
3. Compare each traced segment to the source way/node IDs. Add field-survey IDs for genuinely missing connections and keep OSM and survey provenance distinct.
4. Have a second teammate re-walk the main demonstration route and spot-check a sample of the remaining paths. Recompute connected components after corrections; inspect isolated components and dead ends.
5. Verify building footprints and names from on-site observation. Record floor counts or height only where observable; otherwise leave height unknown.
6. For later shade work, survey trees and covered structures along verified paths. Record tree position, approximate crown size/coverage, observation time and method. Do not treat the OSM trunk point or height tag as a canopy footprint or shade measurement.

The first demo pair should be chosen only after the field-checked graph contains a connected route between its two real endpoints. If there is no verified alternative, report that route modes coincide or that more data is needed.
