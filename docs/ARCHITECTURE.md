# ShadeRoute architecture decisions

**Status:** approved for the VIT MVP. This document records the decisions that constrain the first implementation.

## Product boundary

ShadeRoute helps a pedestrian compare routes by distance, estimated walking time and shade evidence. Shade is not temperature. Every displayed path and route must come from campus data that is sourced or physically verified. Missing shade coverage is unknown, not an assertion of sun exposure.

## MVP architecture

The MVP is a static web application. It loads a versioned campus bundle available on the device and computes routes in the browser. It has no runtime backend, database, account system, crowdsourced submission feature or required external API. Campus data retrieval and review happen outside the running product; the reviewed bundle is then published with the frontend.

Keep offline routing independent of online services. Bundle the required frontend assets and VIT data, and cache them for offline use after they have been downloaded or otherwise installed on the device. Do not use the standard OSM raster tile service as an offline basemap. Render only the verified campus data with the map library.

## Technology choices

- **Frontend:** React + Vite + TypeScript. Use a single primary map experience initially; no client-side page router is needed for the MVP.
- **Map:** Leaflet 1.9.4 stable, rendering locally available campus geometry. Avoid a third-party tile service dependency.
- **Route engine:** a pure browser module that receives normalized network and shade inputs and returns routes and metrics. It must not import React, Leaflet, filesystem paths or network-provider code.
- **Campus data access:** a small loader/validator that resolves a campus ID to local manifest, network and optional shade data. Future delivery from a static host or API can replace this adapter without changing route calculations.
- **Processing:** no mandatory Python pipeline in the MVP. Python 3.14 is available for later offline preprocessing if a concrete need justifies the geospatial dependency set.
- **Future reports:** no report storage implementation in this phase. When shared reports are approved, implement their network submission and persistence separately from the route engine and published campus bundle.

## Separation boundaries

1. **Campus bundle** is the published source for campus identity, path geometry, topology, provenance and any available shade data.
2. **Campus data adapter** loads and validates bundles, then presents normalized inputs to routing and map rendering.
3. **Route engine** performs routing using only those normalized inputs and route preferences.
4. **Future report storage** will accept, validate and persist user reports through a network write path. It will not be required to calculate or display the currently published routes.

Do not add a placeholder API, database, generic service framework or provider-specific SDK to establish these boundaries.

## Routing semantics

- **Shortest:** minimize walkable distance over routeable edges.
- **Balanced:** minimize a documented combination of distance and estimated exposure.
- **More shade:** prefer lower estimated exposure within a documented detour limit, when the graph and shade inputs provide a meaningful alternative.

Unknown shade remains a separate output metric. The route-cost policy may conservatively penalize unknown edges, but the UI must never convert unknown coverage into a shaded or sunlit measurement. Identical alternatives are reported as coincident; the app must not manufacture route diversity.

The first vertical slice may implement only shortest routing. Shade-dependent modes are gated on usable shade evidence and defined route-cost behavior.

## Offline behavior

The app shell and selected campus bundle are packaged or cached locally. Route calculations use those local inputs and continue when no network is available. Bundle freshness is reported via the manifest revision and publication time. Later online report synchronization, if built, must not block offline routing.

## What is deferred

- Shared user reports, authentication, moderation, anti-spam controls and a network write API.
- Centralized database or live campus-data editing.
- Multi-campus search/discovery UI (the data contracts support multiple stable campus IDs).
- Geometric shadow precomputation and any mandatory Python/GIS pipeline.
- Weather services and satellite-derived canopy or building data.
- Production hosting decisions and paid custom domains.
