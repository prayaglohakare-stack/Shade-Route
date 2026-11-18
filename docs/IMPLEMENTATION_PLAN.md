# Initial implementation plan

The project is in submission freeze. Note: **No field validation has been performed.** All network edges, building heights, tree canopies, and shade values are unverified model estimates. ShadeRoute is a direct-sun exposure and shade estimation tool, not an ambient air temperature prediction tool.

## Stage 0 — Data gate

1. Retrieve one bounded OSM snapshot for the pilot area and record its date, query and attribution.
2. Inspect pedestrian paths, entrances, stairs, crossings, buildings and access tags.
3. Validate network connectivity and choose connected start/destination pairs.

**Exit:** reviewed local campus bundle; all edges labelled `unverified` and `osm-derived`.

## Stage 1 — Minimal map and shortest-route slice

1. Scaffold the React/Vite/TypeScript web app only after implementation approval.
2. Load the local campus registry and selected bundle through the campus-data adapter.
3. Render imported pilot geometry with Leaflet and visible OSM attribution.
4. Select endpoints on connected path edges, snap them to the graph, and calculate a shortest route in the pure route module.
5. Show distance and walking-time estimate with the speed assumption stated.

**Exit:** a route can be recalculated from two points on a connected pilot path with Wi-Fi disabled.

## Stage 2 — Shade-aware comparison

1. Load shade records independently from network geometry and check their network revision.
2. Compute shaded, exposed and unknown distance separately.
3. Add balanced and more-shade modes only when shade evidence and route alternatives support a meaningful comparison.
4. Explain when route modes resolve to the same route or when coverage is insufficient.

**Exit:** every displayed shade figure maps to an observed or documented modeled record; unknown distance remains visible.

## Stage 3 — Demo hardening

1. Bundle/cache the frontend and selected campus files.
2. Verify the app starts and routes with Wi-Fi disconnected after its assets are local.
3. Check desktop and narrow mobile layouts, keyboard use, contrast, attribution and data-version text.
4. Rehearse route pairs supported by the pilot graph and prepare a fallback explanation of any data gaps.

## Deferred until after the first demonstration

Broader canopy survey, validated shadow simulation, additional campus bundles, offline report queueing, shared reports, moderation, accounts, database, hosted API, weather, satellite datasets and public deployment.

## Acceptance checks to run during implementation

- A malformed bundle is rejected with a useful error.
- A hand-built tiny graph fixture proves the route algorithm only; fixtures are never presented as VIT geography.
- A real campus route uses connected, routeable edges and has reproducible distance totals.
- Missing shade yields unknown coverage rather than a fabricated percentage.
- Static data and route calculations remain usable offline after the app and bundle are available locally.
