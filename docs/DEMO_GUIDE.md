# ShadeRoute — Hackathon Demonstration Guide

## 1. Hackathon Pitch (30 Seconds)

> **"Take the cooler way."**
> 
> Navigation apps like Google Maps and Apple Maps optimize purely for distance or vehicle travel time. On hot sunny days in Indian cities, pedestrians walk in direct, punishing sunlight when a cooler, tree-lined residential avenue is just one block away.
> 
> **ShadeRoute** is a zero-budget, climate-aware pedestrian navigation system. By cross-referencing OpenStreetMap pedestrian paths with municipal tree census data (over 3,800 individual geo-tagged trees in our Bibwewadi pilot), ShadeRoute calculates and compares walking alternatives: the **Shortest Route**, the **Cooler Way (More Canopy)**, and a **Balanced Route**—with honest, transparent trade-off metrics.

---

## 2. Key Product Capabilities to Demonstrate

### Demo Flow Sequence

#### Step 1: Open the Application
- Open the application at `http://localhost:5173/` (or `http://localhost:4173/` if previewing production build).
- Notice the clean, cartographic interface:
  - Topbar shows the active pilot: **Chintamani Nagar — Bibwewadi (Published Pilot)**.
  - Notice the **Solar Status Pill**: *"12:30 IST · 68° Elevation"*.
  - The map loads instantly with local bundled data—no paid map APIs or API keys required.

#### Step 2: Explore the Environmental Layers
- Click the **Layers** pills on the top-left of the map:
  - Toggle **🏢 Shadows**: Watch the dynamic ground shadow polygons projected from 376 building envelopes and 3,803 tree crowns.
  - Toggle **🌳 Canopy**: Watch the 3,803 circular green tree crowns appear across streets and parks ($R = D/2$).
  - Toggle **📍 Trees**: Displays individual municipal census trunk markers.
  - Toggle **🏛️ Buildings**: 376 mapped architectural footprints.
  - Toggle **❓ Height Uncertainty**: Highlights buildings whose heights rely on Tier 4 architectural typologies with amber outlines.
  - Click on any building footprint:
    - Point out the **Feature Inspector** flyout: displays OSM ID, footprint area ($m^2$), estimated height, confidence tier (e.g. *Tier 4 Typology Estimate*), height assumption rationale, and explicit uncertainty flag.
  - Click on any green tree dot:
    - Point out the **Feature Inspector** flyout: shows actual Pune Municipal Corporation Tree Census attributes:
      * Species Name (e.g. *Indian Almond*, *Neem*, *Mango*, *Ashoka*)
      * Height (e.g. *7 m*)
      * Crown Diameter (e.g. *6 m*)
      * Condition (*Healthy*)
      * Source (*Pune Municipal Corporation 2019 Census*)

#### Step 3: Run the Flagship Demonstration Corridor
- In the Planner Sidebar, look at the default pre-loaded corridor:
  - **Start:** Lake Town Road Junction (southern transit entrance).
  - **Destination:** VIT Pune — Main Gate (student campus entrance).
- Review the **Route Alternatives Cards**:
  1. **Shortest Distance Route (Orange):**
     - Distance: ~612 m, Walking Time: ~8.2 min.
     - Direct route, but exposed: only ~18% shade.
     - Source breakdown tag: 🏢 Buildings: 12% | 🌳 Trees: 8%.
  2. **Cooler Way (More Shade) (Green - Recommended):**
     - Distance: ~684 m (+72 m detour / +11.8%).
     - Walking Time: ~9.1 min (+0.9 min).
     - **Combined Shade: 52%** (over 355 m protected!).
     - Source breakdown tag: 🏢 Buildings: 34% | 🌳 Trees: 31% (strict non-double-counting union).
     - **Direct Sun Exposure reduced from 82% down to 48%!**
  3. **Balanced Route (Blue):**
     - Shows the intermediate compromise route with at most 15% detour.
- Click between the route cards:
  - The map dynamically highlights the selected route in bold emerald green or sunset orange.
  - Notice the dashed alternative path shown simultaneously on the map for clear visual comparison!

#### Step 4: Demonstrate the Solar Time Simulator & Dynamic Departure Progression
- In the sidebar, select **Morning (09:30)**:
  - Notice solar altitude is 46° and sun is in the southeast.
  - On the map, building shadows stretch tall toward the northwest across streets!
- Use the **Custom Departure Time Slider**:
  - Slide between 07:00 AM and 07:00 PM in 15-minute increments.
  - Watch the live time badge update (e.g. `08:15`, `14:45`, `16:30`).
  - The route engine recalculates edge-by-edge shadow coverage at the exact arrival time the pedestrian reaches each street segment at 1.25 m/s!
- Switch to **Afternoon (15:30)**:
  - Sun drops to 38° elevation in the southwest; building shadows flip and extend east-northeast.
- Switch back to **Noon (12:30)**:
  - Overhead sun (68° elevation); building shadows shrink, and tree canopies provide the predominant ground cover.

#### Step 5: Test Custom Map Clicks & Snapping
- Click the **pin icon** next to Destination.
- Notice the map crosshair and top prompt: *"Click anywhere on the map to set your destination."*
- Click inside Chintamani Nagar residential lanes (e.g. near Chintamani Garden).
- Watch how the pin is placed with an emerald or rose marker and automatically snaps to the closest walkable network junction, displaying: *"Snapped 3.8m to network"*.
- The routing engine calculates all three routes in less than 5 milliseconds!

#### Step 6: Review Methodology & Limitations (Honesty & Ethics)
- Click the **Methodology** button on the topbar.
- Emphasize to the judges our commitment to scientific honesty:
  - We do **not** claim to measure temperature (since no live ambient thermometer sensors exist).
  - We explicitly define canopy overlap as **geometric line-of-sight foliage cover**.
  - We preserve the distinction between 2019 census data and modern observations.
  - We enforce that unknown data remains unknown, rather than making false claims of sun exposure.

---

## 3. Quick Terminal Commands to Run the Demo

```powershell
# From project root:
cd web
npm install
npm run dev

# Or test the production build:
npm run build
npm run preview
```
Visit: `http://localhost:5173/` (or port printed in terminal).
