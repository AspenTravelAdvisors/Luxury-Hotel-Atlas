# Search & Filters Redesign — Change Log

A focused redesign of the Luxury Hotel Atlas search/filter experience and the
mobile detail panel. All work is contained in `index.html`. Commits span
`a7e6144 … 4e0d376` on `main` (361 lines changed: +278 / −83).

---

## 1. Search separated from filters (glass search bar)

- Moved the search input out of the filter rail into a **standalone translucent
  "glass" bar** floating at the top-center of the map
  (`backdrop-filter: blur(20px)`, semi-transparent fill, gold magnifier icon,
  focus ring, and a clear (×) button).
- The filter rail is now independent of search.

## 2. Filters: narrow and hidden on load

- The filter rail starts **hidden on every screen size** and is opened from the
  **Filters** pill in the bottom dock.
- Slimmed the rail (288px → **248px** desktop) so it's only as wide as needed.
- **Portrait/mobile:** the rail is a fixed **230px** overlay (capped to the
  viewport width) instead of stretching edge-to-edge.

## 3. Region filter added

- New **Region** filter group at the top of the rail, built from
  country-derived **macro-regions** (North America, Caribbean, Mexico & Central
  America, South America, Europe, Middle East, Africa, Asia, Oceania, Polar),
  shown in geographic order with counts.
  - Rationale: the raw `region` field is a ~600-way sub-national admin value
    (California, Toscana, …) — too granular for a checkbox list — and the
    `marqueeRegion` only covers ~25% of inventory.
- Wired into `matches()`, `resetFilters()`, `clearAllFilters()`, deep-link
  intake, and share URLs via a new `regions` parameter.

## 4. Search across hotel / city / town / region

- Autocomplete now returns **two grouped sections**:
  - **Cities, towns & regions** — distinct cities (town === city in this data)
    and sub-national regions, each with a stay count.
  - **Hotels** — matched by **name, city, or region** (ranked in that order),
    so a place query like "Aspen" surfaces every hotel there (e.g. *The Little
    Nell*), not just ones with the term in their name.
- Selecting a **hotel** opens its detail; selecting a **place** reflects it in
  the bar and cinematically frames the camera on all of its stays.

## 5. Scrollable search dropdown

- The dropdown is height-capped (`max-height: min(48vh, 288px)`, ~5–6 rows)
  with an **inner scroll** (touch momentum + `overscroll-behavior: contain` so
  it doesn't scroll the map).
- Per-section caps raised so there's more to scroll to: **hotels → 25**,
  **places → 12**.

## 6. Cinematic camera (tweened pan + zoom)

- Added `flyTo()` / `flyToFeatures()` helpers using the Maps 3D `flyCameraTo`
  easing, with a direct-set fallback for older builds.
- All camera moves are now smooth tweens instead of snaps: opening a hotel,
  jumping to a searched place, and framing a filtered result set.
- **Consistent framing across orientation:** result framing scales the
  east-west span by the **viewport aspect ratio**, so a set frames the same in
  portrait and landscape (on a tall/narrow screen the horizontal extent is the
  binding constraint).
- **No over-zoom / reveal all pins:** raised the minimum range (→ **9,000 m**)
  and padding factor (**2.6×**) so every result pin stays in view; dropped the
  old tight place-zoom floor.

## 7. Detail panel trimmed

- Removed everything between the rating badge and the address:
  - **Best Fit / Service Style** grid
  - The program/category/intent **tag chips**
- Cleaned up the now-unused markup, fill logic, and CSS.

## 8. Detail panel — as narrow as possible & fully visible

- **Desktop:** width 392px → **300px**.
- **Mobile:** changed from a full-width bottom sheet to a **~340px right-docked
  card**.
- **No inner scroll on mobile:** the card uses `height: auto` (sizes to its
  content) with a `max-height` tied to the space above the dock, so the whole
  panel is visible without scrolling for typical content and only
  clamps/scrolls in the rare overflow case.

## 9. Detail description cleanup

- The fit blurbs are stored prefixed with the property name
  (`The Little Nell: a city stay…`). Since the name is already the panel title
  (and to save vertical space on mobile), the description now **drops the name
  prefix** (up to the first `": "`) and **re-capitalizes** the remainder.
  - Verified across all 2,424 blurbs that the format is consistently
    `Property Name: a …`; the colon search is guarded to the first 90 chars so
    a future mid-sentence colon won't truncate the text.

---

## iOS / mobile fixes

### 16px input rule (focus zoom)
- Mobile Safari auto-zooms when focusing an input with `font-size < 16px`.
  Bumped the **search bar** (14.5px → **16px**) and the **Need Help** form
  inputs (13.5px → **16px**) to prevent the zoom — which was also reflowing the
  layout and letting Safari's toolbar cover the dock.

### Dock above Safari's dynamic toolbar
- Added a `--vvb` CSS variable, updated from JS via the **`visualViewport`
  API**, measuring the slice obscured by Safari's bottom URL toolbar
  (`innerHeight − visualViewport.height − offsetTop`).
- `--vvb` is added to the bottom offset of the **dock**, the **mobile detail
  panel**, and the **coach hint / share toast**, so they ride above the toolbar
  when it appears and settle back when it collapses.
- Guards: forced to `0` while a text field is focused (keyboard up — the dock is
  expected to sit beneath it), capped at `160px`, and a no-op on browsers
  without `visualViewport`.

---

## Commit reference

| Commit | Summary |
| --- | --- |
| `a7e6144` | Redesign search/filters: glass search bar, regions filter, cinematic camera |
| `1e1ce2a` | Tighten mobile layout and result framing |
| `e7e52a7` | Trim detail panel: drop Best Fit/Service Style grid and tag chips |
| `ee28e20` | Prevent iOS Safari focus zoom on inputs (16px rule) |
| `e7cc799` | Lift bottom dock above iOS Safari's dynamic toolbar |
| `fce76ea` | Size the mobile detail panel to its content (no inner scroll) |
| `137c9d5` | Match hotels by city/region in search, not just name |
| `216a3b4` | Make search dropdown scrollable instead of hard-capping results |
| `4e0d376` | Strip property name from detail description |
