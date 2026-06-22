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

---
---

# Mobile UX batch — bottom-sheet filters · bottom-drawer details · loader/error polish

**Applied to this repo's `index.html`, 2026-06-22.** Full copy-paste code for porting to the other
atlases (Cruise / Yacht / Jet / Expedition) lives alongside this file in
**`mobile-ux-bottom-sheets-porting-guide.md`** — that has the exact markup/CSS/JS blocks and a
per-atlas adaptation table; this section is the prose summary.

> **This batch supersedes the mobile portions of §2 and §8 above.**
> §2/§8 made mobile **filters** a narrow 230px overlay and the mobile **detail panel** a ~340px
> right-docked card. This batch replaces both with **full-width bottom sheets/drawers** (Google Maps /
> Airbnb pattern), re-integrating the existing iOS Safari `--vvb`/safe-area handling into the new chrome.
> The desktop layout (left rail + right slide-in panel) is unchanged. When porting to the other atlases,
> ship **either** the right-docked cards (§2/§8) **or** the bottom sheets/drawers (this batch) — not both.

> **Chromium note (learned during this port):** `height` transitions between `dvh` units stall, so the
> drawer's teaser↔expanded snap changes `height` **instantly** (no transition on `height`); only the
> `transform` slide is animated. The scrim is toggled by a single `.show` class (opacity + pointer-events),
> not by adding/removing the `hidden` attribute — the attribute dance raced with the MutationObserver.

## 0. Pre-flight bug fix — missing `</script>` (check every atlas)

- The dock-controls `<script>` was **never closed**, so the browser swallowed the entire Need-Help modal
  (`<style>` + markup + its `<script>`) as raw script text — a syntax error that **silently killed both
  the dock pills and the Need-Help modal**.
- Detect with a tag-balance check (`grep -c '<script'` vs `grep -c '</script>'`); fix by inserting the
  `</script>` after the dock IIFE's `})();`. **Run this on every atlas before porting** — the mobile JS
  depends on the dock script actually executing.

## 1. Dock observer fix — closing details no longer springs filters open

- The panel observer did `railCollapsed = open` on every change, so **dismissing** a hotel re-opened the
  filters. Changed to only collapse-on-open (`if(mq.matches && open && !railCollapsed) …`), never
  auto-open on close. Tolerable as a top overlay; jarring once filters became a bottom sheet.

## 2. Filters → bottom sheet (mobile)

- The filter rail slides up from the bottom as a true **bottom sheet** (rounded top, drag handle,
  dimming scrim) instead of floating at the top of the map.
- A sticky gold **"Show N stays"** footer button mirrors the live `#count` in real time and dismisses the
  sheet on tap; **swipe-down** on the handle/header also dismisses; tapping the scrim closes it.
- Desktop unchanged (left rail, `position:absolute`); the new handle/footer are `display:none` off-mobile.

## 3. Details → bottom drawer with snap points (mobile)

- The detail panel becomes a **bottom drawer** with two snaps: **teaser ~52vh** on open, **expanded ~92vh**.
  Drag the handle up to expand, down to collapse to teaser, down again to dismiss.
- Full-width gold "Book … online →" CTA retained. Desktop keeps the square right-side slide-in.

## 4. Loading polish — progress bar + branded skeleton

- Added a **determinate progress bar** (`#loadFill`) driven by a `setProgress(pct,msg)` helper, stepped
  through `init()` stages (Connecting → Authorizing → Rendering terrain → Placing stays → Welcome).
- Added a **gold-shimmer skeleton** behind the loader so the screen reads as "loading", not "broken".

## 5. Friendly error state (no API-key jargon for end users)

- Replaced the raw "Add your Google Maps key" veil with **"The Atlas is taking a moment"** + **Refresh**
  and **Contact concierge** actions. The technical key/Vercel setup is tucked behind a collapsible
  **"Setup details"** `<details>` so developers keep it but guests never see it.

---

## Per-atlas porting checklist

- [ ] §0 tag-balance check passes (`script-open == script-close`, `style-open == style-close`).
- [ ] Decide mobile model: **bottom sheets/drawers (this batch)** vs **right-docked cards (§2/§8)**.
- [ ] Confirm hooks exist / rename: `railPill`, `panelPill`, `#count`, `rail`, `panel`, `veil`.
- [ ] Adapt copy: the "**stays**" noun, loader stage strings, error mailto + wording.
- [ ] Verify at 390px: loader bar+skeleton → friendly error → filters sheet (live count, swipe) →
      details drawer (teaser/expand/dismiss, filters don't pop open) → desktop unaffected.
