import type { Landmark, RouteNetwork, ShadeRecord } from '../data/types';
import type { RouteComparisonResult, RouteMode } from '../routing/routeEngine';
import type { MapSelectionMode, SelectedMapPoint } from './MapView';
import { RouteCard } from './RouteCard';
import { SunScrubber } from './SunScrubber';

export interface PlannerPanelProps {
  isLoading: boolean;
  loadError: string | null;
  landmarks: Landmark[];
  network: RouteNetwork | null;
  shadeRecords: ShadeRecord[];
  origin: SelectedMapPoint | null;
  destination: SelectedMapPoint | null;
  selectionMode: MapSelectionMode;
  onSetSelectionMode: (mode: MapSelectionMode) => void;
  onSelectLandmark: (landmark: Landmark, target: 'origin' | 'destination') => void;
  onSwapEndpoints: () => void;
  onClearEndpoints: () => void;
  departureHour: number;
  departureMinute: number;
  activeDate: string;
  onChangeTime: (hour: number, minute: number) => void;
  onChangeDate: (date: string) => void;
  routeResult: RouteComparisonResult | null;
  routeError: string | null;
  activeMode: RouteMode;
  onSelectMode: (mode: RouteMode) => void;
  sheetSnap: 'peek' | 'half' | 'full';
  onSetSheetSnap: (snap: 'peek' | 'half' | 'full') => void;
  onOpenDemo?: () => void;
}

export function PlannerPanel({
  isLoading,
  loadError,
  landmarks,
  shadeRecords,
  origin,
  destination,
  selectionMode,
  onSetSelectionMode,
  onSelectLandmark,
  onSwapEndpoints,
  onClearEndpoints,
  departureHour,
  departureMinute,
  activeDate,
  onChangeTime,
  onChangeDate,
  routeResult,
  routeError,
  activeMode,
  onSelectMode,
  sheetSnap,
  onSetSheetSnap,
  onOpenDemo,
}: PlannerPanelProps) {
  const shadeMap = new Map<string, ShadeRecord>(shadeRecords.map((r) => [r.edgeId, r]));

  const hasEndpoints = Boolean(origin && destination);
  const snapWarning =
    (origin?.snapDistanceMetres ?? 0) > 30 || (destination?.snapDistanceMetres ?? 0) > 30;

  return (
    <aside
      className={`planner-sheet snap-${sheetSnap}`}
      aria-label="Route planning and alternatives panel"
    >
      {/* Mobile Draggable Handle */}
      <div
        className="sheet-handle-bar"
        onClick={() => {
          if (sheetSnap === 'peek') onSetSheetSnap('half');
          else if (sheetSnap === 'half') onSetSheetSnap('full');
          else onSetSheetSnap('half');
        }}
        title="Tap to expand or minimize"
      >
        <span className="sheet-handle-pill" aria-hidden="true" />
      </div>

      <div className="planner-scroll-content">
        {/* Panel Header */}
        <div className="planner-header">
          <div className="title-row">
            <h2>Pedestrian Route Planner</h2>
            <span className="pilot-badge">Bibwewadi Pilot</span>
          </div>
          <p className="subtitle">
            Minimising direct solar radiation through combined building shadows and tree crowns.
          </p>
        </div>

        {/* Skeleton Loading State */}
        {isLoading && (
          <div className="skeleton-loading-box" aria-live="polite">
            <div className="skeleton-line shimmer-bar" style={{ width: '60%', height: '18px' }} />
            <div className="skeleton-line shimmer-bar" style={{ width: '100%', height: '54px', marginTop: '10px' }} />
            <div className="skeleton-line shimmer-bar" style={{ width: '100%', height: '110px', marginTop: '10px' }} />
            <p className="skeleton-text">Loading pedestrian network and solar models...</p>
          </div>
        )}

        {/* Error State if bundle fails */}
        {loadError && (
          <div className="alert-card error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Failed to load data</strong>
              <p>{loadError}</p>
            </div>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            {/* Endpoints Selection Box */}
            <div className="endpoint-card">
              {/* Origin Row */}
              <div className={`endpoint-row ${selectionMode === 'origin' ? 'is-active-pick' : ''}`}>
                <div className="endpoint-marker start-marker" aria-hidden="true">A</div>
                <div className="endpoint-inputs">
                  <div className="endpoint-label-row">
                    <small>STARTING POINT</small>
                    {origin?.snapDistanceMetres !== undefined && (
                      <span
                        className={`snap-chip ${origin.snapDistanceMetres > 30 ? 'snap-warning' : ''}`}
                        title={origin.snapDistanceMetres > 30 ? 'Point is >30m from network' : undefined}
                      >
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
                    type="button"
                    className={`btn-icon ${selectionMode === 'origin' ? 'btn-active' : ''}`}
                    onClick={() => onSetSelectionMode(selectionMode === 'origin' ? null : 'origin')}
                    title="Click on map to select start"
                    aria-label="Pick start on map"
                  >
                    📍
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
                      if (lm) onSelectLandmark(lm, 'origin');
                    }}
                    aria-label="Choose origin landmark"
                  >
                    <option value="" disabled>Select landmark start...</option>
                    {landmarks.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.category})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Swap Button */}
              <div className="swap-divider">
                <span className="divider-line" />
                <button
                  type="button"
                  className="swap-btn"
                  onClick={onSwapEndpoints}
                  title="Swap start and destination"
                  aria-label="Swap endpoints"
                >
                  ⇅
                </button>
                <span className="divider-line" />
              </div>

              {/* Destination Row */}
              <div className={`endpoint-row ${selectionMode === 'destination' ? 'is-active-pick' : ''}`}>
                <div className="endpoint-marker dest-marker" aria-hidden="true">B</div>
                <div className="endpoint-inputs">
                  <div className="endpoint-label-row">
                    <small>DESTINATION</small>
                    {destination?.snapDistanceMetres !== undefined && (
                      <span
                        className={`snap-chip ${destination.snapDistanceMetres > 30 ? 'snap-warning' : ''}`}
                        title={destination.snapDistanceMetres > 30 ? 'Point is >30m from network' : undefined}
                      >
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
                    type="button"
                    className={`btn-icon ${selectionMode === 'destination' ? 'btn-active' : ''}`}
                    onClick={() => onSetSelectionMode(selectionMode === 'destination' ? null : 'destination')}
                    title="Click on map to select destination"
                    aria-label="Pick destination on map"
                  >
                    📍
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
                      if (lm) onSelectLandmark(lm, 'destination');
                    }}
                    aria-label="Choose destination landmark"
                  >
                    <option value="" disabled>Select landmark destination...</option>
                    {landmarks.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.category})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Over-30m Snapping Warning Alert */}
              {snapWarning && (
                <div className="snap-distance-alert" role="alert">
                  <span aria-hidden="true">⚠️</span>
                  <span>Point is snapped &gt;30 m from walkable network. Walking directions start at nearest street access point.</span>
                </div>
              )}

              {/* Clear Link */}
              {(origin || destination) && (
                <div className="clear-row">
                  <button type="button" className="btn-link" onClick={onClearEndpoints}>
                    Clear points
                  </button>
                </div>
              )}
            </div>

            {/* Sun-Arc Scrubber */}
            <SunScrubber
              departureHour={departureHour}
              departureMinute={departureMinute}
              activeDate={activeDate}
              onChangeTime={onChangeTime}
              onChangeDate={onChangeDate}
            />

            {/* Empty State when no endpoints selected */}
            {!hasEndpoints && (
              <div className="empty-state-card">
                <span className="empty-icon" aria-hidden="true">🚶</span>
                <h3>Select Start &amp; Destination</h3>
                <p>Choose landmarks from the dropdowns above or tap any point on the map to calculate real shaded walking paths.</p>
                {onOpenDemo && (
                  <button type="button" className="btn-demo-trip" onClick={onOpenDemo}>
                    ★ Try Curated Demo Trips
                  </button>
                )}
              </div>
            )}

            {/* Error State if route calculation fails */}
            {hasEndpoints && routeError && (
              <div className="alert-card warning" role="alert">
                <span aria-hidden="true">ℹ️</span>
                <div>
                  <strong>No connected route</strong>
                  <p>{routeError}</p>
                </div>
              </div>
            )}

            {/* Route Alternatives List */}
            {routeResult && (
              <div className="routes-section">
                <div className="section-label">
                  <span>Combined Shade Alternatives ({routeResult.departureTimeText})</span>
                </div>

                <div className="route-cards-list">
                  <RouteCard
                    route={routeResult.moreCanopy}
                    isActive={activeMode === 'more-canopy'}
                    isRecommended={routeResult.recommendedMode === 'more-canopy'}
                    onSelect={() => onSelectMode('more-canopy')}
                    shadeMap={shadeMap}
                    departureHour={departureHour}
                    departureMinute={departureMinute}
                    dateInput={activeDate}
                  />

                  <RouteCard
                    route={routeResult.shortest}
                    isActive={activeMode === 'shortest'}
                    isRecommended={routeResult.recommendedMode === 'shortest'}
                    onSelect={() => onSelectMode('shortest')}
                    shadeMap={shadeMap}
                    departureHour={departureHour}
                    departureMinute={departureMinute}
                    dateInput={activeDate}
                  />

                  <RouteCard
                    route={routeResult.balanced}
                    isActive={activeMode === 'balanced'}
                    isRecommended={routeResult.recommendedMode === 'balanced'}
                    onSelect={() => onSelectMode('balanced')}
                    shadeMap={shadeMap}
                    departureHour={departureHour}
                    departureMinute={departureMinute}
                    dateInput={activeDate}
                  />
                </div>

                {/* Synthesis Banner */}
                <div className="recommendation-banner" role="status">
                  <span aria-hidden="true">✨</span>
                  <p>{routeResult.summaryExplanation}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
