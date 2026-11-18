/**
 * web/src/data/demoTrips.ts
 *
 * Curated demonstration trips across the Bibwewadi / Chintamani Nagar pilot area.
 * Identified by scripts/find_demo_trips.py on the covered pilot network:
 * - 3 trips where the Cooler Route clearly wins (saving >= 1.0 direct solar minutes within <= 25% detour)
 * - 1 trip where the Shortest Route is already optimal / about as shaded (labelled honestly)
 *
 * All endpoints snap within <= 25 metres (well below 30 m limit).
 * Unknown shade length is 0.0% on both routes for all trips.
 */

export interface DemoTripEndpoint {
  label: string;
  nodeId: string;
  coordinates: [number, number];
  snapDistanceMetres: number;
}

export interface DemoTrip {
  id: string;
  title: string;
  tag: 'cooler-win' | 'shortest-optimal';
  badgeLabel: string;
  summary: string;
  origin: DemoTripEndpoint;
  destination: DemoTripEndpoint;
  expectedOutcome: {
    recommendedMode: 'more-canopy' | 'shortest';
    expectedSavingsMin: number;
    honestNote: string;
  };
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    id: 'demo-hospital-to-upper-chintamani',
    title: 'Shree J. Hospital → Upper Chintamani Sector',
    tag: 'cooler-win',
    badgeLabel: 'Cooler Route Wins (Save 1.8 min sun)',
    summary: 'Substantial shade savings (~1.8 min direct sun avoided) by choosing continuous tree canopy corridors with only +2.2% detour.',
    origin: {
      label: 'Shree J. Hospital — Main Entrance',
      nodeId: 'node-7146481726',
      coordinates: [73.8645371, 18.4654236],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Upper Chintamani Residential Sector',
      nodeId: 'node-2280623361',
      coordinates: [73.8705679, 18.4643193],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.8,
      honestNote: 'Cooler route avoids 1.8 minutes of direct sun with just a 26-metre (+2.2%) detour through mature tree canopies.',
    },
  },
  {
    id: 'demo-hospital-to-bibwewadi-lane',
    title: 'Shree J. Hospital → Bibwewadi Society Lane',
    tag: 'cooler-win',
    badgeLabel: 'High Efficiency (Save 1.6 min sun, +0.9% detour)',
    summary: 'Near-zero distance penalty (+0.9% detour, +8 m) cutting 1.6 minutes of noon solar exposure through shaded residential lanes.',
    origin: {
      label: 'Shree J. Hospital — Main Entrance',
      nodeId: 'node-7146481726',
      coordinates: [73.8645371, 18.4654236],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Bibwewadi Society Corridor',
      nodeId: 'node-7987554269',
      coordinates: [73.8689825, 18.4635716],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.6,
      honestNote: 'A mere 8-metre adjustment routes pedestrians under dense residential street canopies.',
    },
  },
  {
    id: 'demo-clinic-to-east-lane',
    title: 'Anandi PolyClinic → East Chintamani Lane',
    tag: 'cooler-win',
    badgeLabel: 'Tree Corridor (Save 1.2 min sun, +3.4% detour)',
    summary: 'Cross-neighborhood route trading sun-exposed asphalt for shaded residential corridors with negligible extra walking.',
    origin: {
      label: 'Anandi PolyClinic',
      nodeId: 'node-4340688578',
      coordinates: [73.86616, 18.46307],
      snapDistanceMetres: 24.2,
    },
    destination: {
      label: 'East Chintamani Residential Lane',
      nodeId: 'node-4340690844',
      coordinates: [73.8697919, 18.4632765],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.2,
      honestNote: 'Cooler route gains 1.2 minutes of shade for only +22 metres (+3.4%) walking distance.',
    },
  },
  {
    id: 'demo-vit-gate-to-temple',
    title: 'VIT Student Gate → Shri Vimalnath Temple',
    tag: 'shortest-optimal',
    badgeLabel: 'Shortest Route Optimal (Honest tie)',
    summary: 'Honest evaluation: the direct shortest route already follows the most shaded corridor available. Detours yield no extra shade.',
    origin: {
      label: 'VIT Pune — Student Pedestrian Gate',
      nodeId: 'node-4332244859',
      coordinates: [73.8677105, 18.4632597],
      snapDistanceMetres: 0.0,
    },
    destination: {
      label: 'Shri Vimalnath Temple — Street Access',
      nodeId: 'node-10230350571',
      coordinates: [73.8644622, 18.4672897],
      snapDistanceMetres: 0.0,
    },
    expectedOutcome: {
      recommendedMode: 'shortest',
      expectedSavingsMin: 0.0,
      honestNote: 'Shortest route is already about as shaded. The engine honestly avoids recommending an artificial detour.',
    },
  },
];
