# Initial implementation plan

The project is still at foundation stage. The order below is the approved path to a truthful VIT demonstration. No campus geometry or shade data should be invented to bypass a blocked stage.

## Stage 0 — Data gate

1. Retrieve one bounded OSM snapshot for the VIT Bibwewadi campus area and record its date, query and attribution.
2. Inspect pedestrian paths, entrances, stairs, crossings, buildings and access tags.
3. Walk the campus routes the team can survey; record corrections and shade observations with time and provenance.
4. Validate network connectivity and choose at least one real connected start/destination pair.

**Exit:** reviewed local campus bundle or an explicit report that the routeable campus data is not yet available.

## Stage 1 — Minimal map and shortest-route slice

1. Scaffold the React/Vite/TypeScript web app only after implementation approval.
2. Load the local campus registry and selected bundle through the campus-data adapter.
3. Render only verified/imported campus geometry with Leaflet and visible OSM attribution.
4. Select endpoints on connected path edges, snap them to the graph, and calculate a shortest route in the pure route module.
5. Show distance and walking-time estimate with the speed assumption stated.

**Exit:** a route can be recalculated from two points on a verified campus path with Wi-Fi disabled.

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
4. Rehearse one route pair supported by the verified graph and prepare a fallback explanation of any data gaps.

## Deferred until after the first demonstration

Broader canopy survey, validated shadow simulation, additional campus bundles, offline report queueing, shared reports, moderation, accounts, database, hosted API, weather, satellite datasets and public deployment.

## Acceptance checks to run during implementation

- A malformed bundle is rejected with a useful error.
- A hand-built tiny graph fixture proves the route algorithm only; fixtures are never presented as VIT geography.
- A real campus route uses connected, routeable edges and has reproducible distance totals.
- Missing shade yields unknown coverage rather than a fabricated percentage.
- Static data and route calculations remain usable offline after the app and bundle are available locally.
