import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingProperties, Coordinate, Landmark, PilotGeoData, RouteNetwork } from '../data/types';
import type { ComputedRoute, RouteMode } from '../routing/routeEngine';
import {
  calculateSolarPosition,
  projectBuildingShadowPolygon,
  projectTreeCrownShadow,
  type SolarPreset,
} from '../routing/solarEngine';

export type MapSelectionMode = 'origin' | 'destination' | null;

export interface SelectedMapPoint {
  coordinates: Coordinate;
  snappedCoordinates?: Coordinate;
  nodeId?: string;
  label: string;
  source: 'user-map-selection' | 'landmark-preset';
  snapDistanceMetres?: number;
}

export interface MapLayerVisibility {
  buildingShadows: boolean;
  canopy: boolean;
  trees: boolean;
  buildings: boolean;
  network: boolean;
  uncertainty: boolean;
}

export interface MapViewProps {
  network: RouteNetwork | null;
  geoData?: PilotGeoData;
  selectionMode: MapSelectionMode;
  origin: SelectedMapPoint | null;
  destination: SelectedMapPoint | null;
  activeRoute: ComputedRoute | null;
  alternativeRoute: ComputedRoute | null;
  activeMode: RouteMode;
  solarTime?: SolarPreset;
  departureHour: number;
  departureMinute: number;
  dateInput?: Date | string;
  layers: MapLayerVisibility;
  onMapPointSelected: (point: SelectedMapPoint) => void;
  onLandmarkSelected?: (landmark: Landmark) => void;
  onFeatureSelected?: (info: { title: string; category: string; details: Record<string, string | number> }) => void;
}

function pinIcon(label: 'A' | 'B', color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-route-pin',
    html: `<div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); pointer-events: none;">
      <div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;">
        <span style="transform: rotate(45deg); color: #ffffff; font-weight: 800; font-size: 15px; font-family: 'Inter', system-ui, sans-serif;">${label}</span>
      </div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
}

function landmarkIcon(): L.DivIcon {
  return L.divIcon({
    className: 'landmark-pin',
    html: `<div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="background-color: #163D32; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25); border: 2px solid #ffffff;">
        <span style="color: #A8C99A; font-size: 12px; line-height: 1;">★</span>
      </div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function MapView({
  network,
  geoData,
  selectionMode,
  origin,
  destination,
  activeRoute,
  alternativeRoute,
  activeMode,
  departureHour,
  departureMinute,
  dateInput = '2026-11-18',
  layers,
  onMapPointSelected,
  onLandmarkSelected,
  onFeatureSelected,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const buildingShadowsLayerRef = useRef<L.LayerGroup | null>(null);
  const buildingsLayerRef = useRef<L.GeoJSON | null>(null);
  const networkLayerRef = useRef<L.GeoJSON | null>(null);
  const canopyLayerRef = useRef<L.GeoJSON | null>(null);
  const treesLayerRef = useRef<L.GeoJSON | null>(null);
  const uncertaintyLayerRef = useRef<L.LayerGroup | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  const onPointRef = useRef(onMapPointSelected);
  onPointRef.current = onMapPointSelected;

  const onLandmarkRef = useRef(onLandmarkSelected);
  onLandmarkRef.current = onLandmarkSelected;

  const onFeatureRef = useRef(onFeatureSelected);
  onFeatureRef.current = onFeatureSelected;

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Center on Bibwewadi / Chintamani Nagar pilot area [18.464, 73.867]
    const map = L.map(containerRef.current, {
      center: [18.4645, 73.8675],
      zoom: 16.5,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    tileLayerRef.current = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19,
      },
    ).addTo(map);

    // Layer initialization
    buildingShadowsLayerRef.current = L.layerGroup();
    if (layers.buildingShadows) buildingShadowsLayerRef.current.addTo(map);

    buildingsLayerRef.current = L.geoJSON(undefined, {
      style: (feature) => {
        const isUncertain = feature?.properties?.isUncertain;
        return {
          color: isUncertain ? '#d97706' : '#285D49',
          weight: 1.2,
          fillColor: isUncertain ? '#fef3c7' : '#F5F6F1',
          fillOpacity: 0.9,
        };
      },
    });
    if (layers.buildings) buildingsLayerRef.current.addTo(map);

    networkLayerRef.current = L.geoJSON(undefined, {
      style: (feature) => {
        const isCovered = feature?.properties?.pathClass === 'covered-walkway';
        return {
          color: isCovered ? '#059669' : '#94a3b8',
          weight: isCovered ? 3.5 : 2.0,
          dashArray: isCovered ? '4 4' : undefined,
          opacity: 0.65,
        };
      },
    });
    if (layers.network) networkLayerRef.current.addTo(map);

    canopyLayerRef.current = L.geoJSON(undefined, {
      style: {
        color: '#163D32',
        weight: 1,
        fillColor: '#A8C99A',
        fillOpacity: 0.35,
      },
    });
    if (layers.canopy) canopyLayerRef.current.addTo(map);

    treesLayerRef.current = L.geoJSON(undefined, {
      pointToLayer: (_feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 3.5,
          color: '#163D32',
          weight: 1.2,
          fillColor: '#A8C99A',
          fillOpacity: 0.9,
        });
      },
    });
    if (layers.trees) treesLayerRef.current.addTo(map);

    uncertaintyLayerRef.current = L.layerGroup();
    if (layers.uncertainty) uncertaintyLayerRef.current.addTo(map);

    landmarksLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      const mode = selectionModeRef.current;
      if (mode) {
        onPointRef.current({
          coordinates: [e.latlng.lng, e.latlng.lat],
          label: `Selected ${mode === 'origin' ? 'Start' : 'Destination'} (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`,
          source: 'user-map-selection',
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Load Vector Geometry Layers when geoData / network changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoData) return;

    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.clearLayers();
      if (geoData.buildings?.features?.length) {
        buildingsLayerRef.current.addData(geoData.buildings);
        buildingsLayerRef.current.eachLayer((layer) => {
          const feature = (layer as any).feature;
          const props = feature.properties as BuildingProperties;
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onFeatureRef.current?.({
              title: props.name || 'Building Footprint',
              category: 'Building · Height Model',
              details: {
                'OSM Way ID': props.osmId,
                'Estimated Height': `${props.estimatedHeightM} m`,
                'Height Confidence': props.confidenceLabel,
                'Confidence Tier': props.heightConfidenceTier,
                'Footprint Area': `${props.footprintAreaM2} m²`,
                'Height Assumption': props.heightAssumption,
                'Validation Status': 'Unverified (Modelled)',
              },
            });
          });
        });
      }
    }

    if (canopyLayerRef.current) {
      canopyLayerRef.current.clearLayers();
      if (geoData.canopy?.features?.length) {
        canopyLayerRef.current.addData(geoData.canopy);
      }
    }

    if (treesLayerRef.current) {
      treesLayerRef.current.clearLayers();
      if (geoData.trees?.features?.length) {
        treesLayerRef.current.addData(geoData.trees);
      }
    }

    if (networkLayerRef.current && network) {
      networkLayerRef.current.clearLayers();
      const networkGeoJson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: network.edges.map((e) => ({
          type: 'Feature',
          id: e.edgeId,
          geometry: {
            type: 'LineString',
            coordinates: e.coordinates,
          },
          properties: {
            edgeId: e.edgeId,
            pathClass: e.pathClass,
            accessStatus: e.accessStatus,
            verificationStatus: e.verificationStatus,
            sourceId: e.sourceRef.sourceId,
          },
        })),
      };
      networkLayerRef.current.addData(networkGeoJson);
    }

    if (landmarksLayerRef.current) {
      landmarksLayerRef.current.clearLayers();
      for (const lm of geoData.landmarks || []) {
        const marker = L.marker([lm.coordinates[1], lm.coordinates[0]], {
          icon: landmarkIcon(),
          title: lm.name,
        });
        marker.bindTooltip(lm.name, { direction: 'top', offset: [0, -10], className: 'landmark-tooltip' });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onLandmarkRef.current?.(lm);
          onFeatureRef.current?.({
            title: lm.name,
            category: lm.category,
            details: {
              Description: lm.description,
              'Snapped Node': lm.nearestNodeId,
              'Snap Distance': `${lm.snapDistanceMetres} m`,
            },
          });
        });
        marker.addTo(landmarksLayerRef.current);
      }
    }
  }, [geoData, network]);

  // 3. Dynamic Building and Displaced Tree Crown Shadows Projection
  useEffect(() => {
    const shadowGroup = buildingShadowsLayerRef.current;
    if (!shadowGroup || !geoData || !layers.buildingShadows) {
      shadowGroup?.clearLayers();
      return;
    }

    shadowGroup.clearLayers();
    const solarPos = calculateSolarPosition(departureHour, departureMinute, dateInput);

    // 1. Building Shadow Polygons: translucent grey, no outlines
    const bldgFeatures = geoData.buildings?.features || [];
    for (const bldg of bldgFeatures) {
      if (bldg.geometry.type !== 'Polygon') continue;
      const footprintCoords = bldg.geometry.coordinates[0] as [number, number][];
      const heightM = Number(bldg.properties?.estimatedHeightM) || 8.0;

      const shadowHull = projectBuildingShadowPolygon(footprintCoords, heightM, solarPos);
      const latLngs = shadowHull.map(([lon, lat]) => [lat, lon] as [number, number]);

      L.polygon(latLngs, {
        stroke: false,
        color: 'transparent',
        weight: 0,
        fillColor: '#334155',
        fillOpacity: 0.28,
        interactive: false,
      }).addTo(shadowGroup);
    }

    // 2. Displaced Tree Crown Shadows: translucent grey, no outlines
    const treeFeatures = geoData.trees?.features || [];
    for (const tree of treeFeatures) {
      if (tree.geometry.type !== 'Point') continue;
      const coords = tree.geometry.coordinates as [number, number];
      const props = tree.properties as Record<string, any> | null;
      const radiusM = Number(props?.radiusM) || (Number(props?.canopyDiaM) ? Number(props?.canopyDiaM) / 2 : 1.75);
      const heightM = Number(props?.heightM) || 5.0;

      const crownShadow = projectTreeCrownShadow(coords, radiusM, heightM, solarPos);
      L.circle([crownShadow.center[1], crownShadow.center[0]], {
        radius: crownShadow.radiusM,
        stroke: false,
        color: 'transparent',
        weight: 0,
        fillColor: '#334155',
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(shadowGroup);
    }
  }, [geoData, departureHour, departureMinute, dateInput, layers.buildingShadows]);

  // 4. Uncertainty Highlights
  useEffect(() => {
    const uncertGroup = uncertaintyLayerRef.current;
    if (!uncertGroup) return;
    uncertGroup.clearLayers();

    if (!layers.uncertainty || !geoData) return;

    for (const bldg of geoData.buildings?.features || []) {
      if (bldg.properties?.isUncertain && bldg.geometry.type === 'Polygon') {
        const latLngs = (bldg.geometry.coordinates[0] as [number, number][]).map(([lon, lat]) => [lat, lon] as [number, number]);
        L.polygon(latLngs, {
          color: '#f59e0b',
          weight: 1.5,
          dashArray: '3 3',
          fillColor: '#fef3c7',
          fillOpacity: 0.25,
          interactive: false,
        }).addTo(uncertGroup);
      }
    }
  }, [geoData, layers.uncertainty]);

  // 5. Toggle Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncLayer = (group: L.Layer | null, isVisible: boolean) => {
      if (!group) return;
      if (isVisible && !map.hasLayer(group)) {
        map.addLayer(group);
      } else if (!isVisible && map.hasLayer(group)) {
        map.removeLayer(group);
      }
    };

    syncLayer(buildingShadowsLayerRef.current, layers.buildingShadows);
    syncLayer(buildingsLayerRef.current, layers.buildings);
    syncLayer(networkLayerRef.current, layers.network);
    syncLayer(canopyLayerRef.current, layers.canopy);
    syncLayer(treesLayerRef.current, layers.trees);
    syncLayer(uncertaintyLayerRef.current, layers.uncertainty);
  }, [layers]);

  // 6. Render Active Route & Alternative Route
  useEffect(() => {
    const routeGroup = routesLayerRef.current;
    if (!routeGroup) return;
    routeGroup.clearLayers();

    // Alternative Route: distinct colours matching route cards with white casing
    if (alternativeRoute && alternativeRoute.coordinates.length >= 2 && !alternativeRoute.isCoincidentWithShortest) {
      const altLatLngs = alternativeRoute.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);

      // White casing for alternative route
      L.polyline(altLatLngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);

      const altColor = alternativeRoute.mode === 'shortest'
        ? '#f97316'
        : alternativeRoute.mode === 'balanced'
        ? '#285D49'
        : '#163D32';

      L.polyline(altLatLngs, {
        color: altColor,
        weight: 4.5,
        opacity: 0.9,
        dashArray: '6 6',
        lineCap: 'round',
      }).addTo(routeGroup);
    }

    // Active Route: thick line with white casing so it stands out on any layer
    if (activeRoute && activeRoute.coordinates.length >= 2) {
      const latLngs = activeRoute.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);

      // Thick white casing
      L.polyline(latLngs, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);

      const routeColor = activeMode === 'more-canopy'
        ? '#163D32' // Deep green cooler way
        : activeMode === 'balanced'
        ? '#285D49' // Forest green balanced
        : '#f97316'; // Orange shortest

      L.polyline(latLngs, {
        color: routeColor,
        weight: 5.5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);

      const bounds = L.latLngBounds(latLngs);
      mapRef.current?.fitBounds(bounds, { padding: [65, 65], maxZoom: 18.5 });
    }
  }, [activeRoute, alternativeRoute, activeMode]);

  // 7. Render Origin & Destination Markers + Snap Lines (always above other layers)
  useEffect(() => {
    const markerGroup = markersLayerRef.current;
    if (!markerGroup) return;
    markerGroup.clearLayers();

    if (origin) {
      const originLatLng: [number, number] = [origin.coordinates[1], origin.coordinates[0]];
      L.marker(originLatLng, {
        icon: pinIcon('A', '#163D32'),
        title: origin.label,
        zIndexOffset: 2000,
      }).addTo(markerGroup);

      if (origin.snappedCoordinates) {
        const snappedLatLng: [number, number] = [origin.snappedCoordinates[1], origin.snappedCoordinates[0]];
        L.polyline([originLatLng, snappedLatLng], {
          color: '#163D32',
          weight: 2,
          dashArray: '3 3',
        }).addTo(markerGroup);
      }
    }

    if (destination) {
      const destLatLng: [number, number] = [destination.coordinates[1], destination.coordinates[0]];
      L.marker(destLatLng, {
        icon: pinIcon('B', '#e11d48'),
        title: destination.label,
        zIndexOffset: 2000,
      }).addTo(markerGroup);

      if (destination.snappedCoordinates) {
        const snappedLatLng: [number, number] = [destination.snappedCoordinates[1], destination.snappedCoordinates[0]];
        L.polyline([destLatLng, snappedLatLng], {
          color: '#e11d48',
          weight: 2,
          dashArray: '3 3',
        }).addTo(markerGroup);
      }
    }
  }, [origin, destination]);

  return (
    <div className="map-view-wrapper">
      <div ref={containerRef} className="map-full-bleed" aria-label="Interactive pilot map" />
    </div>
  );
}

// Re-export as CampusMap for backward compatibility
export const CampusMap = MapView;
