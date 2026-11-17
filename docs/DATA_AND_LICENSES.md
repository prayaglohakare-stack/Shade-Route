# Data sources and licensing

## OpenStreetMap

OpenStreetMap is the planned primary source for the first campus network and building footprints. The campus extract has not yet been retrieved or validated in this workspace. Preserve the snapshot date and source query, retain original element IDs, and display `© OpenStreetMap contributors` with a link to the OSM copyright page wherever OSM data is displayed.

OSM data is licensed under the Open Database License (ODbL). Review the licence and share-alike obligations before distributing an OSM-derived campus database. Keep source provenance so that independent field observations can be distinguished from OSM-derived content.

Use a public Overpass instance for a deliberate, bounded one-time extract, then cache the result. It is a shared public service, not a production availability commitment. Do not build runtime app traffic on it. Avoid public Nominatim autocomplete or repetitive geocoding; the pilot address is known and the app does not need a general-purpose address-search service.

The standard `tile.openstreetmap.org` raster tiles are not the offline map-data solution. Its policy prohibits bulk fetching and offline tile archives and requires visible attribution and compliant caching. Use local verified campus vectors for the offline map.

## Field survey

Record field-added or field-corrected paths with a survey source ID, date, verification status and access notes. Record shade observations with time window, edge ID, method and observer code. Do not collect names or continuous user location histories. Survey only spaces the team is permitted to access; restricted paths are not routed through.

Keep any OSM-derived data and independently collected observations distinguishable in provenance. No imagery is to be traced into distributable geometry unless its licence explicitly permits that use.

## Software

The planned application dependencies (React, Vite, TypeScript and Leaflet) are open-source and have no licence purchase fee. Each dependency's licence and notices must be checked and included as required when dependencies are added. No paid API, tile service, weather service or hosted database is required by the MVP.

## Decisions still open

- App source-code licence and copyright ownership.
- Whether independently surveyed data will be published and under which licence.
- A public deployment host, if one is desired after the local demo.
