# Three-person working split

This split assumes mixed experience and a short demonstration timeline. One person owns each workstream, with the shared contract agreed before integration.

## Campus data and survey lead

- Retrieve and cache the bounded OSM snapshot; preserve source IDs, query and date.
- Walk the routes the team can verify; record path gaps, entrances, stairs, access restrictions and shade observations.
- Validate graph connectivity and coordinate corrections with the routing lead.

## Frontend and map lead

- Own the React/Vite/TypeScript interface and Leaflet map.
- Keep the map dominant on desktop and usable with a mobile bottom-sheet pattern.
- Render only imported campus geometry; provide clear empty/error/loading states and attribution.

## Routing, contract and integration lead

- Own bundle validation and the pure route engine.
- Coordinate stable campus/edge/node IDs and semantic checks with the data lead.
- Reproduce route totals, run acceptance checks, and coordinate the demo rehearsal.

## Integration agreement

- Agree the schema and IDs before parallel implementation.
- Keep each workstream in its named area; coordinate contract changes with both data and frontend/routing owners.
- Use synthetic tiny graphs only as clearly labeled algorithm fixtures, never as campus data.
- Keep survey records limited to what is needed; use observer codes rather than names.
