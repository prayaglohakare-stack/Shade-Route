import { useEffect, useRef } from 'react';
import { DEMO_TRIPS, type DemoTrip } from '../data/demoTrips';

export interface DemoTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: DemoTrip) => void;
  currentTripId?: string;
}

export function DemoTripsModal({
  isOpen,
  onClose,
  onSelectTrip,
  currentTripId,
}: DemoTripsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
    >
      <div
        className="modal-container demo-modal-container"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden="true">★</span>
            <div>
              <h2 id="demo-modal-title" className="modal-title">Curated Demonstration Trips</h2>
              <span className="modal-subtitle">Scientifically honest comparisons across Bibwewadi</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close demo trips dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body-scroll">
          <p className="demo-intro-text">
            These trips were selected by evaluating pedestrian origin-destination pairs separated by ≥400 metres at solar noon (12:30 IST):
            three where the cooler route clearly wins direct sun avoidance, and one where the shortest route is already optimal.
          </p>

          <div className="demo-trips-grid">
            {DEMO_TRIPS.map((trip) => {
              const isCoolerWin = trip.tag === 'cooler-win';
              const isSelected = trip.id === currentTripId;

              return (
                <div
                  key={trip.id}
                  className={`demo-trip-card ${isCoolerWin ? 'is-cooler-win' : 'is-shortest-optimal'} ${
                    isSelected ? 'is-current-active' : ''
                  }`}
                >
                  <div className="demo-card-header">
                    <span
                      className={`demo-badge ${isCoolerWin ? 'badge-cooler' : 'badge-shortest'}`}
                    >
                      {trip.badgeLabel}
                    </span>
                    <span className="demo-tag-label">
                      {isCoolerWin ? 'Cooler Route Wins' : 'Shortest is Best'}
                    </span>
                  </div>

                  <h3 className="demo-trip-title">{trip.title}</h3>
                  <p className="demo-trip-summary">{trip.summary}</p>

                  <div className="demo-endpoints-chips">
                    <div className="demo-endpoint-chip">
                      <span className="chip-code">A</span>
                      <span>{trip.origin.label}</span>
                    </div>
                    <div className="demo-endpoint-chip">
                      <span className="chip-code">B</span>
                      <span>{trip.destination.label}</span>
                    </div>
                  </div>

                  <div className="demo-honest-note">
                    <strong>Honest Assessment:</strong> {trip.expectedOutcome.honestNote}
                  </div>

                  <div className="demo-card-actions">
                    <button
                      type="button"
                      className={`btn-select-demo ${isSelected ? 'btn-active' : 'btn-primary'}`}
                      onClick={() => {
                        onSelectTrip(trip);
                        onClose();
                      }}
                      aria-label={`Load demo trip: ${trip.title}`}
                    >
                      {isSelected ? '✓ Currently Loaded' : 'Load This Trip'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
