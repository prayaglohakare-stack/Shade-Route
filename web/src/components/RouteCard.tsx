import type { ShadeRecord } from '../data/types';
import type { ComputedRoute } from '../routing/routeEngine';
import { ShadeRibbon } from './ShadeRibbon';

export interface RouteCardProps {
  route: ComputedRoute;
  isActive: boolean;
  isRecommended: boolean;
  onSelect: () => void;
  shadeMap?: Map<string, ShadeRecord>;
  departureHour: number;
  departureMinute: number;
  dateInput: string;
}

export function RouteCard({
  route,
  isActive,
  isRecommended,
  onSelect,
  shadeMap,
  departureHour,
  departureMinute,
  dateInput,
}: RouteCardProps) {
  const isShortest = route.mode === 'shortest';
  const isCooler = route.mode === 'more-canopy';
  const isBalanced = route.mode === 'balanced';

  const indicatorClass = isCooler
    ? 'canopy-color'
    : isBalanced
    ? 'balanced-color'
    : 'shortest-color';

  const headlineBorderClass = isCooler
    ? ''
    : isBalanced
    ? 'balanced-headline'
    : 'shortest-headline';

  return (
    <div
      className={`route-choice-card ${isActive ? 'is-active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`${route.modeTitle}: ${route.metrics.sunMinutes} minutes in direct sun, ${route.metrics.distanceMetres} metres`}
    >
      {/* Topline: Title & Recommendation */}
      <div className="card-topline">
        <div className="mode-title-wrap">
          <span className={`mode-indicator ${indicatorClass}`} aria-hidden="true" />
          <strong>{route.modeTitle}</strong>
        </div>
        {isRecommended && (
          <span className="badge-recommended">
            <span aria-hidden="true">★</span> RECOMMENDED
          </span>
        )}
      </div>

      {/* 1. Headline Metric: Minutes in Direct Sun (shown first) */}
      <div className={`card-headline-row ${headlineBorderClass}`}>
        <div className="headline-sun-metric">
          <span className="sun-icon-mini" aria-hidden="true">☀️</span>
          <span className="sun-metric-value">{route.metrics.sunMinutes} min</span>
          <span className="sun-metric-label">in direct sun</span>
        </div>
        <div className="headline-distance-info">
          <span>{route.metrics.distanceMetres} m</span>
          {!isShortest && (
            <span className="detour-delta">
              {route.isCoincidentWithShortest
                ? '(same as shortest)'
                : `+${route.metrics.detourDistanceMetres}m (+${route.metrics.detourPercentage}%)`}
            </span>
          )}
          {isShortest && <span className="detour-delta">(shortest)</span>}
        </div>
      </div>

      {/* 2. Shade Ribbon: Sunny / Shaded / Unknown with Hatching */}
      <ShadeRibbon
        edges={route.edges}
        shadeMap={shadeMap}
        departureHour={departureHour}
        departureMinute={departureMinute}
        dateInput={dateInput}
        combinedShadePercentage={route.metrics.combinedShadePercentage}
        exposedPercentage={route.metrics.exposedPercentage}
        unknownPercentage={route.metrics.unknownPercentage}
      />

      {/* 3. Secondary Metrics Row */}
      <div className="card-metrics-row">
        <div className="metric-pill highlight-green">
          <small>TOTAL SHADE</small>
          <span>{route.metrics.combinedShadePercentage}%</span>
        </div>
        {!isShortest && (
          <div className="metric-pill">
            <small>SUN SAVED</small>
            <span>{route.metrics.sunMinutesSavedVsShortest} min</span>
          </div>
        )}
        <div className="metric-pill">
          <small>WALK TIME</small>
          <span>{route.metrics.walkingMinutes} min</span>
        </div>
        {route.metrics.unknownPercentage > 0 && (
          <div className="metric-pill highlight-unknown">
            <small>UNKNOWN</small>
            <span>{route.metrics.unknownPercentage}%</span>
          </div>
        )}
      </div>

      {/* 4. Source Breakdown Tags */}
      <div className="source-breakdown-row">
        <span className="breakdown-tag bldg-tag">🏢 Buildings: {route.metrics.buildingPercentage}%</span>
        <span className="breakdown-tag tree-tag">🌳 Trees: {route.metrics.canopyPercentage}%</span>
        {route.metrics.coveredPercentage > 0 && (
          <span className="breakdown-tag covered-tag">🏛️ Covered: {route.metrics.coveredPercentage}%</span>
        )}
        {route.metrics.unknownPercentage > 0 && (
          <span className="breakdown-tag unknown-tag">❓ Unknown: {route.metrics.unknownPercentage}%</span>
        )}
      </div>

      {/* 5. Honest Explanation */}
      <p className="card-explanation">{route.explanation}</p>
    </div>
  );
}
