# ShadeRoute — Canopy and Shade Modelling Methodology

## 1. Scientific Philosophy

Conventional routing applications treat pedestrian walkways as one-dimensional abstract vectors parameterized solely by Euclidean length or free-flow walking velocity. ShadeRoute treats pedestrian corridors as **three-dimensional environmental micro-environments** interacting with overhead vegetation, building enclosures, and solar angles.

### Essential Ethical Disclosures
1. **Shade is Not Temperature:** ShadeRoute models **potential solar canopy overlap** and line-of-sight foliage cover. It does **not** measure or claim microclimate ambient air temperature or radiant surface temperature reduction.
2. **Canopy Diameter is a Diameter:** In the municipal dataset, `canopy_dia_m` represents total crown diameter ($D$). The geometric radius of the crown is strictly $R = D / 2$.
3. **Unknowns Remain Unknown:** The absence of a recorded tree on a corridor is not treated as proof of intense sun exposure; where data coverage is missing, it is reported as *unknown*.

---

## 2. Geometric Canopy Modelling

### A. Tree Crown Approximation
Where a tree record provides valid coordinates $(x_c, y_c)$ and diameter $D$:
- We construct a regular 16-sided polygon approximating a circle of radius $R = D / 2$ around the trunk coordinate.
- The projection uses local metric Cartesian space calibrated for Pune:
  $$\Delta x = (\lambda - \lambda_0) \times 111{,}320 \times \cos(\phi_0) \text{ metres}$$
  $$\Delta y = (\phi - \phi_0) \times 110{,}852 \text{ metres}$$
  where $\phi_0 = 18.4645^\circ \text{ N}$ and $\lambda_0 = 73.8675^\circ \text{ E}$.

### B. Segment-Circle Geometric Intersection
For every edge segment $E$ bounded by endpoints $P_1 = (x_1, y_1)$ and $P_2 = (x_2, y_2)$ and every tree circle of radius $R$ centered at $C = (x_c, y_c)$:
We parameterize points along the segment as $P(t) = P_1 + t (P_2 - P_1)$ for $t \in [0, 1]$.
The condition that $P(t)$ lies within the tree crown is:
$$\|P(t) - C\|^2 \le R^2$$

Expanding this yields the quadratic equation in $t$:
$$a t^2 + b t + c \le 0$$
where:
$$V = P_2 - P_1$$
$$D = P_1 - C$$
$$a = V \cdot V = \|V\|^2$$
$$b = 2 (D \cdot V)$$
$$c = D \cdot D - R^2 = \|D\|^2 - R^2$$

The discriminant is $\Delta = b^2 - 4ac$.
- If $\Delta \le 0$, the line does not intersect the crown.
- If $\Delta > 0$, the entry and exit parameters are:
  $$t_1 = \frac{-b - \sqrt{\Delta}}{2a}, \quad t_2 = \frac{-b + \sqrt{\Delta}}{2a}$$
  The overlapping interval on the physical segment is:
  $$I = [\max(0, t_1), \min(1, t_2)]$$

### C. Interval Merging & Non-Double-Counting
When multiple roadside trees overhang the same street segment, their crowns frequently intersect. Simply summing individual overlap distances would produce impossible canopy fractions exceeding $100\%$.

ShadeRoute sorts all intersecting intervals on the segment $[0, 1]$ and merges overlapping or contiguous intervals into a disjoint set:
$$\mathcal{I}_{\text{merged}} = \bigcup [t_{s, k}, t_{e, k}]$$
The total canopy overlap fraction for edge $e$ is:
$$f_{\text{canopy}}(e) = \sum_{k} (t_{e, k} - t_{s, k}) \in [0, 1]$$
The physical canopy-covered distance is:
$$L_{\text{canopy}}(e) = f_{\text{canopy}}(e) \times \text{Length}(e)$$

---

## 3. Covered Walkways & Structural Shading

Verified architectural covered walkways (such as continuous arcades, pedestrian canopies, or transit shelters) are classified with `pathClass = "covered-walkway"`.
- Covered walkways are treated as an independent evidence layer from biological tree crowns.
- For verified covered segments, $f_{\text{covered}}(e) = 1.0$.
- In route reporting, canopy overlap and covered walkway distances are accounted for separately.

---

## 4. Astronomical Solar Position Model

To model the dynamic effect of the sun shifting across streets throughout the day, ShadeRoute implements the Solar Position Algorithm for Pune:

### A. Solar Coordinates
Given day of year $n$ and local hour/minute in Pune (UTC+05:30):
1. **Solar Declination ($\delta$):**
   $$\delta = 23.45^\circ \sin\left(\frac{360^\circ}{365}(284 + n)\right)$$
2. **Local Solar Time (LST):**
   Standard meridian for India (IST) is $82.5^\circ \text{ E}$. Since Pune is at $73.867^\circ \text{ E}$, solar noon occurs approximately $34.5 \text{ minutes}$ later than IST noon:
   $$\text{LST} = \text{Hour} + \frac{\text{Minute}}{60} - \frac{4 \times (82.5^\circ - 73.867^\circ)}{60}$$
3. **Hour Angle ($H$):**
   $$H = 15^\circ \times (\text{LST} - 12)$$
4. **Solar Altitude / Elevation ($\alpha$):**
   $$\sin\alpha = \sin\phi \sin\delta + \cos\phi \cos\delta \cos H$$
5. **Solar Azimuth ($\psi$):**
   $$\cos\psi = \frac{\sin\delta - \sin\alpha \sin\phi}{\cos\alpha \cos\phi}$$

### B. Shadow Projection
For a tree of height $H_{\text{tree}}$ and solar altitude $\alpha > 5^\circ$:
- Shadow multiplier: $M_{\text{shadow}} = \frac{1}{\tan\alpha}$ (clamped to 3.0 at low sun angles to prevent unrealistic infinite shadows).
- Shadow displacement vector $(\Delta x_{\text{shadow}}, \Delta y_{\text{shadow}})$:
  $$\Delta x_{\text{shadow}} = \sin(\psi + 180^\circ) \times H_{\text{tree}} \times M_{\text{shadow}}$$
  $$\Delta y_{\text{shadow}} = \cos(\psi + 180^\circ) \times H_{\text{tree}} \times M_{\text{shadow}}$$

### C. Solar Presets in UI
- **Morning (09:30 IST):** Sun elevation $\approx 46^\circ$, azimuth $\approx 125^\circ$ (SE). Shadows extend WNW by $\approx 1.0 \times \text{height}$.
- **Noon (12:30 IST):** Sun elevation $\approx 68^\circ$, azimuth $\approx 178^\circ$ (S). High overhead sun; shadows are short ($\approx 0.4 \times \text{height}$) and fall directly under tree canopies.
- **Afternoon (15:30 IST):** Sun elevation $\approx 38^\circ$, azimuth $\approx 235^\circ$ (SW). Shadows extend ENE by $\approx 1.25 \times \text{height}$.
- **Late Day (17:00 IST):** Low sun angle ($\approx 18^\circ$); elongated shadows across cross-streets.
