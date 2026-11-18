/**
 * web/src/data/demoTrips.ts
 *
 * Curated demonstration trips across the Bibwewadi / Chintamani Nagar pilot area.
 * Identified by scripts/find_demo_trips.py:
 * - 3 trips where the Cooler Route clearly wins (saving direct solar minutes within 25% detour)
 * - 1 trip where the Shortest Route is already optimal / about as shaded (labelled honestly)
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
    id: 'demo-lake-town-to-vit-library',
    title: 'Lake Town Junction → VIT Central Library',
    tag: 'cooler-win',
    badgeLabel: 'Cooler Route Wins (Save 2.6 min sun)',
    summary: 'Substantial shade savings (~2.6 min direct sun avoided) by routing through shaded residential lanes rather than the exposed arterial road.',
    origin: {
      label: 'Lake Town Road Junction',
      nodeId: 'node-10223133167',
      coordinates: [73.86452, 18.4619],
      snapDistanceMetres: 75.3,
    },
    destination: {
      label: 'VIT Central Library Entrance',
      nodeId: 'node-2235086352',
      coordinates: [73.86847, 18.46349],
      snapDistanceMetres: 49.5,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 2.6,
      honestNote: 'Cooler route avoids 2.6 minutes in direct sun with a +22% detour through continuous canopy cover.',
    },
  },
  {
    id: 'demo-vit-library-to-hospital',
    title: 'VIT Library → Shree J. Hospital',
    tag: 'cooler-win',
    badgeLabel: 'High Efficiency (Save 1.4 min sun, +3% detour)',
    summary: 'Near-zero distance penalty (+3.4% detour) that still saves 1.4 minutes of intense noon solar radiation.',
    origin: {
      label: 'VIT Central Library Entrance',
      nodeId: 'node-2235086352',
      coordinates: [73.86847, 18.46349],
      snapDistanceMetres: 49.5,
    },
    destination: {
      label: 'Shree J. Hospital',
      nodeId: 'node-7146481726',
      coordinates: [73.86419, 18.4653],
      snapDistanceMetres: 39.1,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.4,
      honestNote: 'A minor 23-metre society lane detour cuts direct sun exposure significantly.',
    },
  },
  {
    id: 'demo-temple-to-vit-library',
    title: 'Shri Vimalnath Temple → VIT Library',
    tag: 'cooler-win',
    badgeLabel: 'Tree Corridor (Save 1.2 min sun, +3% detour)',
    summary: 'North-south cross-neighborhood route trading open asphalt for mature tree canopies with negligible extra walking.',
    origin: {
      label: 'Shri Vimalnath Swami Jain Temple',
      nodeId: 'node-10230350571',
      coordinates: [73.86482, 18.46745],
      snapDistanceMetres: 41.7,
    },
    destination: {
      label: 'VIT Central Library Entrance',
      nodeId: 'node-2235086352',
      coordinates: [73.86847, 18.46349],
      snapDistanceMetres: 49.5,
    },
    expectedOutcome: {
      recommendedMode: 'more-canopy',
      expectedSavingsMin: 1.2,
      honestNote: 'Cooler route gains 1.2 minutes of shade for only +2.6% walking distance.',
    },
  },
  {
    id: 'demo-vit-gate-to-temple',
    title: 'VIT Main Gate → Shri Vimalnath Temple',
    tag: 'shortest-optimal',
    badgeLabel: 'Shortest Route Optimal (Honest tie)',
    summary: 'Honest evaluation: the direct shortest route already follows the most shaded corridor available. Detours yield no extra shade.',
    origin: {
      label: 'VIT Pune — Main Gate',
      nodeId: 'node-4332244859',
      coordinates: [73.86795, 18.46368],
      snapDistanceMetres: 53.1,
    },
    destination: {
      label: 'Shri Vimalnath Swami Jain Temple',
      nodeId: 'node-10230350571',
      coordinates: [73.86482, 18.46745],
      snapDistanceMetres: 41.7,
    },
    expectedOutcome: {
      recommendedMode: 'shortest',
      expectedSavingsMin: 0.0,
      honestNote: 'Shortest route is already about as shaded. The engine honestly avoids recommending an artificial detour.',
    },
  },
];
