import { useEffect, useMemo, useState } from 'react';
import { CampusMap, type MapLayerVisibility, type MapSelectionMode, type SelectedMapPoint } from './components/CampusMap';
import { campusRepository, type RouteDataAvailability } from './data/campusRepository';
import type { Landmark, PilotGeoData, RouteNetwork, ShadeRecord } from './data/types';
import {
  calculateAllRoutes,
  snapCoordinateToNetwork,
  type ComputedRoute,
  type RouteComparisonResult,
  type RouteMode,
} from './routing/routeEngine';
import {
  calculateSolarPosition,
  getSolarPresets,
  generatePresetDescription,
  type SolarPreset,
} from './routing/solarEngine';
import Topography from './components/react-bits/Topography/Topography';
import TargetCursor from './components/react-bits/TargetCursor/TargetCursor';
import TechText from './components/react-bits/TechText/TechText';
import './styles.css';

function Icon({ name, size = 18 }: { name: 'brand' | 'pin' | 'swap' | 'arrow' | 'chevron' | 'sun' | 'layers' | 'close' | 'tree' | 'info' | 'shield' | 'clock' | 'building' | 'navigation' | 'sparkles' | 'check' | 'alert'; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'brand': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'pin': return <svg {...props}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'swap': return <svg {...props}><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>;
    case 'arrow': return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'chevron': return <svg {...props}><path d="m9 18 6-6-6-6"/></svg>;
    case 'sun': return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>;
    case 'layers': return <svg {...props}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>;
    case 'close': return <svg {...props}><path d="m18 6-12 12M6 6l12 12"/></svg>;
    case 'tree': return <svg {...props}><path d="M12 19v3m-5-8a5 5 0 0 1 10 0c1.5 0 2.5 1.5 2 3-1 2-2 3-4 3H9c-2 0-3-1-4-3-.5-1.5.5-3 2-3z"/></svg>;
    case 'info': return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>;
    case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'building': return <svg {...props}><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>;
    case 'navigation': return <svg {...props}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
    case 'sparkles': return <svg {...props}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>;
    case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'alert': return <svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  }
}

export default function App() {
  const campuses = useMemo(() => campusRepository.listCampuses(), []);
  const defaultCampusId = campuses.find((c) => c.dataStatus === 'published')?.campusId || campuses[0]?.campusId;
  const [selectedCampusId, setSelectedCampusId] = useState<string>(defaultCampusId);
  const [availability, setAvailability] = useState<RouteDataAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selection states
  const [selectionMode, setSelectionMode] = useState<MapSelectionMode>(null);
  const [origin, setOrigin] = useState<SelectedMapPoint | null>(null);
  const [destination, setDestination] = useState<SelectedMapPoint | null>(null);
  const [activeMode, setActiveMode] = useState<RouteMode>('more-canopy');

  // Departure Time states
  const [solarPreset, setSolarPreset] = useState<SolarPreset>('noon');
  const [departureHour, setDepartureHour] = useState<number>(12);
  const [departureMinute, setDepartureMinute] = useState<number>(30);

  // Layer toggles
  const [layers, setLayers] = useState<MapLayerVisibility>({
    buildingShadows: true,
    canopy: true,
    trees: true,
    buildings: true,
    network: true,
    uncertainty: false,
  });

  // Modals & inspectors
  const [featureDetails, setFeatureDetails] = useState<{ title: string; category: string; details: Record<string, string | number> } | null>(null);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Computed routes
  const [routeResult, setRouteResult] = useState<RouteComparisonResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Load campus bundle
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    campusRepository.loadRouteBundle(selectedCampusId).then((result) => {
      if (!active) return;
      setAvailability(result);
      setIsLoading(false);

      if (result.status === 'ready' && result.bundle.geoData?.landmarks?.length) {
        const lms = result.bundle.geoData.landmarks;
        const defaultOriginLm = lms.find((l) => l.id === 'lake-town-junction') || lms[0];
        const defaultDestLm = lms.find((l) => l.id === 'vit-main-gate') || lms[1];

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
    });

    return () => { active = false; };
  }, [selectedCampusId]);

  // Solar Presets dynamically computed for the active date
  const activeDate = '2026-11-18';
  const solarPresets = useMemo(() => getSolarPresets(activeDate), [activeDate]);

  // Handle preset change
  const selectSolarPreset = (presetId: SolarPreset) => {
    setSolarPreset(presetId);
    const preset = solarPresets.find((p) => p.id === presetId);
    if (preset) {
      setDepartureHour(preset.hour);
      setDepartureMinute(preset.minute);
    }
  };

  // Recalculate routes whenever endpoints, time, or bundle changes
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

    if (selectionMode === 'origin') setOrigin(completePoint);
    if (selectionMode === 'destination') setDestination(completePoint);
    setSelectionMode(null);
    setFeatureDetails(null);
  };

  const handleLandmarkChosen = (lm: Landmark, target: 'origin' | 'destination') => {
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
    setSelectionMode(null);
  };

  const swapEndpoints = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const clearEndpoints = () => {
    setOrigin(null);
    setDestination(null);
    setSelectionMode(null);
    setRouteResult(null);
    setRouteError(null);
  };

  const toggleLayer = (layerKey: keyof MapLayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const solarInfo = useMemo(() => {
    const pos = calculateSolarPosition(departureHour, departureMinute);
    return { pos };
  }, [departureHour, departureMinute]);

  const currentCampus = campuses.find((c) => c.campusId === selectedCampusId) || campuses[0];
  const geoData: PilotGeoData | undefined = availability?.status === 'ready' ? availability.bundle.geoData : undefined;
  const landmarks: Landmark[] = geoData?.landmarks || [];

  return (
    <div className="app-shell">
      {/* Desktop Target Cursor */}
      <TargetCursor
        targetSelector=".cursor-target"
        cursorColor="#047857"
        cursorColorOnTarget="#059669"
        hideDefaultCursor={false}
        size={36}
        cornerSize={10}
        thickness={2.5}
        padding={6}
        dotSize={4}
        showLabel={true}
      />

      {/* Topbar */}
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark"><Icon name="brand" size={22} /></div>
          <div className="brand-copy">
            <h1 className="sr-only">ShadeRoute</h1>
            <div className="brand-tech-wrap" title="ShadeRoute — Take the cooler way">
              <TechText
                text="ShadeRoute"
                fontSize={20}
                fontWeight={800}
                color="#0f172a"
                accentColor="#047857"
                speed={0.25}
                sweep={true}
              />
            </div>
            <span className="brand-tagline">Take the cooler way.</span>
          </div>
        </div>

        {/* Pilot Area Selector */}
        <div className="pilot-selector-group">
          <label htmlFor="campus-select" className="sr-only">Choose Pilot Area</label>
          <div className="campus-pill">
            <span className={`status-dot ${currentCampus.dataStatus === 'published' ? 'is-live' : 'is-pending'}`} />
            <select
              id="campus-select"
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="campus-select"
            >
              {campuses.map((c) => (
                <option key={c.campusId} value={c.campusId}>
                  {c.name} {c.dataStatus === 'published' ? '✓ (Combined Built+Natural Pilot)' : '⏳ (Under Review)'}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={14} />
          </div>
        </div>

        {/* Departure Time & Solar Position Indicator */}
        <div className="solar-status-pill" title={`Solar Altitude: ${solarInfo.pos.altitudeDeg}°, Azimuth: ${solarInfo.pos.azimuthDeg}°`}>
          <Icon name="sun" size={16} />
          <span>
            <strong>{String(departureHour).padStart(2, '0')}:{String(departureMinute).padStart(2, '0')} IST</strong> · {solarInfo.pos.altitudeDeg}° Elevation
          </span>
        </div>

        {/* Quick Actions */}
        <div className="topbar-actions">
          <button
            className="topbar-btn cursor-target"
            data-cursor-label="TOUR"
            onClick={() => setShowWelcomeModal(true)}
            aria-label="View product tour and features"
          >
            <Icon name="sparkles" size={16} />
            <span>Product Tour</span>
          </button>
          <button
            className="topbar-btn cursor-target"
            data-cursor-label="INFO"
            onClick={() => setShowMethodologyModal(true)}
            aria-label="View methodology and provenance"
          >
            <Icon name="info" size={16} />
            <span>Methodology</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="workspace">
        {/* Planner Sidebar */}
        <aside className="planner-panel" aria-label="Route planning controls">
          <div className="planner-scroll">
            {/* Header info */}
            <div className="planner-header">
              <div className="title-row">
                <h2>Pedestrian Route Planner</h2>
                <span className="live-badge">Combined Built + Canopy</span>
              </div>
              <p className="subtitle">
                Evaluating building-cast shadows, tree canopies, and covered walkways with zero double-counting.
              </p>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="alert-card warning">
                <span className="pulse-dot" />
                <div>
                  <strong>Loading Environmental Data</strong>
                  <p>Assembling building footprints, tree crowns, and pedestrian graph...</p>
                </div>
              </div>
            )}

            {/* If campus is under review / pending */}
            {availability?.status === 'pending-validation' && (
              <div className="alert-card warning">
                <Icon name="shield" size={18} />
                <div>
                  <strong>Data Gate Active</strong>
                  <p>{availability.reason}</p>
                </div>
              </div>
            )}

            {/* Endpoints Box */}
            <div className="endpoint-card">
              {/* Origin Row */}
              <div className={`endpoint-row ${selectionMode === 'origin' ? 'is-active-pick' : ''}`}>
                <div className="endpoint-marker start-marker">A</div>
                <div className="endpoint-inputs">
                  <div className="endpoint-label-row">
                    <small>STARTING POINT</small>
                    {origin?.snapDistanceMetres !== undefined && (
                      <span className={`snap-chip ${origin.snapDistanceMetres > 30 ? 'snap-warning' : ''}`} title={origin.snapDistanceMetres > 30 ? 'Point is >30m from network; snapped to nearest street' : undefined}>
                        {origin.snapDistanceMetres > 30 && '⚠️ '}Snapped {origin.snapDistanceMetres}m
                      </span>
                    )}
                  </div>
                  <div className="endpoint-field">
                    <span className="endpoint-text">{origin ? origin.label : 'Choose starting point'}</span>
                  </div>
                </div>
                <div className="endpoint-actions">
                  <button
                    className={`btn-icon cursor-target ${selectionMode === 'origin' ? 'btn-active' : ''}`}
                    data-cursor-label="PIN"
                    onClick={() => setSelectionMode(selectionMode === 'origin' ? null : 'origin')}
                    title="Click on map to select start"
                  >
                    <Icon name="pin" size={15} />
                  </button>
                </div>
              </div>

              {/* Landmark quick select for Origin */}
              {landmarks.length > 0 && (
                <div className="landmark-quick-row">
                  <select
                    className="landmark-dropdown"
                    value=""
                    onChange={(e) => {
                      const lm = landmarks.find((l) => l.id === e.target.value);
                      if (lm) handleLandmarkChosen(lm, 'origin');
                    }}
                  >
                    <option value="" disabled>Select landmark destination...</option>
                    {landmarks.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.category})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Swap Button */}
              <div className="swap-divider">
                <span className="divider-line" />
                <button className="swap-btn cursor-target" data-cursor-label="SWAP" onClick={swapEndpoints} title="Swap start and destination">
                  <Icon name="swap" size={14} />
                </button>
                <span className="divider-line" />
              </div>

              {/* Destination Row */}
              <div className={`endpoint-row ${selectionMode === 'destination' ? 'is-active-pick' : ''}`}>
                <div className="endpoint-marker dest-marker">B</div>
                <div className="endpoint-inputs">
                  <div className="endpoint-label-row">
                    <small>DESTINATION</small>
                    {destination?.snapDistanceMetres !== undefined && (
                      <span className={`snap-chip ${destination.snapDistanceMetres > 30 ? 'snap-warning' : ''}`} title={destination.snapDistanceMetres > 30 ? 'Point is >30m from network; snapped to nearest street' : undefined}>
                        {destination.snapDistanceMetres > 30 && '⚠️ '}Snapped {destination.snapDistanceMetres}m
                      </span>
                    )}
                  </div>
                  <div className="endpoint-field">
                    <span className="endpoint-text">{destination ? destination.label : 'Choose destination'}</span>
                  </div>
                </div>
                <div className="endpoint-actions">
                  <button
                    className={`btn-icon cursor-target ${selectionMode === 'destination' ? 'btn-active' : ''}`}
                    data-cursor-label="PIN"
                    onClick={() => setSelectionMode(selectionMode === 'destination' ? null : 'destination')}
                    title="Click on map to select destination"
                  >
                    <Icon name="pin" size={15} />
                  </button>
                </div>
              </div>

              {/* Landmark quick select for Destination */}
              {landmarks.length > 0 && (
                <div className="landmark-quick-row">
                  <select
                    className="landmark-dropdown"
                    value=""
                    onChange={(e) => {
                      const lm = landmarks.find((l) => l.id === e.target.value);
                      if (lm) handleLandmarkChosen(lm, 'destination');
                    }}
                  >
                    <option value="" disabled>Select landmark destination...</option>
                    {landmarks.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.category})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Over-30m Snapping Warning Alert */}
              {((origin?.snapDistanceMetres ?? 0) > 30 || (destination?.snapDistanceMetres ?? 0) > 30) && (
                <div className="snap-distance-alert" role="alert">
                  <Icon name="alert" size={14} />
                  <span>Point is snapped &gt;30 m from walkable network. Walking directions start at nearest street access point.</span>
                </div>
              )}

              {/* Clear Link */}
              {(origin || destination) && (
                <div className="clear-row">
                  <button className="btn-link" onClick={clearEndpoints}>Clear points</button>
                </div>
              )}
            </div>

            {/* Departure Time & Solar Position Simulator */}
            <div className="solar-time-card">
              <div className="section-label">
                <Icon name="clock" size={15} />
                <span>Departure Time & Solar Position (Pune)</span>
              </div>
              <div className="solar-presets-grid">
                {solarPresets.map((p) => {
                  const pos = calculateSolarPosition(p.hour, p.minute, activeDate);
                  return (
                    <button
                      key={p.id}
                      className={`solar-preset-btn cursor-target ${solarPreset === p.id ? 'is-selected' : ''}`}
                      data-cursor-label="SUN"
                      onClick={() => selectSolarPreset(p.id)}
                      title={p.description}
                    >
                      <strong>{p.timeString}</strong>
                      <small>{pos.altitudeDeg.toFixed(0)}° alt · {pos.shadowMultiplier.toFixed(1)}× shadow</small>
                    </button>
                  );
                })}
              </div>

              {/* Custom Departure Time Controls */}
              <div className="custom-time-row">
                <span className="custom-time-label">Custom Departure:</span>
                <input
                  type="range"
                  min="8"
                  max="18"
                  step="0.5"
                  value={departureHour + departureMinute / 60}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const h = Math.floor(val);
                    const m = Math.round((val - h) * 60);
                    setDepartureHour(h);
                    setDepartureMinute(m);
                    setSolarPreset('noon'); // custom mode
                  }}
                  className="time-slider"
                  aria-label="Departure time slider"
                />
                <span className="time-badge">{String(departureHour).padStart(2, '0')}:{String(departureMinute).padStart(2, '0')}</span>
              </div>

              <p className="solar-note">
                At {String(departureHour).padStart(2, '0')}:{String(departureMinute).padStart(2, '0')}: {generatePresetDescription(departureHour, departureMinute, activeDate)}
              </p>
            </div>

            {/* Route Alternatives Section */}
            {routeResult && (
              <div className="routes-section">
                <div className="section-label">
                  <Icon name="navigation" size={15} />
                  <span>Combined Shade Alternatives ({routeResult.departureTimeText})</span>
                </div>

                {/* 3 Route Mode Cards */}
                <div className="route-cards-list">
                  {/* 1. Cooler / More Shade Route */}
                  <div
                    className={`route-choice-card cursor-target ${activeMode === 'more-canopy' ? 'is-active' : ''}`}
                    data-cursor-label="COOLER"
                    onClick={() => setActiveMode('more-canopy')}
                  >
                    <div className="card-topline">
                      <div className="mode-title-wrap">
                        <span className="mode-indicator canopy-color" />
                        <strong>Cooler Way (More Shade)</strong>
                      </div>
                      {routeResult.recommendedMode === 'more-canopy' && (
                        <span className="badge-recommended"><Icon name="sparkles" size={12} /> RECOMMENDED</span>
                      )}
                    </div>

                    {/* Headline metric: minutes in direct sun */}
                    <div className="card-headline-row">
                      <div className="headline-sun-metric">
                        <Icon name="sun" size={16} />
                        <span className="sun-metric-value">{routeResult.moreCanopy.metrics.sunMinutes} min</span>
                        <span className="sun-metric-label">in direct sun</span>
                      </div>
                      <div className="headline-distance-info">
                        <span>{routeResult.moreCanopy.metrics.distanceMetres} m</span>
                        <span className="detour-delta">
                          {routeResult.moreCanopy.isCoincidentWithShortest ? '(same as shortest)' : `+${routeResult.moreCanopy.metrics.detourDistanceMetres}m (+${routeResult.moreCanopy.metrics.detourPercentage}%)`}
                        </span>
                      </div>
                    </div>

                    {/* Secondary metrics */}
                    <div className="card-metrics-row">
                      <div className="metric-pill highlight-green">
                        <small>TOTAL SHADE</small>
                        <span>{routeResult.moreCanopy.metrics.combinedShadePercentage}%</span>
                      </div>
                      <div className="metric-pill">
                        <small>SUN SAVED</small>
                        <span>{routeResult.moreCanopy.metrics.sunMinutesSavedVsShortest} min</span>
                      </div>
                      <div className="metric-pill">
                        <small>WALK TIME</small>
                        <span>{routeResult.moreCanopy.metrics.walkingMinutes} min</span>
                      </div>
                      {routeResult.moreCanopy.metrics.unknownPercentage > 0 && (
                        <div className="metric-pill highlight-unknown">
                          <small>UNKNOWN</small>
                          <span>{routeResult.moreCanopy.metrics.unknownPercentage}%</span>
                        </div>
                      )}
                    </div>

                    {/* Source Breakdown Pill Bar */}
                    <div className="source-breakdown-row">
                      <span className="breakdown-tag bldg-tag">🏢 Buildings: {routeResult.moreCanopy.metrics.buildingPercentage}%</span>
                      <span className="breakdown-tag tree-tag">🌳 Trees: {routeResult.moreCanopy.metrics.canopyPercentage}%</span>
                      {routeResult.moreCanopy.metrics.coveredPercentage > 0 && (
                        <span className="breakdown-tag covered-tag">🏛️ Covered: {routeResult.moreCanopy.metrics.coveredPercentage}%</span>
                      )}
                      {routeResult.moreCanopy.metrics.unknownPercentage > 0 && (
                        <span className="breakdown-tag unknown-tag">❓ Unknown: {routeResult.moreCanopy.metrics.unknownPercentage}%</span>
                      )}
                    </div>

                    <p className="card-explanation">{routeResult.moreCanopy.explanation}</p>
                  </div>

                  {/* 2. Shortest Route */}
                  <div
                    className={`route-choice-card cursor-target ${activeMode === 'shortest' ? 'is-active' : ''}`}
                    data-cursor-label="SHORTEST"
                    onClick={() => setActiveMode('shortest')}
                  >
                    <div className="card-topline">
                      <div className="mode-title-wrap">
                        <span className="mode-indicator shortest-color" />
                        <strong>Shortest Distance</strong>
                      </div>
                      {routeResult.recommendedMode === 'shortest' && (
                        <span className="badge-recommended"><Icon name="sparkles" size={12} /> RECOMMENDED</span>
                      )}
                    </div>

                    {/* Headline metric: minutes in direct sun */}
                    <div className="card-headline-row shortest-headline">
                      <div className="headline-sun-metric">
                        <Icon name="sun" size={16} />
                        <span className="sun-metric-value">{routeResult.shortest.metrics.sunMinutes} min</span>
                        <span className="sun-metric-label">in direct sun</span>
                      </div>
                      <div className="headline-distance-info">
                        <span>{routeResult.shortest.metrics.distanceMetres} m</span>
                        <span className="detour-delta">(baseline distance)</span>
                      </div>
                    </div>

                    {/* Secondary metrics */}
                    <div className="card-metrics-row">
                      <div className="metric-pill">
                        <small>TOTAL SHADE</small>
                        <span>{routeResult.shortest.metrics.combinedShadePercentage}%</span>
                      </div>
                      <div className="metric-pill">
                        <small>WALK TIME</small>
                        <span>{routeResult.shortest.metrics.walkingMinutes} min</span>
                      </div>
                      <div className="metric-pill">
                        <small>EXPOSED</small>
                        <span>{routeResult.shortest.metrics.exposedPercentage}%</span>
                      </div>
                      {routeResult.shortest.metrics.unknownPercentage > 0 && (
                        <div className="metric-pill highlight-unknown">
                          <small>UNKNOWN</small>
                          <span>{routeResult.shortest.metrics.unknownPercentage}%</span>
                        </div>
                      )}
                    </div>

                    <div className="source-breakdown-row">
                      <span className="breakdown-tag bldg-tag">🏢 Buildings: {routeResult.shortest.metrics.buildingPercentage}%</span>
                      <span className="breakdown-tag tree-tag">🌳 Trees: {routeResult.shortest.metrics.canopyPercentage}%</span>
                      {routeResult.shortest.metrics.unknownPercentage > 0 && (
                        <span className="breakdown-tag unknown-tag">❓ Unknown: {routeResult.shortest.metrics.unknownPercentage}%</span>
                      )}
                    </div>

                    <p className="card-explanation">{routeResult.shortest.explanation}</p>
                  </div>

                  {/* 3. Balanced Route */}
                  <div
                    className={`route-choice-card cursor-target ${activeMode === 'balanced' ? 'is-active' : ''}`}
                    data-cursor-label="BALANCED"
                    onClick={() => setActiveMode('balanced')}
                  >
                    <div className="card-topline">
                      <div className="mode-title-wrap">
                        <span className="mode-indicator balanced-color" />
                        <strong>Balanced Route</strong>
                      </div>
                      {routeResult.recommendedMode === 'balanced' && (
                        <span className="badge-recommended"><Icon name="sparkles" size={12} /> RECOMMENDED</span>
                      )}
                    </div>

                    {/* Headline metric: minutes in direct sun */}
                    <div className="card-headline-row balanced-headline">
                      <div className="headline-sun-metric">
                        <Icon name="sun" size={16} />
                        <span className="sun-metric-value">{routeResult.balanced.metrics.sunMinutes} min</span>
                        <span className="sun-metric-label">in direct sun</span>
                      </div>
                      <div className="headline-distance-info">
                        <span>{routeResult.balanced.metrics.distanceMetres} m</span>
                        <span className="detour-delta">
                          {routeResult.balanced.isCoincidentWithShortest ? '(same as shortest)' : `+${routeResult.balanced.metrics.detourDistanceMetres}m (+${routeResult.balanced.metrics.detourPercentage}%)`}
                        </span>
                      </div>
                    </div>

                    {/* Secondary metrics */}
                    <div className="card-metrics-row">
                      <div className="metric-pill">
                        <small>TOTAL SHADE</small>
                        <span>{routeResult.balanced.metrics.combinedShadePercentage}%</span>
                      </div>
                      <div className="metric-pill">
                        <small>SUN SAVED</small>
                        <span>{routeResult.balanced.metrics.sunMinutesSavedVsShortest} min</span>
                      </div>
                      <div className="metric-pill">
                        <small>WALK TIME</small>
                        <span>{routeResult.balanced.metrics.walkingMinutes} min</span>
                      </div>
                      {routeResult.balanced.metrics.unknownPercentage > 0 && (
                        <div className="metric-pill highlight-unknown">
                          <small>UNKNOWN</small>
                          <span>{routeResult.balanced.metrics.unknownPercentage}%</span>
                        </div>
                      )}
                    </div>

                    <div className="source-breakdown-row">
                      <span className="breakdown-tag bldg-tag">🏢 Buildings: {routeResult.balanced.metrics.buildingPercentage}%</span>
                      <span className="breakdown-tag tree-tag">🌳 Trees: {routeResult.balanced.metrics.canopyPercentage}%</span>
                      {routeResult.balanced.metrics.unknownPercentage > 0 && (
                        <span className="breakdown-tag unknown-tag">❓ Unknown: {routeResult.balanced.metrics.unknownPercentage}%</span>
                      )}
                    </div>

                    <p className="card-explanation">{routeResult.balanced.explanation}</p>
                  </div>
                </div>

                {/* Synthesis Banner */}
                <div className="recommendation-banner">
                  <Icon name="sparkles" size={17} />
                  <p>{routeResult.summaryExplanation}</p>
                </div>
              </div>
            )}

            {/* Route Error State */}
            {routeError && (
              <div className="alert-card error">
                <Icon name="close" size={18} />
                <div>
                  <strong>Routing Notice</strong>
                  <p>{routeError}</p>
                </div>
              </div>
            )}

            {/* Environmental Data Integrity Note */}
            <div className="evidence-badge-card">
              <div className="evidence-title">
                <Icon name="shield" size={16} />
                <span>Multi-Source Environmental Layers</span>
              </div>
              <ul className="evidence-list">
                <li><strong>Building Shadows:</strong> 376 mapped architectural footprints with 5-tier height confidence taxonomy.</li>
                <li><strong>Tree Canopies:</strong> 3,803 municipal census trees with measured crown geometries.</li>
                <li><strong>No Double Counting:</strong> Shaded path distances are calculated as the geometric union of building shadows, tree crowns, and covered structures.</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Map Workspace */}
        <section className="map-viewport" aria-label="Interactive map">
          {/* Floating Map Controls & Layer Bar */}
          <div className="map-floating-bar">
            <span className="floating-bar-label">Layers:</span>
            <button
              className={`layer-toggle-chip ${layers.buildingShadows ? 'is-active' : ''}`}
              onClick={() => toggleLayer('buildingShadows')}
              title="Toggle building-cast shadows"
            >
              <span className="chip-dot shadow-dot" /> Building Shadows
            </button>
            <button
              className={`layer-toggle-chip ${layers.canopy ? 'is-active' : ''}`}
              onClick={() => toggleLayer('canopy')}
              title="Toggle tree-canopy crowns"
            >
              <span className="chip-dot canopy-dot" /> Tree Crowns
            </button>
            <button
              className={`layer-toggle-chip ${layers.trees ? 'is-active' : ''}`}
              onClick={() => toggleLayer('trees')}
              title="Toggle municipal tree points"
            >
              <span className="chip-dot tree-dot" /> Trees
            </button>
            <button
              className={`layer-toggle-chip ${layers.buildings ? 'is-active' : ''}`}
              onClick={() => toggleLayer('buildings')}
              title="Toggle 3D building footprints"
            >
              <span className="chip-dot bldg-dot" /> Buildings
            </button>
            <button
              className={`layer-toggle-chip ${layers.network ? 'is-active' : ''}`}
              onClick={() => toggleLayer('network')}
              title="Toggle walkable pedestrian streets"
            >
              <span className="chip-dot net-dot" /> Streets
            </button>
            <button
              className={`layer-toggle-chip ${layers.uncertainty ? 'is-active' : ''}`}
              onClick={() => toggleLayer('uncertainty')}
              title="Highlight model-estimated height uncertainty"
            >
              <span className="chip-dot uncert-dot" /> Height Uncertainty
            </button>
          </div>

          {/* Map Component */}
          <CampusMap
            network={availability?.status === 'ready' ? availability.bundle.network : null}
            geoData={geoData}
            selectionMode={selectionMode}
            origin={origin}
            destination={destination}
            activeRoute={activeRoute}
            alternativeRoute={alternativeRoute}
            activeMode={activeMode}
            solarTime={solarPreset}
            departureHour={departureHour}
            departureMinute={departureMinute}
            dateInput={activeDate}
            layers={layers}
            onMapPointSelected={handleMapPointSelected}
            onLandmarkSelected={(lm) => handleLandmarkChosen(lm, selectionMode || 'origin')}
            onFeatureSelected={setFeatureDetails}
          />

          {/* Selection Prompt Overlay */}
          {selectionMode && (
            <div className="map-selection-banner">
              <span className="pulse-dot" />
              <span>Click anywhere on the map to set your {selectionMode === 'origin' ? 'start point' : 'destination'}.</span>
              <button className="btn-cancel" onClick={() => setSelectionMode(null)}>Cancel</button>
            </div>
          )}

          {/* Feature Inspector Flyout */}
          {featureDetails && (
            <div className="feature-flyout" aria-live="polite">
              <div className="flyout-header">
                <div>
                  <small className="flyout-category">{featureDetails.category.toUpperCase()}</small>
                  <h3>{featureDetails.title}</h3>
                </div>
                <button
                  className="flyout-close"
                  onClick={() => setFeatureDetails(null)}
                  aria-label="Close feature details"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="flyout-details-grid">
                {Object.entries(featureDetails.details).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <span className="detail-label">{key}:</span>
                    <span className="detail-val">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Footer Attribution */}
          <div className="map-bottom-strip">
            <span>Chintamani Nagar · Bibwewadi Combined Pilot</span>
            <span className="sep">·</span>
            <span>376 Buildings (Height Tiered)</span>
            <span className="sep">·</span>
            <span>3,803 Municipal Trees</span>
            <span className="sep">·</span>
            <span>698 Network Junctions</span>
          </div>
        </section>
      </main>

      {/* Methodology & Data Provenance Modal */}
      {showMethodologyModal && (
        <div className="modal-backdrop" onClick={() => setShowMethodologyModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header-topography">
              <div className="topography-bg-wrap">
                <Topography
                  color="#047857"
                  opacity={0.22}
                  lineCount={26}
                  elevation={1.1}
                  speed={0.1}
                  lightMode={true}
                  mouseInteraction={false}
                />
              </div>
              <h2>ShadeRoute Methodology & Provenance</h2>
              <button
                className="modal-close cursor-target"
                data-cursor-label="CLOSE"
                onClick={() => setShowMethodologyModal(false)}
                aria-label="Close methodology modal"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <section className="modal-section">
                <h3>1. Combined Built & Natural Shade Model</h3>
                <p>
                  In dense urban environments like Pune, buildings are frequently the primary source of pedestrian sun protection.
                  ShadeRoute evaluates pedestrian pathways against physical environmental features—namely building-cast shadows,
                  geo-located tree crowns, and covered architectural walkways—calculating the exact mathematical union to avoid double-counting.
                </p>
              </section>

              <section className="modal-section">
                <h3>2. Building Height Confidence Hierarchy</h3>
                <p>To avoid silently guessing building heights, ShadeRoute employs an explicit 5-tier confidence taxonomy:</p>
                <ol className="modal-numbered-list">
                  <li><strong>Tier 1 — Authoritative Measured:</strong> Terrestrial LiDAR or engineering building height survey.</li>
                  <li><strong>Tier 2 — Source-Tagged OSM:</strong> Explicit OSM `height=*` tags.</li>
                  <li><strong>Tier 3 — Levels-Derived:</strong> OSM `building:levels=*` converted at 3.0 m/storey + 0.5 m parapet.</li>
                  <li><strong>Tier 4 — Architectural Typology Model:</strong> Calibrated for Bibwewadi Pune residential societies based on footprint area (low-rise 1-2F: 5.5m; mid-rise 2-3F: 8.5m; apartment block 4-5F: 13.5m; institutional: 16.5m), flagged as model-estimated uncertainty.</li>
                  <li><strong>Tier 5 — Unknown:</strong> Buildings lacking usable spatial evidence.</li>
                </ol>
              </section>

              <section className="modal-section">
                <h3>3. Time Progression & Dynamic Traversal</h3>
                <p>
                  Route segments are evaluated at the estimated timestamp the pedestrian reaches them,
                  progressing at standard pedestrian speed (1.25 m/s) from the selected departure time.
                  As the sun's altitude and azimuth shift, building shadows elongate or contract across cross-streets.
                </p>
              </section>

              <section className="modal-section">
                <h3>4. Scientific Honesty & Disclosures</h3>
                <ul>
                  <li><strong>Not Temperature:</strong> Calculations represent direct line-of-sight protection from solar radiation; they do not measure thermodynamic air temperature.</li>
                  <li><strong>Tree Data Provenance:</strong> Tree attributes originate from the 2019 PMC Tree Census. Subsequent pruning or felling is unrecorded.</li>
                  <li><strong>Zero Double-Counting:</strong> When a building shadow and a tree crown fall on the same sidewalk section, their overlap is counted only once.</li>
                </ul>
              </section>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary cursor-target"
                data-cursor-label="RETURN"
                onClick={() => setShowMethodologyModal(false)}
              >
                Close & Return to Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Orientation & Welcome Hero Experience */}
      {showWelcomeModal && (
        <div className="modal-backdrop" onClick={() => setShowWelcomeModal(false)}>
          <div className="welcome-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="welcome-hero-banner">
              <div className="welcome-hero-topography">
                <Topography
                  color="#047857"
                  opacity={0.35}
                  lineCount={36}
                  elevation={1.25}
                  speed={0.15}
                  lightMode={true}
                  mouseInteraction={true}
                />
              </div>
              <div className="welcome-hero-content">
                <div className="welcome-tech-wrap">
                  <TechText
                    text="ShadeRoute"
                    fontSize={32}
                    fontWeight={900}
                    color="#064e3b"
                    accentColor="#10b981"
                    sweep={true}
                    intro="assemble"
                  />
                </div>
                <p className="welcome-tagline">Take the cooler way.</p>
                <p className="welcome-subtext">
                  Climate-aware pedestrian navigation balancing physical distance with combined
                  building-cast shadows, municipal tree canopies, and covered walkways.
                </p>
                <span className="welcome-disclaimer">
                  * Aesthetic contour motif for visual brand identity; does not represent measured terrain topography.
                </span>
              </div>
            </div>
            <div className="welcome-features-grid">
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">🏢</span>
                <div>
                  <h4>Building-Cast Shadows</h4>
                  <p>Astronomical solar projection calculates 3D ground shadows from building envelopes.</p>
                </div>
              </div>
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">🌳</span>
                <div>
                  <h4>3,800+ Municipal Trees</h4>
                  <p>Geo-tagged Pune Tree Census records parameterized into circular canopy crowns.</p>
                </div>
              </div>
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">⚖️</span>
                <div>
                  <h4>Zero Double-Counting</h4>
                  <p>Strict mathematical union prevents shade inflation when building shadows overlap tree crowns.</p>
                </div>
              </div>
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">⏱️</span>
                <div>
                  <h4>Dynamic Time Traversal</h4>
                  <p>Segments are evaluated at the exact arrival time you reach them at 1.25 m/s.</p>
                </div>
              </div>
            </div>
            <div className="welcome-footer">
              <button
                className="btn-secondary cursor-target"
                data-cursor-label="DOCS"
                onClick={() => {
                  setShowWelcomeModal(false);
                  setShowMethodologyModal(true);
                }}
              >
                Read Methodology
              </button>
              <button
                className="btn-primary cursor-target"
                data-cursor-label="EXPLORE"
                onClick={() => setShowWelcomeModal(false)}
              >
                Explore Chintamani Nagar Pilot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
