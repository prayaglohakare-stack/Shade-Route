import type {
  CampusEntry,
  CampusManifest,
  CampusRouteBundle,
  DataSourceReference,
  Landmark,
  PilotGeoData,
  RouteNetwork,
  ShadeRecord,
} from './types';
import registryData from '../../../data/campuses/index.json';

export type RouteDataAvailability =
  | { status: 'ready'; bundle: CampusRouteBundle }
  | { status: 'pending-validation'; campusId: string; reason: string };

export interface CampusRepository {
  listCampuses(): CampusEntry[];
  loadRouteBundle(campusId: string): Promise<RouteDataAvailability>;
  listSources(campusId: string): DataSourceReference[];
}

const manifestFiles = import.meta.glob<CampusManifest>('../../../data/campuses/*/manifest.json', { import: 'default' });
const networkFiles = import.meta.glob<RouteNetwork>('../../../data/campuses/*/network.json', { import: 'default' });
const shadeFiles = import.meta.glob<{ records?: ShadeRecord[]; campusId?: string; networkRevision?: number }>(
  '../../../data/campuses/*/shade.json',
  { import: 'default' },
);
const buildingFiles = import.meta.glob<GeoJSON.FeatureCollection>(
  '../../../data/campuses/*/buildings.json',
  { import: 'default' },
);
const canopyFiles = import.meta.glob<GeoJSON.FeatureCollection>(
  '../../../data/campuses/*/canopy.json',
  { import: 'default' },
);
const treeFiles = import.meta.glob<GeoJSON.FeatureCollection>(
  '../../../data/campuses/*/trees.json',
  { import: 'default' },
);
const landmarkFiles = import.meta.glob<Landmark[]>(
  '../../../data/campuses/*/landmarks.json',
  { import: 'default' },
);

export const campusRepository: CampusRepository = {
  listCampuses(): CampusEntry[] {
    return (registryData.campuses as CampusEntry[]) || [];
  },

  async loadRouteBundle(campusId: string): Promise<RouteDataAvailability> {
    const campuses = this.listCampuses();
    const campus = campuses.find((c) => c.campusId === campusId);

    if (!campus) {
      return { status: 'pending-validation', campusId, reason: 'This campus is not listed in the registry.' };
    }

    if (campus.dataStatus === 'pending-validation') {
      return {
        status: 'pending-validation',
        campusId,
        reason: 'Pedestrian network and shade evidence are pending physical field validation.',
      };
    }

    const base = `../../../data/campuses/${campusId}/`;
    const loadManifest = manifestFiles[`${base}manifest.json`];
    const loadNetwork = networkFiles[`${base}network.json`];

    if (!loadManifest || !loadNetwork) {
      return {
        status: 'pending-validation',
        campusId,
        reason: 'Manifest or network file is not bundled for this pilot.',
      };
    }

    try {
      const [manifest, network] = await Promise.all([loadManifest(), loadNetwork()]);

      // Load shade records if declared
      let shadeRecords: ShadeRecord[] = [];
      if (manifest.files?.shade === 'shade.json') {
        const loadShade = shadeFiles[`${base}shade.json`];
        if (loadShade) {
          const shade = await loadShade();
          shadeRecords = shade.records || [];
        }
      }

      // Load auxiliary GeoJSON layers
      const geoData: PilotGeoData = {
        buildings: { type: 'FeatureCollection', features: [] },
        canopy: { type: 'FeatureCollection', features: [] },
        trees: { type: 'FeatureCollection', features: [] },
        landmarks: [],
      };

      const loadBuildings = buildingFiles[`${base}buildings.json`];
      const loadCanopy = canopyFiles[`${base}canopy.json`];
      const loadTrees = treeFiles[`${base}trees.json`];
      const loadLandmarks = landmarkFiles[`${base}landmarks.json`];

      const [bldgs, can, trs, lms] = await Promise.all([
        loadBuildings ? loadBuildings() : null,
        loadCanopy ? loadCanopy() : null,
        loadTrees ? loadTrees() : null,
        loadLandmarks ? loadLandmarks() : null,
      ]);

      if (bldgs) geoData.buildings = bldgs;
      if (can) geoData.canopy = can;
      if (trs) geoData.trees = trs;
      if (lms) geoData.landmarks = lms;

      return {
        status: 'ready',
        bundle: {
          campusId,
          dataRevision: network.dataRevision || 1,
          manifest,
          network,
          shadeRecords,
          geoData,
        },
      };
    } catch (err) {
      console.error('Error loading campus bundle:', err);
      return { status: 'pending-validation', campusId, reason: 'Failed to load bundle data.' };
    }
  },

  listSources(_campusId: string): DataSourceReference[] {
    return [
      {
        id: 'pmc-tree-census-2019',
        type: 'other',
        label: 'Pune Municipal Corporation Tree Census (2019)',
        url: 'https://data.opencity.in/dataset/pune-tree-census-2019',
        licence: 'Open Data Commons / Pune Smart City Civic Open Data',
        attribution: 'Pune Municipal Corporation & Open Data Pune',
      },
      {
        id: 'osm-bibwewadi-2026',
        type: 'osm',
        label: 'OpenStreetMap Bounded Extract',
        url: 'https://www.openstreetmap.org/copyright',
        licence: 'Open Database License (ODbL) 1.0',
        attribution: '© OpenStreetMap contributors',
      },
    ];
  },
};
