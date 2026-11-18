export type Coordinate = [longitude: number, latitude: number];

export interface CampusEntry {
  campusId: string;
  name: string;
  address: string;
  timezone: string;
  dataStatus: 'pending-validation' | 'available' | 'published' | 'planned';
  dataRevision?: number;
}

export interface CampusNode {
  nodeId: string;
  coordinates: Coordinate;
}

export interface CampusEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  coordinates: Coordinate[];
  pathClass: string;
  accessStatus: 'osm-derived' | 'permitted' | 'restricted' | 'unclear' | 'unknown';
  verificationStatus: 'unverified' | 'field-verified' | 'osm-unverified' | 'survey-added' | 'closed' | 'unknown';
  sourceRef: { type: string; sourceId: string };
}

export interface RouteNetwork {
  schemaVersion: number;
  campusId: string;
  dataRevision: number;
  nodes: CampusNode[];
  edges: CampusEdge[];
}

export interface ShadeRecord {
  edgeId: string;
  validFrom?: string;
  validUntil?: string;
  status: 'observed' | 'modeled' | 'unknown';
  shadeFraction?: number; // Total combined shade fraction (strict union, zero double counting)
  treeShadeFraction?: number; // Tree canopy contribution fraction
  buildingShadeFraction?: number; // Building shadow contribution fraction
  coveredFraction?: number; // Covered structures contribution fraction
  unknownFraction?: number; // Fraction outside coverage box (never counted as exposed)
  uncertainFraction?: number; // Fraction dependent on Tier 4/5 estimates
  confidence?: string;
  isUncertain?: boolean;
  shadeFractionRange?: { low: number; high: number };
  method?: string;
  recordedAt?: string;
  sourceRef?: { type: string; sourceId: string };
  contributingSources?: string[];
  unknownReason?: string;
  slots?: Record<string, Array<[shade: number, tree: number, bldg: number]>>; // Hourly slots (07:00-17:00) per date
}

export interface BuildingProperties {
  osmId: string;
  name: string;
  buildingType: string;
  rawHeight?: number | null;
  rawLevels?: number | null;
  estimatedHeightM: number;
  footprintAreaM2: number;
  heightConfidenceTier: string;
  confidenceLabel: string;
  heightAssumption: string;
  isUncertain: boolean;
  source: string;
}

export interface Landmark {
  id: string;
  name: string;
  category: string;
  description: string;
  coordinates: Coordinate;
  nearestNodeId: string;
  snapDistanceMetres: number;
  snappedCoordinates: Coordinate;
}

export interface PilotGeoData {
  buildings: GeoJSON.FeatureCollection;
  canopy: GeoJSON.FeatureCollection;
  trees: GeoJSON.FeatureCollection;
  landmarks: Landmark[];
}

export interface CampusRouteBundle {
  campusId: string;
  dataRevision: number;
  manifest: CampusManifest;
  network: RouteNetwork;
  shadeRecords: ShadeRecord[];
  geoData?: PilotGeoData;
}

export interface CampusManifest {
  schemaVersion: number;
  campusId: string;
  dataRevision: number;
  publishedAt?: string;
  campus?: {
    name: string;
    address: string;
    timezone: string;
    center?: Coordinate;
    bounds?: [Coordinate, Coordinate];
  };
  files: { network: string; shade?: string };
  sources?: Array<{
    sourceId: string;
    type: string;
    name: string;
    license: string;
    attribution: string;
    url?: string;
  }>;
  limitations?: string[];
}

export interface DataSourceReference {
  id: string;
  type: 'osm' | 'field-survey' | 'institution' | 'other';
  label: string;
  url?: string;
  licence: string;
  attribution: string;
}
