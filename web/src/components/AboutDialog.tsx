import { useEffect, useRef } from 'react';

export interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

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
      aria-labelledby="about-dialog-title"
    >
      <div
        className="modal-container"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden="true">🌿</span>
            <div>
              <h2 id="about-dialog-title" className="modal-title">About ShadeRoute</h2>
              <span className="modal-subtitle">Bibwewadi / Chintamani Nagar Pilot</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body-scroll">
          {/* Section 1: Overview */}
          <section className="about-section">
            <h3 className="section-heading">1. Scientific Honesty &amp; Core Constraints</h3>
            <p>
              ShadeRoute is an offline-first pedestrian navigation engine designed to help walkers avoid direct solar exposure in Indian cities.
            </p>
            <div className="callout-card note">
              <strong>Crucial Distinction: Shade is NOT Temperature</strong>
              <p>
                Walking in shade blocks radiant heat from direct solar radiation (shortwave irradiance), preventing direct sun heating. However, ambient air temperature in an urban corridor remains largely uniform between shade and direct sun. ShadeRoute models <em>minutes in direct sun</em>, never claiming ambient temperature differentials.
              </p>
            </div>
          </section>

          {/* Section 2: Validation Status */}
          <section className="about-section">
            <h3 className="section-heading">2. Validation Status</h3>
            <div className="callout-card warning">
              <strong>Modelled Pipeline Notice</strong>
              <p>
                Shade estimates are modelled from OpenStreetMap footprints, estimated building heights and the 2019 PMC tree census. <strong>No field validation has been done yet.</strong>
              </p>
              <p>
                Every network edge is labelled <code>accessStatus: "osm-derived"</code> and <code>verificationStatus: "unverified"</code>. No fake or placeholder ground observations are created.
              </p>
            </div>

            <h4 className="subsection-heading">How We Will Validate (Field Roadmap)</h4>
            <ol className="roadmap-list">
              <li>
                <strong>Physical Field Walk:</strong> High-resolution GPS tracking along selected pilot corridors in Bibwewadi during three distinct solar times of day: morning (09:30 IST), solar noon (12:30 IST), and late afternoon (16:30 IST).
              </li>
              <li>
                <strong>Timestamped Ground Truth Photos:</strong> Georeferenced photographs capturing actual building shadow extents and tree crown ground shadows.
              </li>
              <li>
                <strong>Direct Sun vs Modelled Concordance:</strong> Quantitative comparison between predicted slot shade fractions and physical shadow cast boundaries, tuning municipal height assumptions.
              </li>
            </ol>
          </section>

          {/* Section 3: Methodology */}
          <section className="about-section">
            <h3 className="section-heading">3. Solar &amp; Shadow Modelling Methodology</h3>
            <ul className="methodology-points">
              <li>
                <strong>NOAA Solar Engine:</strong> Implements the Jean Meeus astronomical algorithm computing solar altitude, azimuth, equation of time, and atmospheric refraction for Pune (lat 18.464° N, lon 73.867° E).
              </li>
              <li>
                <strong>Displaced Tree Crown Projections:</strong> Individual tree heights from the 2019 census displace crowns along the shadow direction: <code>offset = height / tan(altitude)</code>.
              </li>
              <li>
                <strong>Building Shadow Extrusion:</strong> 2D ground shadow polygons projected from calibrated OpenStreetMap building footprints.
              </li>
              <li>
                <strong>Strict Non-Double-Counting Union:</strong> Overlapping tree crowns, building shadows, and covered walkways are combined via mathematical union with zero double counting.
              </li>
              <li>
                <strong>Unknown Coverage Isolation:</strong> Edges outside the pilot data coverage box are classified as <em>unknown</em> and never counted as exposed or shaded.
              </li>
            </ul>
          </section>

          {/* Section 4: Data Sources & Licenses */}
          <section className="about-section">
            <h3 className="section-heading">4. Data Sources &amp; Licensing</h3>
            <ul className="sources-list">
              <li>
                <strong>Pune Municipal Corporation Tree Census (2019):</strong> Open Data Commons / Pune Smart City Civic Open Data. 3,738 living municipal trees.
              </li>
              <li>
                <strong>OpenStreetMap Contributors:</strong> Open Database License (ODbL) 1.0. 698 pedestrian nodes, 836 edges, 376 building footprints.
              </li>
            </ul>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
