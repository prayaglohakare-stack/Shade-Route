import { useEffect, useMemo, useState } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { DemoTripsModal } from './components/DemoTripsModal';
import {
  MapView,
  type MapLayerVisibility,
  type MapSelectionMode,
  type SelectedMapPoint,
} from './components/MapView';
import { PlannerPanel } from './components/PlannerPanel';
import { campusRepository, type RouteDataAvailability } from './data/campusRepository';
import type { DemoTrip } from './data/demoTrips';
import type { Landmark, PilotGeoData, RouteNetwork, ShadeRecord } from './data/types';
import {
  calculateAllRoutes,
  snapCoordinateToNetwork,
  type ComputedRoute,
  type RouteComparisonResult,
  type RouteMode,
} from './routing/routeEngine';
import './styles.css';

export type AppView = 'explore' | 'routes' | 'about';

export default function App() {
  const campuses = useMemo(() => campusRepository.listCampuses(), []);
  const defaultCampusId = campuses.find((c) => c.dataStatus === 'published')?.campusId || campuses[0]?.campusId;
  const [selectedCampusId] = useState<string>(defaultCampusId);
  const [availability, setAvailability] = useState<RouteDataAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active view: Explore, Routes, About
  const [activeView, setActiveView] = useState<AppView>('routes');
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [activeDemoTrip, setActiveDemoTrip] = useState<DemoTrip | null>(null);

  // Mobile Bottom Sheet snap points: peek (80px), half (45%), full (85%)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('half');

  // Selection states
  const [selectionMode, setSelectionMode] = useState<MapSelectionMode>(null);
  const [origin, setOrigin] = useState<SelectedMapPoint | null>(null);
  const [destination, setDestination] = useState<SelectedMapPoint | null>(null);
  const [activeMode, setActiveMode] = useState<RouteMode>('more-canopy');

  // Departure Time & Date states
  const [departureHour, setDepartureHour] = useState<number>(12);
  const [departureMinute, setDepartureMinute] = useState<number>(30);
  const [activeDate, setActiveDate] = useState<string>('2026-11-18');

  // Map Layer toggles
  const [layers, setLayers] = useState<MapLayerVisibility>({
    buildingShadows: true,
    canopy: false,
    trees: false,
    buildings: false,
    network: true,
    uncertainty: false,
  });

  // Feature inspector
  const [featureDetails, setFeatureDetails] = useState<{
    title: string;
    category: string;
    details: Record<string, string | number>;
  } | null>(null);

  // Computed routes
  const [routeResult, setRouteResult] = useState<RouteComparisonResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Fast first-paint load of campus bundle (lazy loading large canopy/trees layers)
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    campusRepository.loadRouteBundle(selectedCampusId, { lazyLayers: true }).then((result) => {
      if (!active) return;
      setAvailability(result);
      setIsLoading(false);

      if (result.status === 'ready' && result.bundle.geoData?.landmarks?.length) {
        const lms = result.bundle.geoData.landmarks;
        const defaultOriginLm = lms.find((l) => l.id === 'chintamani-garden') || lms[0];
        const defaultDestLm = lms.find((l) => l.id === 'vit-gate-access') || lms[1];

        if (defaultOriginLm && defaultDestLm) {
          setOrigin({
            coordinates: defaultOriginLm.coordinates,
            snappedCoordinates: defaultOriginLm.snappedCoordinates,
            nodeId: defaultOriginLm.nearestNodeId,
            label: defaultOriginLm.name,
            source: 'landmark-preset',
            snapDistanceMetres: defaultOriginLm.snapDistanceMetres,
          });
          setDestination({
            coordinates: defaultDestLm.coordinates,
            snappedCoordinates: defaultDestLm.snappedCoordinates,
            nodeId: defaultDestLm.nearestNodeId,
            label: defaultDestLm.name,
            source: 'landmark-preset',
            snapDistanceMetres: defaultDestLm.snapDistanceMetres,
          });
        }
      }

      // Background load canopy & trees for the map
      if (result.status === 'ready') {
        Promise.all([
          campusRepository.loadCanopy(selectedCampusId),
          campusRepository.loadTrees(selectedCampusId),
        ]).then(([can, trs]) => {
          if (!active) return;
          setAvailability((prev) => {
            if (!prev || prev.status !== 'ready') return prev;
            return {
              ...prev,
              bundle: {
                ...prev.bundle,
                geoData: {
                  ...prev.bundle.geoData,
                  canopy: can || prev.bundle.geoData?.canopy || { type: 'FeatureCollection', features: [] },
                  trees: trs || prev.bundle.geoData?.trees || { type: 'FeatureCollection', features: [] },
                  buildings: prev.bundle.geoData?.buildings || { type: 'FeatureCollection', features: [] },
                  landmarks: prev.bundle.geoData?.landmarks || [],
                },
              },
            };
          });
        });
      }
    });

    return () => {
      active = false;
    };
  }, [selectedCampusId]);

  // Recalculate routes whenever endpoints, departure time, or season date changes
  useEffect(() => {
    if (!availability || availability.status !== 'ready') {
      setRouteResult(null);
      setRouteError(null);
      return;
    }

    if (!origin?.nodeId || !destination?.nodeId) {
      setRouteResult(null);
      setRouteError(null);
      return;
    }

    const network: RouteNetwork = availability.bundle.network;
    const shadeRecords: ShadeRecord[] = availability.bundle.shadeRecords;

    const outcome = calculateAllRoutes(
      network,
      origin.nodeId,
      destination.nodeId,
      shadeRecords,
      departureHour,
      departureMinute,
      undefined,
      activeDate,
    );

    if (outcome.ok) {
      setRouteResult(outcome.routes);
      setRouteError(null);
    } else {
      setRouteResult(null);
      setRouteError(outcome.error.message);
    }
  }, [availability, origin, destination, departureHour, departureMinute, activeDate]);

  const activeRoute: ComputedRoute | null = useMemo(() => {
    if (!routeResult) return null;
    return routeResult[activeMode === 'more-canopy' ? 'moreCanopy' : activeMode];
  }, [routeResult, activeMode]);

  const alternativeRoute: ComputedRoute | null = useMemo(() => {
    if (!routeResult) return null;
    if (activeMode === 'more-canopy') return routeResult.shortest;
    return routeResult.moreCanopy;
  }, [routeResult, activeMode]);

  const handleMapPointSelected = (point: SelectedMapPoint) => {
    if (!availability || availability.status !== 'ready') return;
    const network = availability.bundle.network;
    const snapped = snapCoordinateToNetwork(point.coordinates, network);

    const completePoint: SelectedMapPoint = {
      ...point,
      snappedCoordinates: snapped?.snappedCoordinate,
      nodeId: snapped?.nearestNodeId,
      snapDistanceMetres: snapped?.distanceMetres,
    };

    setActiveDemoTrip(null);
    if (selectionMode === 'origin') setOrigin(completePoint);
    if (selectionMode === 'destination') setDestination(completePoint);
    setSelectionMode(null);
    setFeatureDetails(null);
    setActiveView('routes');
    setSheetSnap('half');
  };

  const handleLandmarkChosen = (lm: Landmark, target: 'origin' | 'destination') => {
    setActiveDemoTrip(null);
    const pt: SelectedMapPoint = {
      coordinates: lm.coordinates,
      snappedCoordinates: lm.snappedCoordinates,
      nodeId: lm.nearestNodeId,
      label: lm.name,
      source: 'landmark-preset',
      snapDistanceMetres: lm.snapDistanceMetres,
    };
    if (target === 'origin') setOrigin(pt);
    else setDestination(pt);
  };

  const handleSelectDemoTrip = (trip: DemoTrip) => {
    setOrigin({
      coordinates: trip.origin.coordinates,
      snappedCoordinates: trip.origin.coordinates,
      nodeId: trip.origin.nodeId,
      label: trip.origin.label,
      source: 'landmark-preset',
      snapDistanceMetres: trip.origin.snapDistanceMetres,
    });
    setDestination({
      coordinates: trip.destination.coordinates,
      snappedCoordinates: trip.destination.coordinates,
      nodeId: trip.destination.nodeId,
      label: trip.destination.label,
      source: 'landmark-preset',
      snapDistanceMetres: trip.destination.snapDistanceMetres,
    });
    setDepartureHour(12);
    setDepartureMinute(30);
    setActiveDate('2026-11-18');
    setActiveMode(trip.expectedOutcome.recommendedMode === 'more-canopy' ? 'more-canopy' : 'shortest');
    setActiveDemoTrip(trip);
    setActiveView('routes');
    setSheetSnap('half');
  };

  const swapEndpoints = () => {
    setActiveDemoTrip(null);
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const clearEndpoints = () => {
    setActiveDemoTrip(null);
    setOrigin(null);
    setDestination(null);
    setRouteResult(null);
    setRouteError(null);
  };

  const toggleLayer = (layerKey: keyof MapLayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const geoData: PilotGeoData | undefined =
    availability?.status === 'ready' ? availability.bundle.geoData : undefined;
  const landmarks: Landmark[] = geoData?.landmarks || [];
  const network: RouteNetwork | null =
    availability?.status === 'ready' ? availability.bundle.network : null;
  const shadeRecords: ShadeRecord[] =
    availability?.status === 'ready' ? availability.bundle.shadeRecords : [];

  return (
    <div className={`app-shell view-${activeView}`}>
      {/* Accessible Header with 3 Views */}
      <header className="app-header" role="banner">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">ShadeRoute</h1>
            <span className="brand-subtitle">Bibwewadi, Pune</span>
          </div>
        </div>

        {/* View Navigation Tabs: Explore, Routes, About + Demo Action */}
        <div className="header-nav-cluster">
          <button
            type="button"
            className="btn-demo-pill"
            onClick={() => setShowDemoModal(true)}
            title="Explore curated demonstration trips"
            aria-label="Demo: Explore curated demonstration trips"
          >
            ★ Demo
          </button>
          <nav className="view-nav-tabs" role="tablist" aria-label="Main navigation views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'explore'}
              className={`view-tab-btn ${activeView === 'explore' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveView('explore');
                setSheetSnap('peek');
              }}
            >
              Explore
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'routes'}
              className={`view-tab-btn ${activeView === 'routes' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveView('routes');
                setSheetSnap('half');
              }}
            >
              Routes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showAboutDialog}
              className={`view-tab-btn ${showAboutDialog ? 'is-active' : ''}`}
              onClick={() => setShowAboutDialog(true)}
            >
              About
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace Layout: Full-Bleed Map + Planner Sheet */}
      <main className="workspace-main">
        {/* Full-Bleed Map View */}
        <div className="map-pane">
          {/* Map Layer Toggle Bar */}
          <div className="map-layer-chips-row" role="toolbar" aria-label="Map layers">
            <button
              type="button"
              className={`layer-chip ${layers.buildingShadows ? 'is-active' : ''}`}
              onClick={() => toggleLayer('buildingShadows')}
              aria-pressed={layers.buildingShadows}
            >
              <span className="chip-dot shadow-dot" aria-hidden="true" /> Shadows
            </button>
            <button
              type="button"
              className={`layer-chip ${layers.canopy ? 'is-active' : ''}`}
              onClick={() => toggleLayer('canopy')}
              aria-pressed={layers.canopy}
            >
              <span className="chip-dot canopy-dot" aria-hidden="true" /> Canopies
            </button>
            <button
              type="button"
              className={`layer-chip ${layers.trees ? 'is-active' : ''}`}
              onClick={() => toggleLayer('trees')}
              aria-pressed={layers.trees}
            >
              <span className="chip-dot tree-dot" aria-hidden="true" /> Trees
            </button>
            <button
              type="button"
              className={`layer-chip ${layers.buildings ? 'is-active' : ''}`}
              onClick={() => toggleLayer('buildings')}
              aria-pressed={layers.buildings}
            >
              <span className="chip-dot bldg-dot" aria-hidden="true" /> Buildings
            </button>
            <button
              type="button"
              className={`layer-chip ${layers.network ? 'is-active' : ''}`}
              onClick={() => toggleLayer('network')}
              aria-pressed={layers.network}
            >
              <span className="chip-dot net-dot" aria-hidden="true" /> Streets
            </button>
            <button
              type="button"
              className={`layer-chip ${layers.uncertainty ? 'is-active' : ''}`}
              onClick={() => toggleLayer('uncertainty')}
              aria-pressed={layers.uncertainty}
              title="Highlight model-estimated height uncertainty"
            >
              <span className="chip-dot uncert-dot" aria-hidden="true" /> Uncertainty
            </button>
          </div>

          <MapView
            network={network}
            geoData={geoData}
            selectionMode={selectionMode}
            origin={origin}
            destination={destination}
            activeRoute={activeRoute}
            alternativeRoute={alternativeRoute}
            activeMode={activeMode}
            departureHour={departureHour}
            departureMinute={departureMinute}
            dateInput={activeDate}
            layers={layers}
            onMapPointSelected={handleMapPointSelected}
            onLandmarkSelected={(lm) => handleLandmarkChosen(lm, selectionMode || 'origin')}
            onFeatureSelected={setFeatureDetails}
          />

          {/* Map Selection Prompt Banner */}
          {selectionMode && (
            <div className="map-selection-banner" role="status">
              <span className="pulse-dot" aria-hidden="true" />
              <span>Click anywhere on the map to set your {selectionMode === 'origin' ? 'start point' : 'destination'}.</span>
              <button type="button" className="btn-cancel" onClick={() => setSelectionMode(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Planner Sheet Panel */}
        <PlannerPanel
          isLoading={isLoading}
          loadError={availability?.status === 'pending-validation' ? availability.reason : null}
          landmarks={landmarks}
          network={network}
          shadeRecords={shadeRecords}
          origin={origin}
          destination={destination}
          selectionMode={selectionMode}
          onSetSelectionMode={setSelectionMode}
          onSelectLandmark={handleLandmarkChosen}
          onSwapEndpoints={swapEndpoints}
          onClearEndpoints={clearEndpoints}
          departureHour={departureHour}
          departureMinute={departureMinute}
          activeDate={activeDate}
          onChangeTime={(h, m) => {
            setDepartureHour(h);
            setDepartureMinute(m);
          }}
          onChangeDate={setActiveDate}
          routeResult={routeResult}
          routeError={routeError}
          activeMode={activeMode}
          onSelectMode={setActiveMode}
          sheetSnap={sheetSnap}
          onSetSheetSnap={setSheetSnap}
          onOpenDemo={() => setShowDemoModal(true)}
          activeDemoTrip={activeDemoTrip}
        />
      </main>

      {/* Feature Details Inspector Drawer/Modal */}
      {featureDetails && (
        <div
          className="feature-inspector-card"
          role="region"
          aria-label="Selected feature details"
        >
          <div className="inspector-header">
            <div>
              <span className="inspector-category">{featureDetails.category}</span>
              <h3 className="inspector-title">{featureDetails.title}</h3>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setFeatureDetails(null)}
              aria-label="Close feature details"
            >
              ✕
            </button>
          </div>
          <div className="inspector-grid">
            {Object.entries(featureDetails.details).map(([key, value]) => (
              <div key={key} className="inspector-row">
                <span className="inspector-label">{key}</span>
                <span className="inspector-val">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curated Demo Trips Modal */}
      <DemoTripsModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onSelectTrip={handleSelectDemoTrip}
        currentTripId={activeDemoTrip?.id}
      />

      {/* About & Methodology Dialog */}
      <AboutDialog isOpen={showAboutDialog} onClose={() => setShowAboutDialog(false)} />
    </div>
  );
}
