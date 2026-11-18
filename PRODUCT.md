# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Vite, and TypeScript with Leaflet. The selected architecture is a static frontend with locally available campus data and browser routing. No backend or database is part of the VIT MVP.

## Users

Pedestrians at the VIT Bibwewadi campus who want to compare walking routes by distance, estimated time, and available shade evidence. Route access must be valid for the intended user group before an edge is navigable.

## Product Purpose

ShadeRoute is a direct-sun exposure and shade estimation tool, not an ambient air temperature prediction tool. It helps pedestrians compare walking routes by distance, estimated walking time, and the direct solar radiation obstruction available for each route. It must not present shade as measured temperature.

## Positioning

ShadeRoute combines pedestrian routing with explicit evidence about direct solar shade coverage and unknown coverage. No field validation has been performed; all network edges and landmarks are unverified and derived from OpenStreetMap geometry and the 2019 PMC tree census. Route and shade claims must be traceable to a published campus data bundle and its provenance.

## Operating Context

The active pilot is Chintamani Nagar — Bibwewadi Pedestrian Pilot (`in-mh-pune-chintamani-bibwewadi`), Pune. VIT Bibwewadi is a planned future expansion. The first application is a responsive web experience for desktop demonstrations and mobile use. Read-only campus data and route calculations work offline once the app and selected campus data are available on the device.

## Capabilities and Constraints

- Intended route concepts are shortest, balanced, and more shade. Shade-dependent comparisons require usable shade evidence and a meaningful route alternative.
- The route engine is independent of React, Leaflet, storage, and network delivery.
- Campus identity uses stable IDs; campus bundles are versioned and loaded through a replaceable data adapter.
- The project budget is strictly ₹0. No paid services, APIs, tiles, subscriptions, or datasets.
- The VIT OSM snapshot under `data/osm/` is a raw reference source, not a field-verified route graph. No VIT network bundle has been published.
- The campus visit produced retrospective qualitative notes only. No GPS tracks, measurements, photos, verified path geometry, confirmed access permissions, or quantified shade observations are available.
- Do not invent campus features or route results. Missing shade is unknown. Unknown or unverified information must remain visibly distinct from measured or verified information.
- Future shared reports, moderation, and centralized updates require a network write path and persistent storage; they are out of scope for the current MVP.

## Evidence on Hand

- Bounded OSM source snapshot and metadata: `data/osm/vit-bibwewadi-2026-11-17.osm` and its adjacent metadata.
- Desktop OSM topology assessment: `docs/VIT_DATA_AUDIT.md`.
- Retrospective, non-GPS visit notes and collection protocol: `docs/VIT_FIELD_SURVEY_SPEC.md`.
- There are no accepted VIT route edges or shade records in `data/campuses/in-mh-pune-vit-bibwewadi/`.

## Product Principles

1. Show only sourceable geography; no field validation has been performed, and all paths are explicitly labelled unverified.
2. Keep route, shade, and uncertainty evidence separate and explainable.
3. Never translate unknown coverage into sun exposure or shade.
4. Keep the read-only routing experience independent from future report submission.
