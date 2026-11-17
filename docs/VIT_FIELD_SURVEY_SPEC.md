# VIT Bibwewadi field survey specification

**Milestone:** field-verified corridor v1  
**Candidate:** VIT Library to VIT Canteen, subject to on-site confirmation  
**Status:** collection protocol with retrospective qualitative observations; no GPS-verified geometry has been accepted

## Retrospective visit notes (user-provided)

These notes were supplied after a physical visit. No visit date, GPS tracks, photographs, written measurements, or accuracy readings were collected. They are useful for planning the first corridor demonstration and for directing the next verification pass, but they are not GPS survey evidence and do not establish exact geometry or graph connectivity.

- The Library-to-Canteen walk appeared to have two possible route options. The labels **Route A** and **Route B** below are temporary planning labels, not stable path IDs or encoded graph routes.
- Route A was described as shorter and mostly exposed to sunlight.
- Route B was described as longer and including covered walkways and trees.
- Trees and covered sections were observed along the walk. Their positions, extents, canopy dimensions, shade timing, and route association were not recorded.
- No stairs, ramps, gates, or restricted-path obstacles were noticed during the visit. This does not establish accessibility, access permission, or that none exist along every segment.
- The visitor did not notice missing paths compared with OSM. This is a retrospective impression, not a systematic OSM-to-ground comparison; mapped geometry and connectivity remain unverified.

**Data treatment:** provenance is `user-provided retrospective field notes`; capture date is `not recorded`; geometry, junction IDs, GPS accuracy, distance, and shade coverage are `unknown`. Do not assign stable path IDs or add route edges from these notes alone. Do not convert “shorter/longer,” “mostly exposed,” or “includes trees/covered walkways” into numeric lengths, shade fractions, or observed-shade records. Shade remains unknown in the route dataset.

**First demo planning:** use the two options as hypotheses to guide a measured follow-up: identify the real Library and Canteen pedestrian access points, walk and record each alternative in both directions, map their shared and divergent junctions, and confirm audience-specific permission. After graph validation, the product may compare the alternatives by measured geometry. The qualitative observations can inform later shade data collection, but the demo must not claim measured temperature or quantified shade until separately evidenced.

This specification defines what the three-person team must observe before a path becomes routable. The existing OSM snapshot is immutable source evidence, not a claim that a path is open, connected, or complete. Surveyors must not trace imagery, draw a shortcut between nearby GPS lines, or infer a junction from a two-dimensional line crossing.

## 1. Survey area and endpoint decision

Start by confirming with campus staff that the team may survey the intended public/student areas. Ask which entrance, library access point, and canteen access point are permitted for the intended demo audience. The retrospective note that no restriction was noticed is not permission evidence. Do not treat OSM `access=private`, a mapped gate, or an unlocked door as permission.

The proposed origin and destination are labels only until physically found. Record the actual pedestrian access point used by a person entering/leaving each venue. If the mapped library node or canteen footprint does not coincide with that point, retain the OSM feature as a source reference and create a distinct surveyed entrance/junction record. A route endpoint must attach to a verified graph node; it must not be an arbitrary building centroid.

Keep the first survey to the shortest practical corridor connecting these two verified endpoints, plus only the branches needed to represent real route choices. Expand only after the first graph is connected and independently walkable.

## 2. Team procedure

All three members walk the proposed corridor together on the first pass. Use these roles and rotate them on the return pass:

1. **Track recorder:** records a raw GNSS/phone track with timestamps and reported horizontal accuracy; does not use snap-to-road or route-following smoothing.
2. **Feature recorder:** logs junctions, entrances, path boundaries, stairs/ramps, crossings, closures, surface, access evidence, and uncertainties. Assigns provisional IDs from the survey ledger.
3. **Independent checker:** follows the observed path, checks that each recorded junction is physically traversable, and notes disagreements without editing the first track.

Walk the whole corridor in both directions. Record one raw track per direction, preferably with a second phone on at least one pass. At every junction, stop safely and collect a stationary fix for at least 30 seconds; extend to 60 seconds where the reported accuracy is unstable. Record the phone/app, capture time, reported horizontal-accuracy radius and whether the receiver had open sky, tree cover, or building obstruction. Never substitute the accuracy of one device for another.

The independent checker then re-walks the complete candidate route using only the survey notes and candidate graph, without being guided turn-by-turn by the recorder. This is an independent route validation, not merely a review of the same GPS trace. Record any missed turn, inaccessible link, ambiguity, or endpoint mismatch as a finding and resolve it with a new field observation.

Do not collect names, faces, student IDs, or personal location histories. Obtain campus approval before taking photographs; avoid identifiable people and keep evidence focused on the path/access feature. If a feature cannot be photographed appropriately, written observations and a second walk are acceptable evidence.

## 3. GPS accuracy policy

Phone-reported horizontal accuracy is an estimate, not a guarantee. GPS.gov notes that smartphone accuracy is typically within a 4.9 m radius under open sky and worsens with blockage and receiver/environment factors; OSM also cautions against correcting mapped geometry from a single noisy trace. Use field observation and repeated traversals alongside the numeric estimate. See [GPS.gov accuracy guidance](https://www.gps.gov/gps-accuracy) and [OSM accuracy guidance](https://wiki.openstreetmap.org/wiki/Accuracy).

Record accuracy in metres as reported by the device/app, together with timestamp and device/app identity. If the app exposes no estimate, record `not-reported`; do not invent one. Preserve raw tracks unchanged. Do not snap or average tracks into a fabricated centerline.

Apply these project acceptance bands to survey points and junction anchors:

| Reported horizontal accuracy | Use |
| --- | --- |
| `<= 5 m` | Preferred for endpoint/junction coordinate evidence, provided the point was stationary and agrees with the physical feature and repeat observation. |
| `> 5 m and <= 10 m` | Conditional. Accept only when both-direction traces, a second observation/device, and an unambiguous physical landmark support the location. Mark the coordinate confidence conditional. |
| `> 10 m`, missing, or unstable | Do not use the fix alone to establish a junction, endpoint, or narrow-path geometry. Recollect in a better location/time or use it only as contextual evidence tied to a clearly identified physical landmark. |

These are conservative project rules, not GPS performance guarantees. A reported `<=5 m` reading does not prove a topological connection. A path that passes under/over another feature or touches it only on the map is not connected unless surveyors confirm a traversable at-grade link.

For path shape, raw walking tracks are evidence of where the recorder walked, not exact path edges. Preserve the raw GPX/track file and record any derived simplified geometry separately with method, author, date, and source-track IDs. Retain bends, forks, barriers and crossings that affect navigation. Do not simplify away meaningful topology. Use WGS 84 longitude/latitude for published coordinates.

## 4. Stable identifiers and survey record fields

Assign IDs from a shared ledger before transcribing data. IDs must not encode coordinates, names likely to change, array positions, or capture order. Never recycle a retired ID. Suggested readable forms are `vitb-path-0001`, `vitb-jct-0001`, `vitb-endpoint-library-entrance`, and `vitb-survey-2026-11-17-01`; uniqueness and persistence matter more than the prefix. Keep the candidate origin/destination IDs stable when the geometry is revised.

For every **path segment**, record:

- `pathId`, survey status, path class (`footway`, `path`, `pedestrian`, `steps`, `covered-walkway`, `service-road`, or `other`), and whether it is traversable in each direction;
- endpoint `fromJunctionId` and `toJunctionId`; split at every real choice, crossing, access transition, or material surface/level change;
- raw track IDs, survey session IDs, timestamps, observers by non-identifying team code, and any derived-geometry method;
- GPS device/app and per-fix reported accuracy where available; coordinate confidence and known obstruction;
- physical observations: surface, width only if actually measured, steps/ramp presence, crossing type, barrier/closure, and notes;
- access status and evidence (see section 5);
- OSM source way/node/relation IDs and tags where the segment corresponds to OSM, or the survey record IDs that support a new feature;
- verification status, verifier, verification date, and unresolved issues.

For every **junction**, record:

- stable `junctionId`, coordinate, coordinate order `[longitude, latitude]`, capture method, timestamp, reported horizontal accuracy, confidence, and physical description/landmark;
- every incident `pathId` and whether each connection was physically traversed/confirmed;
- whether the paths meet at grade, and any level separation, barrier, gate, or access distinction;
- source references, first observer, independent verifier, and status.

For each **origin/destination**, record a stable endpoint ID, venue label, exact pedestrian access point description, its attached junction ID, audience-specific permission evidence, capture evidence, and verification status. Store no building centroid as a substitute for an entrance.

Each record must include provenance with `sourceType` (`osm`, `field-survey`, `institution`, or `other`), stable `sourceId`, capture date, contributor/team code, and a short method note. Where a field correction relates to OSM, retain the original OSM IDs and original tags in the source reference; represent the field finding as a separate correction/overlay record. Never rewrite the downloaded OSM file.

## 5. Access and verification states

Track physical traversability and permission separately. Use access values:

- `permitted`: permission for the demo audience was explicitly confirmed by an authorized campus representative or a clearly applicable posted policy, with evidence and date recorded;
- `restricted`: evidence says the demo audience may not use it;
- `unclear`: conflicting, conditional, or incomplete evidence;
- `unknown`: not checked.

Record who/what established permission (role/office or posted policy, not personal data), the intended audience (`students`, `staff`, `visitors`, or defined subset), date, conditions/hours if any, and review/expiry date if supplied. A surveyor's ability to walk a path is not permission evidence. Do not publish a routeable edge with `restricted`, `unclear`, or `unknown` access. Reconfirm permission if it is time-limited or the campus policy changes.

Use verification statuses:

- `unverified`: imported from OSM or proposed but not checked on site;
- `observed`: a team member physically traversed/observed it; not yet independently checked;
- `independently-verified`: the full segment/junction was separately re-walked and the graph relationship checked by another team member;
- `rejected`: found absent, impassable, incorrectly connected, or otherwise unsuitable; retain the record and reason, but exclude it from routing;
- `stale`: a previously checked feature is known or reasonably suspected to have changed; exclude until rechecked.

The current network schema's `field-verified` value should mean the equivalent of `independently-verified` for route publication, not merely “someone saw it.” Before data is serialized, reconcile these terms in the contract/schema so a validator can reject ambiguous states.

## 6. Preserve and combine OSM with survey evidence

Treat `data/osm/vit-bibwewadi-2026-11-17.osm` and its metadata as immutable raw source files. Verify its recorded SHA-256 before and after survey-data preparation. Do not edit or re-export it as if it were the original.

For every candidate segment, classify its relationship to OSM:

- `matched`: field-observed feature corresponds to an OSM way/segment; retain OSM element IDs and tags, while attaching the survey evidence and separately recorded access finding;
- `corrected`: field observation contradicts an OSM geometry/tag; retain the raw OSM reference and add a surveyed replacement/overlay with explanation. Do not silently move OSM coordinates;
- `added`: physically observed feature absent from the snapshot; assign a new stable survey ID and attach both-direction/independent evidence;
- `not-present`: mapped feature was not found or is not usable; keep the source reference and mark rejected/stale with reason rather than deleting it from raw provenance.

OSM identifiers are not ShadeRoute node IDs. A survey junction can reference one or more OSM nodes/ways but receives its own stable campus junction ID. Connect two graph edges only when they share the same verified junction ID. Never connect lines solely because their coordinates are close or they cross visually.

Keep raw GPX and survey ledger files in `data/survey/` as source evidence. Publish only reviewed graph geometry and provenance; preserve a reproducible link from each published path to its raw track/field record. Continue OSM attribution and ODbL handling for data derived from OSM as documented in `DATA_AND_LICENSES.md`.

## 7. Graph validation and route acceptance

Run these checks on the candidate demonstration subgraph after excluding restricted, unclear, unknown-access, rejected, stale, and not-independently-verified records:

1. **Identity/structure:** all IDs are unique and stable; all edge endpoints reference existing junctions; each edge geometry's first/last coordinates correspond to those junctions; coordinates are valid WGS 84 `[lon, lat]`; each edge has provenance, capture/verification metadata, access evidence, and a nonzero length.
2. **Topology:** every claimed connection is represented by a shared junction ID supported by a field observation. Check all crossings in the map against notes for at-grade connection versus over/underpass or mere crossing. Report dangling ends and components; do not auto-join nearby endpoints.
3. **Endpoint reachability:** both verified venue entrances resolve to graph junctions in the same connected component after routeability filters. The chosen route must start/end at the actual access point and use only permitted, independently verified edges.
4. **Field traversability:** an independent teammate walks the route generated from the candidate graph in both directions without guidance from the recorder. Any missed turn, dead end, blocked edge, inaccessible gate, or mismatch invalidates the affected edge/junction until corrected and rechecked.
5. **Repeatability:** run graph validation after every correction and retain the component counts, excluded edge reasons, validation date, and reviewer. A connected graph is necessary but does not prove the corridor is complete or safe.
6. **Data integrity:** source files remain unchanged; every routeable edge can be traced to OSM and/or field evidence; source attribution and licence data remain attached. Do not add shade values in this milestone. Shade remains unknown unless separately measured or supported by an explicitly documented model in a later milestone.

For a small corridor, a connected component consisting of the verified route is sufficient; the survey must not claim campus-wide completeness. At least one independently validated origin-to-destination route must exist. If the area has no genuine route alternative, the data can support a shortest/route demonstration, but must not claim a shadiest-versus-shortest distinction.

## 8. Acceptance checklist for corridor v1

- [ ] Campus permission for survey and demo audience/access is recorded.
- [ ] Library and canteen pedestrian endpoints are physically identified and permission-checked; candidate labels are changed if reality differs.
- [ ] Every routeable segment was physically traversed, split at actual junctions, and has stable IDs, source refs, raw evidence, access status, GPS metadata, and verifier/date.
- [ ] Every routeable junction has a stable ID, accuracy/confidence record, incident-edge list, and physical connectivity/level relationship verified.
- [ ] A separate teammate re-walked the complete route and confirmed both directions.
- [ ] Filtered graph validation places both endpoints in one connected component; no accidental intersections, dangling route edges, or unreviewed access remain.
- [ ] All excluded/unverified/rejected data and reasons are retained in the survey ledger; OSM raw snapshot and metadata hashes are unchanged.
- [ ] OSM attribution/ODbL provenance is present; shade records are absent/unknown.
- [ ] A second reviewer can follow the evidence from a published edge back to its source record without relying on undocumented team knowledge.

Passing this checklist establishes a trustworthy small routing graph, not a comprehensive campus map or a shade dataset.
