import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuildingProperties, Coordinate, Landmark, PilotGeoData, RouteNetwork } from '../data/types';
import type { ComputedRoute, RouteMode } from '../routing/routeEngine';
import { calculateSolarPosition, projectBuildingShadowPolygon, type SolarPreset } from '../routing/solarEngine';

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

interface CampusMapProps {
  network: RouteNetwork | null;
  geoData?: PilotGeoData;
  selectionMode: MapSelectionMode;
  origin: SelectedMapPoint | null;
  destination: SelectedMapPoint | null;
  activeRoute: ComputedRoute | null;
  alternativeRoute: ComputedRoute | null;
  activeMode: RouteMode;
  solarTime: SolarPreset;
  departureHour: number;
  departureMinute: number;
  layers: MapLayerVisibility;
  onMapPointSelected: (point: SelectedMapPoint) => void;
  onLandmarkSelected?: (landmark: Landmark) => void;
  onFeatureSelected?: (info: { title: string; category: string; details: Record<string, string | number> }) => void;
}

function pinIcon(label: 'A' | 'B', color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-route-pin',
    html: `<div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid #ffffff;">
      <span style="transform: rotate(45deg); color: #ffffff; font-weight: 800; font-size: 14px; font-family: ui-sans-serif, system-ui, sans-serif;">${label}</span>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function landmarkIcon(): L.DivIcon {
  return L.divIcon({
    className: 'landmark-pin',
    html: `<div style="background-color: #065f46; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25); border: 2px solid #ffffff;">
      <span style="color: #ffffff; font-size: 11px;">★</span>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function CampusMap({
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
  layers,
  onMapPointSelected,
  onLandmarkSelected,
  onFeatureSelected,
}: CampusMapProps) {
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
  const onPickRef = useRef(onMapPointSelected);
  const onLandmarkRef = useRef(onLandmarkSelected);
  const onFeatureRef = useRef(onFeatureSelected);

  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);
  useEffect(() => { onPickRef.current = onMapPointSelected; }, [onMapPointSelected]);
  useEffect(() => { onLandmarkRef.current = onLandmarkSelected; }, [onLandmarkSelected]);
  useEffect(() => { onFeatureRef.current = onFeatureSelected; }, [onFeatureSelected]);

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [18.4645, 73.8672],
      zoom: 16.5,
      zoomControl: false,
      preferCanvas: true,
      minZoom: 14,
      maxZoom: 20,
    });
    mapRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://treecensus.punecorporation.org/" target="_blank" rel="noreferrer">PMC Tree Census</a>')
      .addTo(map);

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    });
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Create Layer Groups in exact z-order:
    // 1. Building Shadows (bottom ground layer)
    buildingShadowsLayerRef.current = L.layerGroup().addTo(map);
    // 2. Buildings 3D footprint blocks
    buildingsLayerRef.current = L.geoJSON(undefined, {
      style: {
        color: '#b0a996',
        weight: 1.2,
        fillColor: '#ebe6d7',
        fillOpacity: 0.9,
      },
    }).addTo(map);
    // 3. Street Network
    networkLayerRef.current = L.geoJSON(undefined, {
      style: (feature) => {
        const isCovered = feature?.properties?.pathClass === 'covered-walkway';
        return isCovered
          ? { color: '#059669', weight: 4.5, opacity: 0.95, dashArray: '4 4' }
          : { color: '#94a3b8', weight: 2.5, opacity: 0.65 };
      },
    }).addTo(map);
    // 4. Tree Canopy Crowns
    canopyLayerRef.current = L.geoJSON(undefined, {
      style: {
        color: '#15803d',
        weight: 1.2,
        fillColor: '#22c55e',
        fillOpacity: 0.35,
      },
    }).addTo(map);
    // 5. Individual Tree Points
    treesLayerRef.current = L.geoJSON(undefined, {
      pointToLayer: (_feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 3.5,
          color: '#14532d',
          weight: 1.2,
          fillColor: '#16a34a',
          fillOpacity: 0.9,
        });
      },
    }).addTo(map);
    // 6. Uncertainty / Gaps Layer
    uncertaintyLayerRef.current = L.layerGroup().addTo(map);
    // 7. Landmarks & Routes
    landmarksLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      const mode = selectionModeRef.current;
      if (!mode) return;

      const clickCoord: Coordinate = [event.latlng.lng, event.latlng.lat];
      onPickRef.current({
        coordinates: clickCoord,
        label: mode === 'origin' ? 'Selected Start' : 'Selected Destination',
        source: 'user-map-selection',
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Load Vector Geometry Layers when geoData / network changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoData) return;

    // Load Buildings with Height Confidence Inspector
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
              category: 'Building · Height Confidence',
              details: {
                'OSM Way ID': props.osmId,
                'Estimated Height': `${props.estimatedHeightM} m`,
                'Height Confidence': props.confidenceLabel,
                'Confidence Tier': props.heightConfidenceTier,
                'Footprint Area': `${props.footprintAreaM2} m²`,
                'Height Assumption': props.heightAssumption,
                'Ground Verification': props.isUncertain ? '⚠️ Model-Estimated (Unverified)' : '✓ Verified',
              },
            });
          });
        });
      }
    }

    // Load Canopy Polygons
    if (canopyLayerRef.current) {
      canopyLayerRef.current.clearLayers();
      if (geoData.canopy?.features?.length) {
        canopyLayerRef.current.addData(geoData.canopy);
        canopyLayerRef.current.eachLayer((layer) => {
          const feature = (layer as any).feature;
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onFeatureRef.current?.({
              title: `${feature.properties.commonName} Canopy Crown`,
              category: 'Tree Canopy · Natural Cover',
              details: {
                'Tree ID': feature.properties.treeId,
                'Crown Diameter': `${feature.properties.canopyDiaM} m`,
                'Crown Radius': `${feature.properties.radiusM} m`,
                Condition: feature.properties.condition,
                Source: 'PMC Tree Census 2019 (Derived Crown)',
              },
            });
          });
        });
      }
    }

    // Load Individual Tree Points
    if (treesLayerRef.current) {
      treesLayerRef.current.clearLayers();
      if (geoData.trees?.features?.length) {
        treesLayerRef.current.addData(geoData.trees);
        treesLayerRef.current.eachLayer((layer) => {
          const feature = (layer as any).feature;
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onFeatureRef.current?.({
              title: feature.properties.commonName || 'Tree',
              category: 'Municipal Tree Record',
              details: {
                'Census ID': feature.properties.treeId,
                'Botanical Name': feature.properties.botanicalName || 'Not recorded',
                'Height': `${feature.properties.heightM} m`,
                'Canopy Diameter': `${feature.properties.canopyDiaM} m`,
                Condition: feature.properties.condition,
                Ownership: feature.properties.ownership,
                Source: 'Pune Municipal Corporation 2019 Census',
              },
            });
          });
        });
      }
    }

    // Load Walkable Network
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

    // Load Landmarks
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

  // 3. Dynamic Building Shadows Projection based on departure hour/min
  useEffect(() => {
    const shadowGroup = buildingShadowsLayerRef.current;
    if (!shadowGroup || !geoData || !layers.buildingShadows) {
      shadowGroup?.clearLayers();
      return;
    }

    shadowGroup.clearLayers();
    const solarPos = calculateSolarPosition(departureHour, departureMinute);

    const bldgFeatures = geoData.buildings?.features || [];
    for (const bldg of bldgFeatures) {
      if (bldg.geometry.type !== 'Polygon') continue;
      const footprintCoords = bldg.geometry.coordinates[0] as [number, number][];
      const heightM = Number(bldg.properties?.estimatedHeightM) || 8.0;

      // Project 2D ground shadow polygon
      const shadowHull = projectBuildingShadowPolygon(footprintCoords, heightM, solarPos);
      const latLngs = shadowHull.map(([lon, lat]) => [lat, lon] as [number, number]);

      L.polygon(latLngs, {
        color: 'transparent',
        weight: 0,
        fillColor: '#1e293b',
        fillOpacity: 0.28,
        interactive: false,
      }).addTo(shadowGroup);
    }
  }, [geoData, departureHour, departureMinute, layers.buildingShadows]);

  // 4. Uncertainty Highlights
  useEffect(() => {
    const uncertGroup = uncertaintyLayerRef.current;
    if (!uncertGroup) return;
    uncertGroup.clearLayers();

    if (!layers.uncertainty || !geoData) return;

    // Highlight buildings with Tier 4/5 height uncertainty
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
    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.setStyle({ opacity: layers.buildings ? 1 : 0, fillOpacity: layers.buildings ? 0.9 : 0 });
    }
    if (networkLayerRef.current) {
      networkLayerRef.current.setStyle({ opacity: layers.network ? 0.65 : 0 });
    }
    if (canopyLayerRef.current) {
      canopyLayerRef.current.setStyle({ opacity: layers.canopy ? 1 : 0, fillOpacity: layers.canopy ? 0.35 : 0 });
    }
    if (treesLayerRef.current) {
      treesLayerRef.current.setStyle({ opacity: layers.trees ? 1 : 0, fillOpacity: layers.trees ? 0.9 : 0 });
    }
    if (buildingShadowsLayerRef.current && !layers.buildingShadows) {
      buildingShadowsLayerRef.current.clearLayers();
    }
  }, [layers]);

  // 6. Render Active Route & Alternative Route
  useEffect(() => {
    const routeGroup = routesLayerRef.current;
    if (!routeGroup) return;
    routeGroup.clearLayers();

    // Alternative Route (dashed background)
    if (alternativeRoute && alternativeRoute.coordinates.length >= 2 && !alternativeRoute.isCoincidentWithShortest) {
      const altLatLngs = alternativeRoute.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
      L.polyline(altLatLngs, {
        color: '#64748b',
        weight: 6,
        opacity: 0.45,
        dashArray: '7 7',
        lineCap: 'round',
      }).addTo(routeGroup);
    }

    // Active Route
    if (activeRoute && activeRoute.coordinates.length >= 2) {
      const latLngs = activeRoute.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);

      // Route casing
      L.polyline(latLngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);

      const routeColor = activeMode === 'more-canopy'
        ? '#059669' // Emerald cooler way
        : activeMode === 'balanced'
        ? '#0284c7' // Blue balanced
        : '#f97316'; // Orange shortest

      L.polyline(latLngs, {
        color: routeColor,
        weight: 5.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeGroup);

      const bounds = L.latLngBounds(latLngs);
      mapRef.current?.fitBounds(bounds, { padding: [65, 65], maxZoom: 18.5 });
    }
  }, [activeRoute, alternativeRoute, activeMode]);

  // 7. Render Origin & Destination Markers + Snap Lines
  useEffect(() => {
    const markerGroup = markersLayerRef.current;
    if (!markerGroup) return;
    markerGroup.clearLayers();

    if (origin) {
      const originLatLng: [number, number] = [origin.coordinates[1], origin.coordinates[0]];
      L.marker(originLatLng, {
        icon: pinIcon('A', '#059669'),
        title: origin.label,
        zIndexOffset: 1000,
      }).addTo(markerGroup);

      if (origin.snappedCoordinates) {
        const snappedLatLng: [number, number] = [origin.snappedCoordinates[1], origin.snappedCoordinates[0]];
        L.polyline([originLatLng, snappedLatLng], {
          color: '#059669',
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
        zIndexOffset: 1000,
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
    <div
      className={`campus-map-container ${selectionMode ? 'is-picking-point' : ''}`}
      ref={containerRef}
      aria-label="Interactive pedestrian map for ShadeRoute"
    />
  );
}
