import { useCallback, useId, useMemo, useRef, useState } from 'react';
import {
  calculateSolarPosition,
  getHeadingName,
  type SolarPosition,
} from '../routing/solarEngine';

export interface SunScrubberProps {
  departureHour: number;
  departureMinute: number;
  activeDate: string;
  onChangeTime: (hour: number, minute: number) => void;
  onChangeDate: (date: string) => void;
}

const MIN_MINUTES = 7 * 60; // 07:00 (420 min)
const MAX_MINUTES = 17 * 60; // 17:00 (1020 min)
const TOTAL_MINUTES = MAX_MINUTES - MIN_MINUTES; // 600 min

export function SunScrubber({
  departureHour,
  departureMinute,
  activeDate,
  onChangeTime,
  onChangeDate,
}: SunScrubberProps) {
  const arcId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentMinutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, departureHour * 60 + departureMinute));
  const progress = (currentMinutes - MIN_MINUTES) / TOTAL_MINUTES;

  const solarPos: SolarPosition = useMemo(
    () => calculateSolarPosition(departureHour, departureMinute, activeDate),
    [departureHour, departureMinute, activeDate],
  );

  // SVG Geometry
  const cx = 130;
  const cy = 95;
  const r = 80;

  // Angle from 180° (pi, left = East sunrise) to 0° (0, right = West sunset)
  const angleRad = Math.PI * (1 - progress);
  const sunX = cx + r * Math.cos(angleRad);
  const sunY = cy - r * Math.sin(angleRad);

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Handle pointer scrub along arc
  const handlePointerFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // SVG viewBox is 0 0 260 120
      const scaleX = 260 / rect.width;
      const scaleY = 120 / rect.height;
      const localX = (clientX - rect.left) * scaleX;
      const localY = (clientY - rect.top) * scaleY;

      const dx = localX - cx;
      const dy = cy - localY; // Invert y since SVG y goes down
      let angle = Math.atan2(dy, dx);
      if (angle < 0) {
        angle = dx >= 0 ? 0 : Math.PI;
      }
      const rawProgress = 1 - angle / Math.PI;
      const clampedProgress = Math.max(0, Math.min(1, rawProgress));
      const newMinutes = Math.round((MIN_MINUTES + clampedProgress * TOTAL_MINUTES) / 5) * 5;
      const newH = Math.floor(newMinutes / 60);
      const newM = newMinutes % 60;
      onChangeTime(newH, newM);
    },
    [cx, cy, onChangeTime],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);
    handlePointerFromCoords(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointerFromCoords(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore capture release error
    }
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 15;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -15;
    else if (e.key === 'PageUp') delta = 60;
    else if (e.key === 'PageDown') delta = -60;
    else if (e.key === 'Home') delta = -(currentMinutes - MIN_MINUTES);
    else if (e.key === 'End') delta = MAX_MINUTES - currentMinutes;

    if (delta !== 0) {
      e.preventDefault();
      const updated = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, currentMinutes + delta));
      onChangeTime(Math.floor(updated / 60), updated % 60);
    }
  };

  const timeString = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')} IST`;
  const shadowDir = getHeadingName(solarPos.shadowDirectionDeg);

  return (
    <div className="sun-scrubber-card" aria-label="Sun position scrubber and season selector">
      <div className="scrubber-header">
        <div className="scrubber-title-wrap">
          <span className="sun-icon-badge" aria-hidden="true">☀️</span>
          <div>
            <h3 className="scrubber-title">Solar Position &amp; Shadow Arc</h3>
            <span className="scrubber-subtitle">Drag the sun to adjust departure time</span>
          </div>
        </div>

        {/* Season Toggle */}
        <div className="season-toggle-group" role="group" aria-label="Seasonal solar model">
          <button
            type="button"
            className={`season-pill ${activeDate === '2026-11-18' ? 'is-active' : ''}`}
            onClick={() => onChangeDate('2026-11-18')}
            aria-pressed={activeDate === '2026-11-18'}
            title="Winter sun (lower altitude, longer morning/afternoon shadows)"
          >
            18 Nov (Winter)
          </button>
          <button
            type="button"
            className={`season-pill ${activeDate === '2026-04-25' ? 'is-active' : ''}`}
            onClick={() => onChangeDate('2026-04-25')}
            aria-pressed={activeDate === '2026-04-25'}
            title="Summer sun (high zenith altitude, intense noon sun)"
          >
            25 Apr (Summer)
          </button>
        </div>
      </div>

      {/* Semicircular Sun Arc Control */}
      <div className="arc-interactive-container">
        <svg
          ref={svgRef}
          viewBox="0 0 260 115"
          className="sun-arc-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Departure time slider"
          aria-valuemin={MIN_MINUTES}
          aria-valuemax={MAX_MINUTES}
          aria-valuenow={currentMinutes}
          aria-valuetext={`${timeString}, sun altitude ${solarPos.altitudeDeg.toFixed(1)} degrees`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <defs>
            <linearGradient id={`${arcId}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#eab308" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Horizon line */}
          <line x1="30" y1={cy} x2="230" y2={cy} stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Sky Arc Path */}
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#${arcId}-grad)`}
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Time markers on arc */}
          <text x={cx - r - 2} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="600">07:00</text>
          <text x={cx} y={cy - r - 6} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="700">12:00 Noon</text>
          <text x={cx + r + 2} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="600">17:00</text>

          {/* Sun Ray Beams */}
          <circle cx={sunX} cy={sunY} r="14" fill="#fef08a" opacity="0.45" />

          {/* Sun Handle Knob */}
          <circle
            cx={sunX}
            cy={sunY}
            r="8"
            fill="#eab308"
            stroke="#ffffff"
            strokeWidth="2.5"
            className="sun-handle-circle"
          />
          <circle cx={sunX} cy={sunY} r="3" fill="#b45309" />
        </svg>

        {/* Live Readout Pill */}
        <div className="scrubber-readout-row">
          <div className="time-badge-large">{timeString}</div>
          <div className="readout-metrics">
            <span className="readout-chip" title="Solar Altitude above horizon">
              Alt <strong>{solarPos.altitudeDeg.toFixed(1)}°</strong>
            </span>
            <span className="readout-chip" title="Solar Azimuth clockwise from North">
              Az <strong>{solarPos.azimuthDeg.toFixed(1)}°</strong>
            </span>
            <span className="readout-chip" title="Shadow length multiplier and direction">
              Shadow <strong>{solarPos.shadowMultiplier.toFixed(1)}×</strong> {shadowDir}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
