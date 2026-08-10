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

## Task List

### Phase 1: Foundation (inert toggle + safe refactor)

- [ ] **Task 1: Add the Orientation toggle control**
  **Description:** Add a "Orientation" `<fieldset>` to `_pages/timeline.md`'s controls area, styled and structured exactly like the existing "Bar scale" radio group (`Vertical` / `Horizontal`, `Vertical` checked by default). Wire a `orientation` state variable into `assets/js/timeline.js` with a change listener that updates the variable and calls `render()` — but `render()` itself doesn't yet branch on it, so this is a no-op change to visible output.
  **Acceptance criteria:**
  - [ ] New fieldset renders in the controls area, matching the Bar-scale fieldset's markup/CSS pattern (legend, radio inputs, labels)
  - [ ] Toggling it changes the underlying JS variable (verify via a temporary `console.log` or breakpoint) but produces zero visible change to the rendered page
  - [ ] Every existing control (range inputs, topic checkboxes, first-author checkbox, bar-scale radios) still works exactly as before
  **Verification:**
  - [ ] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [ ] Manual: load `/timeline/`, toggle Orientation back and forth, confirm no visual change and no console errors
  **Dependencies:** None
  **Files likely touched:** `_pages/timeline.md`, `assets/css/timeline.css`, `assets/js/timeline.js`
  **Estimated scope:** S

- [ ] **Task 2: Refactor vertical rendering behind an axis abstraction (no visual change)**
  **Description:** The highest-risk task in this plan. Introduce a small per-orientation config (e.g., an object providing which CSS properties/coordinate functions to use for track segments, card placement, hover position, and leader-line endpoints) and route `renderTrack`, `renderCards`, and the leader-line/hover code through it — but only ever instantiate the *vertical* config for now. This is a pure refactor: vertical mode's rendered output must be pixel-identical before and after.
  **Acceptance criteria:**
  - [ ] Every current vertical-mode behavior (bar striping, card packing/placement, leader lines, hover indicator/tooltip, compact/proportional toggle, all filters) is byte-for-byte visually unchanged
  - [ ] `timeline_mock_logic.js` is untouched by this task
  **Verification:**
  - [ ] `node test/unit_timeline_mock_logic.js` passes unchanged
  - [ ] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [ ] Manual: side-by-side comparison (screenshot or careful visual check) of `/timeline/` before and after this refactor at 375px, 762px, and 1440px — no detectable difference
  **Dependencies:** Task 1
  **Files likely touched:** `assets/js/timeline.js`
  **Estimated scope:** M

### Checkpoint: Foundation
- [ ] `node test/unit_timeline_mock_logic.js` and `bundle exec jekyll build --baseurl /al-folio` both pass
- [ ] Vertical mode is confirmed unchanged; Orientation toggle exists but is inert
- [ ] Review with Marta before proceeding to horizontal rendering

### Phase 2: Horizontal bar (no cards yet)

- [ ] **Task 3: Horizontal track, striping, and hover**
  **Description:** Add the horizontal CSS variants (track runs left-to-right at vertical-center, segments use `left`/`width` instead of `top`/`height`, hover-zone spans the bar's full width, hover indicator becomes a vertical marker, tooltip repositions above/below instead of beside). Wire `orientation === "horizontal"` through `renderTrack` and the hover `mousemove` handler (use `clientX` instead of `clientY`, invert axis lookups accordingly). Card rendering can be temporarily skipped/hidden for this task.
  **Acceptance criteria:**
  - [ ] Selecting Horizontal renders a left-to-right bar with correct job-color segments and correct 45° overlap striping
  - [ ] Hovering along the horizontal bar shows the correct date in the tooltip, positioned sensibly relative to the cursor
  - [ ] Switching back to Vertical restores the exact Task-2 behavior
  **Verification:**
  - [ ] `bundle exec jekyll build --baseurl /al-folio` succeeds
  - [ ] Manual: at 1440px, verify bar orientation, striping at the one known overlap period, and hover tooltip accuracy against a couple of known dates
  **Dependencies:** Task 2
  **Files likely touched:** `assets/css/timeline.css`, `assets/js/timeline.js`
  **Estimated scope:** M

- [ ] **Task 4: Horizontal-specific baseline length and compact-axis pitch**
  **Description:** Give horizontal mode its own length constants (distinct from `BASELINE_TRACK_HEIGHT`) for both proportional and compact bar-scale modes, tuned against the real 5-job/28-paper dataset so the full bar fits within a representative desktop width (~1440px, inside the page's content column) without horizontal overflow/scrolling.
  **Acceptance criteria:**
  - [ ] At 1440px viewport width, horizontal mode's bar (both Proportional and Compact) renders with no horizontal overflow or scrollbar
  - [ ] Switching bar-scale mode while horizontal re-renders correctly, same as vertical already does
  **Verification:**
  - [ ] Manual: resize to 1440px, cycle both bar-scale options in horizontal mode, confirm no overflow
  - [ ] Node spot-check (as the original build did for its own scale addenda): compute `pos(maxTime)`/`compactPos` for the real dataset against the new constants and confirm they land within the intended pixel budget
  **Dependencies:** Task 3
  **Files likely touched:** `assets/js/timeline.js`
  **Estimated scope:** S

### Checkpoint: Horizontal bar
- [ ] Horizontal bar (no cards) renders correctly at desktop width, both scale modes, hover works
- [ ] Review with Marta before proceeding to card placement

### Phase 3: Horizontal cards and leader lines

- [ ] **Task 5: Card placement above/below the horizontal bar**
  **Description:** Reuse `packCards` unchanged; map its `"left"`/`"right"` output to CSS classes `above`/`below` at render time when horizontal. Add `.timeline-card.above`/`.timeline-card.below` CSS (positioned via `bottom`/`top` offsets from the bar's vertical center, mirroring the existing `left`/`right` `calc()` pattern). Add new along-axis/cross-axis card size constants tuned for a narrower, taller card shape; verify real paper titles/venues stay legible and unclipped.
  **Acceptance criteria:**
  - [ ] Cards render above/below the bar with zero same-lane overlap (mirrors `packCards`'s existing collision guarantee)
  - [ ] Title (2-line clamp), venue (1-line ellipsis + hover title), and topic pills all remain legible, not clipped, at the new card dimensions
  **Verification:**
  - [ ] `node test/unit_timeline_mock_logic.js` passes unchanged (no logic touched, only new CSS constants/classes in `timeline.js`)
  - [ ] Manual: at 1440px, visually confirm zero overlap across the real 28-paper dataset in both bar-scale modes, spot-check a few long titles/venues
  **Dependencies:** Task 4
  **Files likely touched:** `assets/css/timeline.css`, `assets/js/timeline.js`
  **Estimated scope:** M

- [ ] **Task 6: Leader lines in horizontal mode**
  **Description:** Swap the SVG leader-line coordinate calculation: card's top/bottom edge (X, Y) to the bar's date-position (X, Y), instead of the vertical mode's left/right-edge-to-bar-Y calculation.
  **Acceptance criteria:**
  - [ ] Every visible card has a dashed line connecting it to the correct point on the horizontal bar
  **Verification:**
  - [ ] Manual: spot-check 3-4 cards with known dates against where their leader line lands on the bar
  **Dependencies:** Task 5
  **Files likely touched:** `assets/js/timeline.js`
  **Estimated scope:** S

### Checkpoint: Horizontal mode functionally complete
- [ ] At desktop width: bar, cards, leader lines, hover, both scale modes all work in horizontal mode
- [ ] All existing filters (date range, topic, first-author-only) still combine correctly (AND) in horizontal mode — explicitly re-verify here since this is the first point everything combines
- [ ] Review with Marta before the responsive/accessibility passes

### Phase 4: Responsive integration

- [ ] **Task 7: Force vertical below a breakpoint**
  **Description:** Below the chosen width (992px placeholder, per Architecture Decisions — confirm/adjust here against how it actually looks at common in-between widths), hide/disable the Orientation toggle and force vertical rendering even if Horizontal was previously selected. Restore the user's last choice when the viewport widens back past the breakpoint.
  **Acceptance criteria:**
  - [ ] Resizing a horizontal-mode window below the breakpoint snaps to vertical and hides/disables the toggle
  - [ ] Widening back past the breakpoint restores horizontal without the user re-toggling
  **Verification:**
  - [ ] Manual: drag-resize across the breakpoint in both directions
  **Dependencies:** Task 6
  **Files likely touched:** `assets/js/timeline.js`, `assets/css/timeline.css`
  **Estimated scope:** S

- [ ] **Task 8: Resize-recompute for horizontal geometry**
  **Description:** Extend the existing debounced `resize` listener (currently recomputes `CARD_HEIGHT` and vertical compact layout for the narrow-viewport case) to also recompute horizontal's card-size/baseline constants and re-render, so a live window resize doesn't leave stale horizontal geometry — the exact bug class the vertical build already guards against for its own narrow-viewport case.
  **Acceptance criteria:**
  - [ ] Live-resizing the window while in horizontal mode keeps cards non-overlapping and leader lines attached (no stale geometry)
  **Verification:**
  - [ ] Manual: slow drag-resize from 1440px down to the Task 7 breakpoint and back, in horizontal mode
  **Dependencies:** Task 7
  **Files likely touched:** `assets/js/timeline.js`
  **Estimated scope:** S

### Checkpoint: Responsive integration
- [ ] Orientation behaves correctly across the full responsive range with no stale geometry after resize
- [ ] Review with Marta before the accessibility/verification pass

### Phase 5: Accessibility and verification

- [ ] **Task 9: Accessibility pass on the new control**
  **Description:** Confirm the Orientation `<fieldset>`/`<legend>` matches the Bar-scale pattern exactly (screen-reader announced, keyboard-operable via native radios). Confirm horizontal-mode cards keep identical `aria-label` content (already text-based, geometry-independent — should need no change, verify rather than assume). Confirm no new hardcoded (non-`--global-*`/non-topic-`var()`) color crept into the horizontal-specific CSS.
  **Acceptance criteria:**
  - [ ] Orientation toggle is keyboard-operable and screen-reader-announced, consistent with Bar-scale
  - [ ] Card `aria-label` content is identical in both orientations
  - [ ] No new non-token color introduced by horizontal-specific CSS
  **Verification:**
  - [ ] Manual: keyboard-only pass (Tab/Arrow keys) through the new control; spot-check a card's `aria-label` in both orientations
  **Dependencies:** Task 8
  **Files likely touched:** `assets/css/timeline.css` (review only, likely no changes)
  **Estimated scope:** XS

- [ ] **Task 10: Responsive smoke check across real breakpoints**
  **Description:** Mirror the vertical build's own Task 4.3 methodology — actually resize a real/emulated browser rather than reasoning about the CSS abstractly, since that task found three real bugs this way. Check 375px (forced vertical), the Task 7 breakpoint boundary from both sides, and 1440px (horizontal).
  **Acceptance criteria:**
  - [ ] No clipping, overlap, or overflow at any checked width
  **Verification:**
  - [ ] Manual smoke check, findings (if any) fixed before moving on
  **Dependencies:** Task 9
  **Files likely touched:** TBD (whatever the smoke check finds)
  **Estimated scope:** S

### Checkpoint: Feature complete
- [ ] All acceptance criteria above met
- [ ] Ready for Marta's final review

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

| Risk | Impact | Mitigation |
|------|--------|------------|
| Task 2's axis-abstraction refactor subtly changes vertical mode's output | High | Isolated task, done before any horizontal code exists; explicit visual comparison at 3 widths before proceeding |
| Horizontal baseline tuning looks fine at 1440px but overflows near the 992px boundary | Medium | Task 10's smoke check explicitly includes the boundary from both sides, not just 1440px |
| Real paper titles/venues don't fit legibly in a narrower horizontal card | Medium | Tune card cross-axis extent empirically against the real 28-paper dataset (Task 5), same iterative approach the original build used for `CARD_HEIGHT` |
| Scope creep into automated Playwright coverage | Low | Explicitly out of scope per Architecture Decisions; matches existing precedent for this widget |

## Open Questions

- Is 992px the right "force vertical" breakpoint? Proposed as a starting point in Architecture Decisions; Task 7 is where this gets confirmed against how the layout actually looks at in-between widths (1024px laptops, tablet landscape, etc.).
- Should Orientation choice persist across page loads (`localStorage`)? Currently planned as non-persistent, matching the existing Bar-scale toggle. Flag for a follow-up if wanted.
- (Carried over, unrelated to this plan) Awards/scholarships layer from the original spec — still open, not touched here.
