# ShadeRoute web app

The VIT Bibwewadi prototype is a static React, Vite, and TypeScript application. It renders the preserved OpenStreetMap extract locally with Leaflet and does not request map tiles or other runtime services. Production builds register a small service worker that caches the app shell and its local assets for later offline visits.

## Run locally

```powershell
cd web
npm install
npm run dev
```

The build command is `npm run build`.

## Current data state

The map displays source features from `data/osm/vit-bibwewadi-2026-11-17.osm` as an unverified reference layer. Each feature is explicitly non-routeable; the raw source snapshot is not modified. Map clicks create temporary unsnapped points in the browser session.

There is no published VIT pedestrian network or shade bundle. The app therefore does not draw route lines or show route distances, walking times, exposed distance, or shade percentages. The shortest-route engine is an independent module and accepts only permitted, field-verified edges. Balanced and more-shade modes remain gated until the evidence and connected alternatives exist.

The campus data adapter can load future local, versioned bundles without changing the routing module. It does not implement a backend or report store.
