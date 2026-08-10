# Implementation Plan: Horizontal-Mode Timeline View

Source spec: the original `timeline.md` (lived on `timeline-planning`, intentionally excluded from `master` — see that branch's copy for full background) named a horizontal layout under "Deferred, not rejected," and its later "Follow-ups" section restated it as a wanted next step. This plan scopes that follow-up: an analogous horizontal view of the existing `/timeline/` page, with every current feature preserved.

Decisions below were confirmed with Marta before writing this task list (see conversation):

- **Manual toggle, any viewport width** (not an automatic breakpoint switch) — a new "Orientation" control, same pattern as the existing "Bar scale" radio group.
- **Horizontal gets its own, shorter baseline length** (not a reuse of the vertical `BASELINE_TRACK_HEIGHT`, rotated) — tuned so the full bar fits a representative desktop width without horizontal scrolling.
- **Vertical is forced below a breakpoint** — the Orientation toggle is unavailable on narrow viewports, consistent with the original spec's stated reason vertical shipped first ("vertical becomes horizontal's mobile fallback").
- **This plan and its task list live only on the `timeline-horizontal` branch**, excluded from `master` at merge time — mirrors the `timeline-planning` precedent (`_config.yml`'s `exclude:` list already carries `tasks/` and `timeline.md` forward from that build, so no new exclude-list change is needed here).

## Overview

Add an "Orientation" toggle (Vertical / Horizontal) to the `/timeline/` widget. Horizontal mode rotates the whole widget 90°: the jobs bar runs left-to-right instead of top-to-bottom, publication cards sit above/below the bar instead of left/right, and every existing interaction (date-range filter, topic filter, first-author-only filter, proportional/compact bar-scale toggle, hover-to-see-date, dashed leader lines, dark-mode-reactive topic/job colors, keyboard operability) keeps working identically in both orientations. No data model changes, no new Liquid tags/layouts/data files — this is CSS + `assets/js/timeline.js` DOM-wiring work only.

## Architecture Decisions

- **The pure layout logic needs no changes.** `assets/js/timeline_mock_logic.js`'s `packCards`, `computeCompactPositions`, `dateToPosition`/`positionToDate`, `interpolateOnAxis`/`interpolateAxisInverse`, `computeJobSegments`, `clipSegmentsToRange`, and `filterPapers` all operate on abstract 1D "position" numbers and two alternating lane labels (`"left"`/`"right"`) — they don't know or care whether that position maps to a vertical `top` or a horizontal `left` pixel offset. This directly contradicts the original spec's stated worry that "horizontal needs real collision/packing logic" — it doesn't; that logic was already generic. `test/unit_timeline_mock_logic.js` needs no new cases unless a genuinely new pure computation shows up during implementation (e.g., a cross-axis sizing formula worth unit-testing on its own).
- **Lane relabeling happens only at the DOM/CSS layer.** `packCards`'s `"left"`/`"right"` output gets mapped to CSS classes `above`/`below` at render time when `orientation === "horizontal"`, rather than teaching the pure function new vocabulary. Keeps the tested module untouched and the mapping trivially inspectable in `timeline.js`.
- **All new work is CSS + `timeline.js` DOM wiring**: track/segment positioning, leader-line SVG coordinates, hover mouse-axis (`clientX` vs `clientY`), container sizing (which dimension is JS-driven vs CSS-fixed swaps between orientations), and new orientation-specific constants (baseline length, card along-axis/cross-axis extents). Nothing here needs a new `_layouts/`, `_includes/`, `_sass/`, or `_data/` file — stays within this repo's existing ownership per `AGENTS.md`.
- **No new automated visual-regression coverage.** The vertical build's own responsive verification (its Task 4.3) was a manual smoke check, not Playwright — the widget isn't in `test/visual/` today. Horizontal mode's verification mirrors that: manual checks at named breakpoints, not new `.spec.js` files. Revisit only if a real regression slips through undetected.
- **Breakpoint for forcing vertical: proposed 992px** (Bootstrap's `lg`, since al-folio is Bootstrap-based). This is a placeholder, not a hard requirement — Task 7 is where this gets confirmed/adjusted against how the horizontal layout actually looks at common in-between widths (1024px laptops, iPad landscape at 1024px, etc.).
- **Orientation choice does not persist across page loads** (resets to vertical default each visit), matching the existing bar-scale toggle's behavior (also non-persistent). Flagged in Open Questions in case Marta wants `localStorage` persistence later — small addition, deliberately not built now.
- **Show, don't just report, at every visualizable checkpoint** (added mid-build, per Marta's explicit instruction): whenever a task produces something that can be seen (a rendered bar, a card layout, a full page at a breakpoint), share an actual screenshot with Marta before moving on — not only pass/fail text or measured numbers. Applies for the rest of this plan's execution, not just the phase checkpoints already listed below.

## Task List

### Phase 1: Foundation (inert toggle + safe refactor)

- [x] **Task 1: Add the Orientation toggle control**
      **Description:** Add a "Orientation" `<fieldset>` to `_pages/timeline.md`'s controls area, styled and structured exactly like the existing "Bar scale" radio group (`Vertical` / `Horizontal`, `Vertical` checked by default). Wire a `orientation` state variable into `assets/js/timeline.js` with a change listener that updates the variable and calls `render()` — but `render()` itself doesn't yet branch on it, so this is a no-op change to visible output.
      **Acceptance criteria:**
  - [x] New fieldset renders in the controls area, matching the Bar-scale fieldset's markup/CSS pattern (legend, radio inputs, labels)
  - [x] Toggling it changes the underlying JS variable (verify via a temporary `console.log` or breakpoint) but produces zero visible change to the rendered page
  - [x] Every existing control (range inputs, topic checkboxes, first-author checkbox, bar-scale radios) still works exactly as before
        **Verification:**
  - [x] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [x] Manual: load `/timeline/`, toggle Orientation back and forth, confirm no visual change and no console errors
        **Dependencies:** None
        **Files likely touched:** `_pages/timeline.md`, `assets/css/timeline.css`, `assets/js/timeline.js`
        **Estimated scope:** S

- [x] **Task 2: Refactor vertical rendering behind an axis abstraction (no visual change)**
      **Description:** The highest-risk task in this plan. Introduce a small per-orientation config (e.g., an object providing which CSS properties/coordinate functions to use for track segments, card placement, hover position, and leader-line endpoints) and route `renderTrack`, `renderCards`, and the leader-line/hover code through it — but only ever instantiate the _vertical_ config for now. This is a pure refactor: vertical mode's rendered output must be pixel-identical before and after.
      **Acceptance criteria:**
  - [x] Every current vertical-mode behavior (bar striping, card packing/placement, leader lines, hover indicator/tooltip, compact/proportional toggle, all filters) is byte-for-byte visually unchanged
  - [x] `timeline_mock_logic.js` is untouched by this task
        **Verification:**
  - [x] `node test/unit_timeline_mock_logic.js` passes unchanged
  - [x] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [x] Manual: side-by-side comparison (screenshot or careful visual check) of `/timeline/` before and after this refactor at 375px, 762px, and 1440px — no detectable difference. Done for real with Playwright + pixelmatch, not just eyeballed: 0 differing pixels at all three widths.
        **Dependencies:** Task 1
        **Files likely touched:** `assets/js/timeline.js`
        **Estimated scope:** M

### Checkpoint: Foundation

- [x] `node test/unit_timeline_mock_logic.js` and `bundle exec jekyll build --baseurl /al-folio` both pass
- [x] Vertical mode is confirmed unchanged; Orientation toggle exists but is inert
- [x] Review with Marta before proceeding to horizontal rendering

### Phase 2: Horizontal bar (no cards yet)

- [x] **Task 3: Horizontal track, striping, and hover**
      **Description:** Add the horizontal CSS variants (track runs left-to-right at vertical-center, segments use `left`/`width` instead of `top`/`height`, hover-zone spans the bar's full width, hover indicator becomes a vertical marker, tooltip repositions above/below instead of beside). Wire `orientation === "horizontal"` through `renderTrack` and the hover `mousemove` handler (use `clientX` instead of `clientY`, invert axis lookups accordingly). Card rendering can be temporarily skipped/hidden for this task.
      **Real bug caught by measurement, not reasoning:** `.timeline-track-segment` had no cross-axis fill rule for horizontal — height resolved to 0 (Playwright `boundingBox()` caught it directly). Fixed with a horizontal-specific `height: 100%` rule.
      **Acceptance criteria:**
  - [x] Selecting Horizontal renders a left-to-right bar with correct job-color segments and correct 45° overlap striping
  - [x] Hovering along the horizontal bar shows the correct date in the tooltip, positioned sensibly relative to the cursor
  - [x] Switching back to Vertical restores the exact Task-2 behavior
        **Verification:**
  - [x] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [x] Manual: at 1440px, verify bar orientation, striping at the one known overlap period, and hover tooltip accuracy against a couple of known dates
        **Dependencies:** Task 2
        **Files likely touched:** `assets/css/timeline.css`, `assets/js/timeline.js`
        **Estimated scope:** M

- [x] **Task 4: Horizontal-specific baseline length and compact-axis pitch**
      **Description:** Give horizontal mode its own length constants (distinct from `BASELINE_TRACK_HEIGHT`) for both proportional and compact bar-scale modes, tuned against the real 5-job/28-paper dataset so the full bar fits within a representative desktop width (~1440px, inside the page's content column) without horizontal overflow/scrolling.
      **Sizing conflict discovered and resolved with Marta:** the real dataset has 22 distinct paper dates. Keeping cards at a legible width (~150px, matching vertical) needs `pitch ≈ 160px` in compact mode → a ~3360px bar, far past any no-scroll budget; proportional mode has the same problem locally wherever papers cluster (7 papers in 2025 alone). Asked Marta to choose between (a) allowing horizontal scroll, (b) shrinking cards drastically to fit, or (c) grouping compact-mode by year instead of exact date. **Chosen: (b), shrink cards** — horizontal cards become small always-visible markers, with full title/venue/topics revealed on hover/focus instead of always shown. This changes Task 5's scope (see below) beyond the original "just port the vertical card sideways" plan.
      **Second discovery, also caught by measurement:** an initial attempt widened `.timeline-wrapper`'s max-width to 1200px for horizontal, and initial constants (`CARD_MAIN_EXTENT_HORIZONTAL=36`, gap `8`, baseline `950`) were tuned against that 1200px budget. Measuring the actual rendered ancestor chain showed the 1200px override was inert — the page's own Bootstrap content column caps the wrapper at ~900-930px regardless, and the bar only "fit" at 1440px by bleeding unclipped into the column's side margins, not because it was genuinely contained (would have broken at other widths/margins). Removed the inert override and retuned against the real ~900px column instead.
      **Constants actually shipped**, verified against the real dataset with a Node script running the unchanged `timeline_mock_logic.js` functions: `CARD_MAIN_EXTENT_HORIZONTAL = 28`, `CARD_MIN_GAP_HORIZONTAL = 6` (pitch 34), `HORIZONTAL_BASELINE_TRACK_WIDTH = 760`. Resulting required width (packed content + padding): compact mode ~782px, proportional mode ~877px — both under the real ~900px column width, confirmed by Playwright measuring `track width <= wrapper width` (not just "no page-level scrollbar," which the first attempt had falsely passed) at both 992px and 1440px viewports.
      **Also fixed while verifying:** `renderCards` was skipping the container's own resize call in horizontal mode (bundled with the cards it was also skipping), leaving a _stale_ inline height from whatever vertical had last rendered — the bar rendered correctly shaped but ~2000px down a nearly-empty page. Moved the container resize above the horizontal early-return so it always runs.
      **Acceptance criteria:**
  - [x] At 1440px viewport width, horizontal mode's bar (both Proportional and Compact) renders with no horizontal overflow or scrollbar
  - [x] Switching bar-scale mode while horizontal re-renders correctly, same as vertical already does
        **Verification:**
  - [x] Manual: resized to 992px and 1440px, cycled both bar-scale options in horizontal mode with the full (unfiltered) date range showing all 28 papers (the worst case — the page's own default filtered view undercounts), confirmed the track genuinely fits inside its own wrapper box, not just "no page scrollbar." Screenshot shown to Marta.
  - [x] Node spot-check against the real built dataset (not synthetic data): computed required width for both modes at the chosen constants, confirmed both land under the ~900px real column budget with margin
        **Dependencies:** Task 3
        **Files likely touched:** `assets/js/timeline.js`
        **Estimated scope:** S

### Checkpoint: Horizontal bar

- [x] Horizontal bar (no cards) renders correctly at desktop width, both scale modes, hover works
- [x] Review with Marta before proceeding to card placement

### Phase 3: Horizontal cards and leader lines

- [x] **Task 5: Card placement above/below the horizontal bar (compact marker + hover/focus-expand)**
      **Description:** Reuse `packCards` unchanged; map its `"left"`/`"right"` output to CSS classes `above`/`below` at render time when horizontal, using Task 4's `CARD_MAIN_EXTENT_HORIZONTAL`/`CARD_MIN_GAP_HORIZONTAL` for packing. Per the sizing-conflict resolution in Task 4, the always-visible card is a small marker (28x24px, 2-digit year), color-coded by topic like today's card border. On `:hover`/`:focus`, an absolutely-positioned `.timeline-card-detail` overlay expands from the marker to show the same content as a vertical card (title, venue, topic pills, first-author star) at a normal legible width, elevated `z-index`, growing outward from the bar. Markers get `tabindex="0"` (horizontal only) so the expand-on-focus path is keyboard-reachable. `aria-label` content is unchanged.
      **Acceptance criteria:**
  - [x] Compact markers render above/below the bar with zero same-lane overlap (mirrors `packCards`'s existing collision guarantee)
  - [x] Hovering or focusing a marker reveals the full card content (title, venue, topics, first-author star), legible and unclipped, without shifting any other marker's position
  - [x] Keyboard-only navigation (Tab) can reach and expand every marker
        **Verification:**
  - [x] `node test/unit_timeline_mock_logic.js` passes unchanged (no logic touched, only new CSS constants/classes in `timeline.js`)
  - [x] Manual (Playwright): all 28 markers rendered (14 above / 14 below), 0 overlapping pairs in either lane, confirmed programmatically from real bounding boxes, not eyeballed. Hovered the true leftmost/rightmost markers (by actual x position, not DOM order) — both detail overlays stay within the 1440px viewport, no clipping. Keyboard focus (no mouse) also reveals the detail. Screenshots shown to Marta.
        **Dependencies:** Task 4
        **Files likely touched:** `assets/css/timeline.css`, `assets/js/timeline.js`
        **Estimated scope:** M

- [x] **Task 6: Leader lines in horizontal mode**
      **Description:** Swap the SVG leader-line coordinate calculation: card's top/bottom edge (X, Y) to the bar's date-position (X, Y), instead of the vertical mode's left/right-edge-to-bar-Y calculation.
      **Turned out to need zero code changes.** Task 2's `axisPoint`/`cardCrossEdge` geometry was already written generically (deriving both branches at once was cheap once the vertical math was worked out) and Task 5 already exercises it just by removing the horizontal early-return. This task was pure verification.
      **Acceptance criteria:**
  - [x] Every visible card has a dashed line connecting it to the correct point on the horizontal bar
        **Verification:**
  - [x] Playwright, not manual spot-check: compared every line's (x1,y1) endpoint against its own card's actual bounding-box center/edge for all 28 cards — 0 mismatches (>1px tolerance).
        **Dependencies:** Task 5
        **Files likely touched:** `assets/js/timeline.js`
        **Estimated scope:** S

### Checkpoint: Horizontal mode functionally complete

- [x] At desktop width: bar, cards, leader lines, hover, both scale modes all work in horizontal mode
- [x] All existing filters (date range, topic, first-author-only) still combine correctly (AND) in horizontal mode — verified with Playwright: 28 → 22 (topic) → 14 (+ first-author) → 11 (+ narrowed range) → 22 (Reset), matching expected AND narrowing at each step
- [x] Review with Marta before the responsive/accessibility passes

### Phase 4: Responsive integration

- [x] **Task 7: Force vertical below a breakpoint**
      **Description:** Below 992px (kept the Architecture Decisions placeholder as-is), hide the Orientation fieldset and force vertical rendering even if Horizontal was previously selected. Restore the user's last choice when the viewport widens back past the breakpoint. Implemented via a `selectedOrientation` (raw radio choice) separate from `orientation` (effective, breakpoint-forced value) and one `applyOrientationForViewport()` helper called on load, on orientation change, and on resize.
      **Acceptance criteria:**
  - [x] Resizing a horizontal-mode window below the breakpoint snaps to vertical and hides the toggle
  - [x] Widening back past the breakpoint restores horizontal without the user re-toggling
        **Verification:**
  - [x] Playwright: loaded at 768px directly (hidden, forced vertical); selected Horizontal at 1440px, resized to 768px (hidden, forced vertical, radio still reads "horizontal" underneath), resized back to 1440px (toggle reappears, horizontal restored automatically); boundary-checked 991px vs 992px directly. Screenshot of the hidden toggle at 768px shown to Marta.
        **Dependencies:** Task 6
        **Files likely touched:** `assets/js/timeline.js`, `assets/css/timeline.css`
        **Estimated scope:** S

- [x] **Task 8: Resize-recompute for horizontal geometry**
      **Description:** Extend the existing debounced `resize` listener to also recompute horizontal's geometry and re-render, so a live window resize doesn't leave stale horizontal geometry.
      **Turned out to need no new code, verified rather than assumed.** Unlike vertical's `CARD_HEIGHT`, horizontal's constants (`CARD_MAIN_EXTENT_HORIZONTAL`/`CARD_MIN_GAP_HORIZONTAL`/`HORIZONTAL_BASELINE_TRACK_WIDTH`) are fixed, not viewport-width-dependent — there's nothing for a resize to recompute. Checked empirically (not assumed) that `.timeline-wrapper` stays exactly 900px across the entire viable horizontal range (992px through 1920px tested) — the page's own container never gets narrower right at the breakpoint boundary, the specific risk this plan's own Risks table flagged. The pre-existing resize listener (already calls `setupCompactLayout()`+`render()` unconditionally) plus Task 7's `applyOrientationForViewport()` already cover everything that does change on resize.
      **Acceptance criteria:**
  - [x] Live-resizing the window while in horizontal mode keeps cards non-overlapping and leader lines attached (no stale geometry)
        **Verification:**
  - [x] Playwright live resize (not a fresh page load per width): 1440px → 1024px → 1440px, 0 overlaps at every step, 0 leader-line attachment mismatches after the cycle
        **Dependencies:** Task 7
        **Files likely touched:** `assets/js/timeline.js`
        **Estimated scope:** S

### Checkpoint: Responsive integration

- [x] Orientation behaves correctly across the full responsive range with no stale geometry after resize
- [x] Review with Marta before the accessibility/verification pass

### Phase 5: Accessibility and verification

- [x] **Task 9: Accessibility pass on the new control**
      **Description:** Confirm the Orientation `<fieldset>`/`<legend>` matches the Bar-scale pattern exactly (screen-reader announced, keyboard-operable via native radios). Confirm horizontal-mode cards keep identical `aria-label` content. Confirm no new hardcoded (non-`--global-*`/non-topic-`var()`) color crept into the horizontal-specific CSS.
      **Acceptance criteria:**
  - [x] Orientation toggle is keyboard-operable and screen-reader-announced, consistent with Bar-scale
  - [x] Card `aria-label` content is identical in both orientations
  - [x] No new non-token color introduced by horizontal-specific CSS
        **Verification:**
  - [x] Markup diffed against Bar-scale's fieldset/legend/label structure — identical pattern. `grep` for hex/rgb in `timeline.css` found exactly one hit, pre-existing (`.timeline-topic-pill`'s documented JS-overridden fallback, not new, not horizontal-specific). Playwright: the 22 `aria-label` strings collected in vertical mode and in horizontal mode are the exact same set (sorted-array equality, not eyeballed); Tab from the Orientation radio lands on the first horizontal card marker; all 22 horizontal markers have `tabIndex === 0`, all vertical cards stay at the default `-1` (unchanged, not newly tabbable).
        **Dependencies:** Task 8
        **Files likely touched:** `assets/css/timeline.css` (review only, likely no changes)
        **Estimated scope:** XS

- [x] **Task 10: Responsive smoke check across real breakpoints**
      **Description:** Mirror the vertical build's own Task 4.3 methodology — actually resize a real/emulated browser rather than reasoning about the CSS abstractly. Check 375px (forced vertical), the Task 7 breakpoint boundary from both sides, and 1440px (horizontal).
      **Unlike the original Task 4.3, this pass found zero new bugs** — the three real bugs this feature did have (`.timeline-track-segment` height:0, the inert 1200px wrapper override, the stale container height) were already caught and fixed during Tasks 3-4's own Playwright verification, not deferred to a final pass.
      **Acceptance criteria:**
  - [x] No clipping, overlap, or overflow at any checked width
        **Verification:**
  - [x] Playwright across 375/600/762/850/991/992/1024/1440px: `document.documentElement.scrollWidth <= viewportWidth` at every one (checked programmatically, not eyeballed) plus a full-page screenshot at each. Also checked dark mode at 375px (vertical) and 1440px (horizontal, with a card hover-expanded) — theme-reactive colors work correctly for the new marker/detail elements, no contrast or rendering issues. Screenshots shown to Marta throughout.
        **Dependencies:** Task 9
        **Files likely touched:** none (verification found nothing to fix)
        **Estimated scope:** S

### Checkpoint: Feature complete

- [x] All acceptance criteria above met
- [x] Ready for Marta's final review

### Phase 6: Merge

- [ ] **Task 11: Merge to master, planning docs excluded**
      **Description:** Merge `timeline-horizontal` into `master`, mirroring the `timeline-planning` precedent — `tasks/plan.md` and `tasks/todo.md` stay off `master`, only the feature code merges.
      **Acceptance criteria:**
  - [ ] `master` gains the horizontal-mode feature; `tasks/` is not present in the merged history's tree
  - [ ] `bundle exec jekyll build --baseurl /al-folio` output has no `tasks/` under `_site/` (already guaranteed by the existing `_config.yml` exclude list, reconfirm rather than assume)
        **Verification:**
  - [ ] Post-merge: `git show <merge-commit> --stat` contains no `tasks/` entries
        **Dependencies:** Task 10, Marta's sign-off
        **Files likely touched:** none (merge only)
        **Estimated scope:** XS

## Risks and Mitigations

| Risk                                                                                  | Impact | Mitigation                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 2's axis-abstraction refactor subtly changes vertical mode's output              | High   | Isolated task, done before any horizontal code exists; explicit visual comparison at 3 widths before proceeding                                       |
| Horizontal baseline tuning looks fine at 1440px but overflows near the 992px boundary | Medium | Task 10's smoke check explicitly includes the boundary from both sides, not just 1440px                                                               |
| Real paper titles/venues don't fit legibly in a narrower horizontal card              | Medium | Tune card cross-axis extent empirically against the real 28-paper dataset (Task 5), same iterative approach the original build used for `CARD_HEIGHT` |
| Scope creep into automated Playwright coverage                                        | Low    | Explicitly out of scope per Architecture Decisions; matches existing precedent for this widget                                                        |

## Open Questions

- Is 992px the right "force vertical" breakpoint? Proposed as a starting point in Architecture Decisions; Task 7 is where this gets confirmed against how the layout actually looks at in-between widths (1024px laptops, tablet landscape, etc.).
- Should Orientation choice persist across page loads (`localStorage`)? Currently planned as non-persistent, matching the existing Bar-scale toggle. Flag for a follow-up if wanted.
- (Carried over, unrelated to this plan) Awards/scholarships layer from the original spec — still open, not touched here.
