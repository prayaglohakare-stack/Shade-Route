import { useId, useMemo } from 'react';
import type { CampusEdge, ShadeRecord } from '../data/types';
import { edgeLength, interpolateSlotShade } from '../routing/routeEngine';

export interface ShadeRibbonProps {
  edges: CampusEdge[];
  shadeMap?: Map<string, ShadeRecord>;
  departureHour: number;
  departureMinute: number;
  dateInput?: string;
  walkingSpeedMps?: number;
  combinedShadePercentage: number;
  exposedPercentage: number;
  unknownPercentage: number;
}

interface RibbonSegment {
  type: 'shaded' | 'sunny' | 'unknown';
  widthPercent: number;
}

export function ShadeRibbon({
  edges,
  shadeMap,
  departureHour,
  departureMinute,
  dateInput = '2026-11-18',
  walkingSpeedMps = 1.25,
  combinedShadePercentage,
  exposedPercentage,
  unknownPercentage,
}: ShadeRibbonProps) {
  const patternId = useId();

  // Compute proportional segments along the physical walking sequence
  const segments: RibbonSegment[] = useMemo(() => {
    if (!edges || edges.length === 0) return [];

    let totalLen = 0;
    const edgeData: Array<{ len: number; shaded: number; unknown: number; exposed: number }> = [];
    let elapsedSec = 0;

    for (const edge of edges) {
      const len = edgeLength(edge);
      if (len <= 0) continue;
      totalLen += len;

      const arrivalMin = departureHour * 60 + departureMinute + elapsedSec / 60;
      const shade = shadeMap?.get(edge.edgeId);
      const isCovered = edge.pathClass === 'covered-walkway';
      const dynamic = interpolateSlotShade(shade, arrivalMin, dateInput);

      const comb = isCovered ? 1.0 : dynamic.combinedFrac;
      const unk = dynamic.unknownFrac;
      const exp = Math.max(0.0, 1.0 - comb - unk);

      edgeData.push({
        len,
        shaded: len * comb,
        unknown: len * unk,
        exposed: len * exp,
      });

      elapsedSec += len / walkingSpeedMps;
    }

    if (totalLen <= 0) return [];

    const segs: RibbonSegment[] = [];
    for (const d of edgeData) {
      const pShaded = (d.shaded / totalLen) * 100;
      const pUnk = (d.unknown / totalLen) * 100;
      const pExp = (d.exposed / totalLen) * 100;

      if (pShaded > 0.1) segs.push({ type: 'shaded', widthPercent: pShaded });
      if (pExp > 0.1) segs.push({ type: 'sunny', widthPercent: pExp });
      if (pUnk > 0.1) segs.push({ type: 'unknown', widthPercent: pUnk });
    }

    return segs;
  }, [edges, shadeMap, departureHour, departureMinute, dateInput, walkingSpeedMps]);

  let currentX = 0;

  return (
    <div className="shade-ribbon-container" aria-label="Route shade breakdown ribbon">
      {/* SVG Ribbon Bar */}
      <div className="ribbon-bar-wrapper">
        <svg
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          className="shade-ribbon-svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={`${patternId}-hatch`}
              width="4"
              height="4"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1.6" />
            </pattern>
          </defs>

          {segments.map((seg, idx) => {
            const x = currentX;
            currentX += seg.widthPercent;
            const fillColor =
              seg.type === 'shaded'
                ? '#163D32'
                : seg.type === 'sunny'
                ? '#f59e0b'
                : `url(#${patternId}-hatch)`;

            return (
              <rect
                key={idx}
                x={`${x}%`}
                y="0"
                width={`${seg.widthPercent}%`}
                height="8"
                fill={fillColor}
              />
            );
          })}
        </svg>
      </div>

      {/* Mini Legend & Uncertainty Tooltip */}
      <div className="ribbon-legend-row">
        <div className="legend-items">
          <span className="legend-chip sunny-chip">
            <span className="legend-dot sunny-dot" />
            Sunny {exposedPercentage}%
          </span>
          <span className="legend-chip shaded-chip">
            <span className="legend-dot shaded-dot" />
            Shaded {combinedShadePercentage}%
          </span>
          {unknownPercentage > 0 && (
            <span className="legend-chip unknown-chip">
              <span className="legend-dot unknown-dot" />
              Unknown {unknownPercentage}%
            </span>
          )}
        </div>

        {/* Short info tooltip instead of paragraphs; zero verified labels */}
        <span
          className="ribbon-info-badge"
          title="Modelled estimate from OSM footprints and PMC 2019 tree census. Unverified."
          aria-label="Modelled estimate from OpenStreetMap footprints and PMC 2019 tree census. Unverified."
        >
          ℹ️ Modelled
        </span>
      </div>
    </div>
  );
}
