# ShadeRoute

**Take the cooler way.** ShadeRoute is a climate-aware pedestrian navigation pilot for Vishwakarma Institute of Technology (VIT), Bibwewadi, Pune. It is intended to compare walking routes by distance, estimated time and documented shade availability.

## Project status

This repository contains the local project foundation, architecture notes and versioned data contracts. It does not yet contain the web application or verified VIT campus geometry. No campus paths, buildings, tree positions, routes or shade observations are included until they have been obtained and checked.

## MVP architecture

- Static frontend and locally available, versioned campus data.
- Browser-side route calculations over an explicit walking graph.
- No runtime backend, database, paid API or map-tile dependency.
- App and campus data should remain usable offline after they have been made available on the device.
- Future shared reports and moderation are separate capabilities that would require a network write path and durable storage.

## Workspace layout

- `web/` — future frontend application; no app scaffold yet.
- `data/campuses/` — campus registry and, after validation, campus bundles.
- `data/osm/` — source snapshot notes and attribution records.
- `data/survey/` — field survey protocol and reviewed observations.
- `schemas/` — JSON Schemas for the registry and campus bundle contracts.
- `docs/` — architecture, licensing, contract and implementation decisions.

## Decisions and next steps

See [Architecture](docs/ARCHITECTURE.md), [Data contract](docs/DATA_CONTRACT.md), [Data sources and licensing](docs/DATA_AND_LICENSES.md), and [Implementation plan](docs/IMPLEMENTATION_PLAN.md). The first implementation gate is to acquire and field-check real campus paths; routing must not be demonstrated as VIT routing before that gate passes.

## Local development environment

The inspected machine has Node.js 24.20.0, npm 11.19.0, Git 2.55.0 and Python 3.14.7. No dependencies have been installed. Python 3.12 is not a project requirement. The initial frontend stack is planned as React, Vite and TypeScript with Leaflet; dependency installation will happen only when application implementation is approved.
