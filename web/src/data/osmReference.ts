import osmXml from '../../../data/osm/vit-bibwewadi-2026-11-17.osm?raw';
import osmMetadata from '../../../data/osm/vit-bibwewadi-2026-11-17.metadata.json';
import campusIndex from '../../../data/campuses/index.json';
import type { CampusEntry, Coordinate, DataSourceReference } from './types';

export interface ReferenceProperties {
  osmId: string;
  elementType: 'node' | 'way';
  name: string;
  kind: string;
  tags: Record<string, string>;
  verification: 'unverified';
  routeable: false;
}

export type ReferenceGeometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'Polygon'; coordinates: Coordinate[][] };

export interface ReferenceFeature {
  type: 'Feature';
  id: string;
  properties: ReferenceProperties;
  geometry: ReferenceGeometry;
}

export interface ReferenceCollection {
  type: 'FeatureCollection';
  features: ReferenceFeature[];
}

export interface OSMReferenceData {
  campus: CampusEntry;
  features: ReferenceCollection;
  boundary: Coordinate[];
  extractedAt: string;
  bbox: { west: number; south: number; east: number; north: number };
  summary: { nodes: number; ways: number; relations: number };
  source: DataSourceReference;
}

interface OSMNode {
  id: string;
  coordinate: Coordinate;
  tags: Record<string, string>;
}

interface OSMWay {
  id: string;
  refs: string[];
  tags: Record<string, string>;
}

const campus = campusIndex.campuses.find((entry) => entry.campusId === 'in-mh-pune-vit-bibwewadi');
if (!campus) throw new Error('The VIT Bibwewadi campus is missing from the local campus registry.');

const source: DataSourceReference = {
  id: 'osm-vit-bibwewadi-2026-11-17',
  type: 'osm',
  label: 'OpenStreetMap snapshot · 17 Nov 2026',
  url: osmMetadata.attributionUrl,
  licence: osmMetadata.license,
  attribution: osmMetadata.attribution,
};

function readTags(element: Element): Record<string, string> {
  return Object.fromEntries(
    Array.from(element.querySelectorAll(':scope > tag')).map((tag) => [
      tag.getAttribute('k') ?? '',
      tag.getAttribute('v') ?? '',
    ]),
  );
}

function isClosed(refs: string[]): boolean {
  return refs.length > 3 && refs[0] === refs[refs.length - 1];
}

function featureKind(tags: Record<string, string>): string | null {
  if (tags.amenity === 'college') return 'campus-boundary';
  if (tags.building) return 'building';
  if (tags.highway === 'steps') return 'steps';
  if (tags.highway === 'footway' || tags.highway === 'path' || tags.highway === 'pedestrian') return 'walkway';
  if (tags.highway === 'service') return 'service-road';
  if (tags.highway === 'residential') return 'residential-road';
  if (tags.highway === 'crossing') return 'crossing';
  if (tags.barrier === 'gate') return 'gate';
  if (tags.natural === 'tree') return 'tree';
  if (tags.leisure === 'park' || tags.leisure === 'pitch' || tags.landuse === 'recreation_ground') return 'green-space';
  if (tags.amenity === 'cafe' || tags.amenity === 'library' || tags.name) return 'place';
  return null;
}

function parseSnapshot(xml: string): { features: ReferenceCollection; boundary: Coordinate[]; summary: OSMReferenceData['summary'] } {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('The local OSM reference snapshot could not be parsed.');

  const nodes = new Map<string, OSMNode>();
  const nodeElements = Array.from(document.querySelectorAll('osm > node'));
  for (const element of nodeElements) {
    const id = element.getAttribute('id');
    const lon = Number(element.getAttribute('lon'));
    const lat = Number(element.getAttribute('lat'));
    if (!id || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    nodes.set(id, { id, coordinate: [lon, lat], tags: readTags(element) });
  }

  const wayElements = Array.from(document.querySelectorAll('osm > way'));
  const ways: OSMWay[] = wayElements.map((element) => ({
    id: element.getAttribute('id') ?? '',
    refs: Array.from(element.querySelectorAll(':scope > nd')).map((nd) => nd.getAttribute('ref') ?? ''),
    tags: readTags(element),
  }));

  const features: ReferenceFeature[] = [];
  let boundary: Coordinate[] = [];
  for (const way of ways) {
    const kind = featureKind(way.tags);
    if (!kind) continue;
    const coordinates = way.refs.map((ref) => nodes.get(ref)?.coordinate).filter((coord): coord is Coordinate => Boolean(coord));
    if (coordinates.length < 2) continue;
    if (way.id === '213874316') boundary = coordinates;
    const closed = isClosed(way.refs) && coordinates.length >= 4;
    const polygon = closed && (kind === 'campus-boundary' || kind === 'building' || kind === 'green-space');
    features.push({
      type: 'Feature',
      id: `way/${way.id}`,
      properties: {
        osmId: `way/${way.id}`,
        elementType: 'way',
        name: way.tags.name ?? '',
        kind,
        tags: way.tags,
        verification: 'unverified',
        routeable: false,
      },
      geometry: polygon
        ? { type: 'Polygon', coordinates: [coordinates] }
        : { type: 'LineString', coordinates },
    });
  }

  for (const node of nodes.values()) {
    const kind = featureKind(node.tags);
    if (!kind || !['tree', 'crossing', 'gate', 'place'].includes(kind)) continue;
    features.push({
      type: 'Feature',
      id: `node/${node.id}`,
      properties: {
        osmId: `node/${node.id}`,
        elementType: 'node',
        name: node.tags.name ?? '',
        kind,
        tags: node.tags,
        verification: 'unverified',
        routeable: false,
      },
      geometry: { type: 'Point', coordinates: node.coordinate },
    });
  }

  if (boundary.length < 4) throw new Error('The OSM snapshot does not contain the expected VIT boundary reference.');
  return {
    features: { type: 'FeatureCollection', features },
    boundary,
    summary: {
      nodes: nodeElements.length,
      ways: wayElements.length,
      relations: document.querySelectorAll('osm > relation').length,
    },
  };
}

const parsed = parseSnapshot(osmXml);

export const vitReference: OSMReferenceData = {
  campus: campus as CampusEntry,
  features: parsed.features,
  boundary: parsed.boundary,
  extractedAt: osmMetadata.retrievedAtUtc,
  bbox: osmMetadata.bboxWgs84,
  summary: parsed.summary,
  source,
};

