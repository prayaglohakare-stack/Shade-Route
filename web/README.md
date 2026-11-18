# ShadeRoute Web Application

ShadeRoute is an offline-first, client-side React 19 + TypeScript web application built with Vite and Leaflet. It computes pedestrian walking routes comparing shortest physical distance against cooler alternatives that minimize direct solar radiation through building-cast shadows and displaced tree crowns.

## Running Locally

```powershell
cd web
npm install
npm test
npm run build
npm run dev
```

## Architecture & Data State

- **Published Pilot Area:** Chintamani Nagar & Bibwewadi, Pune (`in-mh-pune-chintamani-bibwewadi`).
- **Offline-First:** All campus bundle files (`network.json`, `shade.json`, `landmarks.json`, `buildings.geojson`, `trees.geojson`, `canopy.geojson`) are loaded locally via static ES module chunks. No runtime server or external geocoding API is required.
- **Routing Engine:** Pure client-side binary min-heap Dijkstra and bicriteria Pareto constrained search (`web/src/routing/routeEngine.ts`). Evaluates arrival-time interpolated NOAA solar shadow fractions at 1.25 m/s pedestrian speed.
- **Detour Guardrails:**
  - Cooler Route: Minimizes direct sun minutes subject to hard distance detour constraint $\le 25\%$.
  - Balanced Route: Minimizes weighted exposure cost subject to hard distance detour constraint $\le 15\%$.
  - Honest Fallback: If cooler routing saves less than 1.0 minute in direct sun, the app plainly explains *"Shortest route is already about as shaded"* and recommends the shortest path.
- **Scientific Honesty:**
  - Every network edge is labelled `accessStatus: "osm-derived"` and `verificationStatus: "unverified"`.
  - **No field validation has been performed.**
  - Zero placeholder or fake ground observation data is created.
  - ShadeRoute is a direct-sun exposure and shade estimation tool, not a temperature prediction tool: shade blocks direct radiant solar flux (~800–1,000 W/m² in Pune), not ambient air temperature.
