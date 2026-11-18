# Campus data contract — version 1

This contract is the boundary between campus-data preparation and the browser application. It is designed for static local bundles and does not require an API or database.

## Version rules

- `campusId` is an immutable, globally unique slug. The VIT pilot ID is `in-mh-pune-vit-bibwewadi`.
- Every published file carries `schemaVersion: 1` and the same campus ID.
- A campus manifest has a monotonically increasing integer `dataRevision`. Any change to that campus bundle increments the revision. `publishedAt` records when that revision was assembled.
- Increment `schemaVersion` only for an incompatible contract change. Adding an optional field is compatible; readers must ignore unrecognized optional fields.
- OSM element IDs are retained as source references. App edge IDs and node IDs remain stable across revisions when the represented feature remains the same; never use array position as an ID.
- A `shade.json` file identifies the `networkRevision` it describes. A mismatch invalidates its edge references until reconciled.

## Bundle layout

Each available campus bundle lives under `data/campuses/<campusId>/` and contains:

- `manifest.json` — campus metadata, bundle revision, local timezone, file names and source/licence provenance.
- `network.json` — explicit graph nodes and walkable edges, including each edge's geometry and verification/access properties.
- `shade.json` — optional shade records keyed by edge ID. Absence of a record means unknown shade.

The registry at `data/campuses/index.json` may list a campus before its routeable bundle exists. A pending registry entry is not a usable route dataset.

## Manifest fields

`manifest.json` contains:

- `schemaVersion`, `campusId`, `dataRevision`, and ISO 8601 `publishedAt`.
- `campus`: stable display name, postal address, IANA timezone, and optional centre and bounds.
- `files`: relative paths for `network.json` and optional `shade.json`.
- `sources`: source name/type, capture date when known, licence and required attribution text; include a stable `sourceId` and source URL when available.
- `limitations`: concise known gaps or verification notes.

Do not add guessed centre coordinates or bounds. Geographic values are included only after they are derived from a source or survey and checked.

## Network fields

`network.json` contains `schemaVersion`, `campusId`, `dataRevision`, `nodes`, and `edges`.

- A node has a stable `nodeId` and `coordinates` in `[longitude, latitude]` order using WGS 84 / RFC 7946 conventions.
- An edge has a stable `edgeId`, `fromNodeId`, `toNodeId`, a `LineString` coordinate array, `pathClass`, `accessStatus`, `verificationStatus`, and `sourceRef`.
- `sourceRef` identifies `osm`, `survey`, `institution`, or `other` provenance and carries the original element/record ID where applicable.
- The first and last edge coordinates correspond to the referenced endpoint nodes. Graph connectivity is based on IDs, not visual line crossings.
- Closed or access-unclear features are not silently treated as routeable. Access is checked independently from geometry verification.
- Length is derived from geometry by the route engine or a documented preprocessing step; no manually guessed lengths are accepted.

## Shade fields

`shade.json` contains `schemaVersion`, `campusId`, `networkRevision`, and `records`.

- A record has `edgeId`, a validity interval (`validFrom`, `validUntil` with timezone offset), and `status`: `observed`, `modeled`, or `unknown`.
- Observed/modelled records include `shadeFraction` in `[0, 1]`, a method, and an evidence/source reference.
- Modelled records may include `shadeFractionRange` with `low` and `high` bounds when those bounds come from a documented sensitivity method.
- Unknown records include a reason where known and omit `shadeFraction` and range. If an edge has no record, its shade remains unknown.
- `observedAt` or model-generation time is retained separately from the interval for which the record is valid.
- Version 1 does not include a numeric confidence score or an arbitrary quality grade.

## Validation rules

The bundle validator must reject incompatible schema versions, duplicate IDs, missing edge endpoints, coordinate order/range errors, non-positive or malformed geometry, shade records for absent edges, and shade/network revision mismatches. A separate network report checks connected components, isolated nodes, zero-length edges, and routeability. These checks do not prove campus completeness; field verification remains necessary.

The JSON Schemas in `schemas/` enforce the structural portions of these rules. Cross-file and graph-topology checks require semantic validation in the eventual application/data tooling.
