# Implementation Plan: Career Timeline Page

Source spec: [`timeline.md`](../timeline.md) (refined via `idea-refine` — see that file for the full rationale behind orientation, audience, and scope decisions).

## Overview

Add a new `/timeline/` page: a vertical, interactive milestone timeline. A single jobs bar (from `_data/cv.yml`) runs top-to-bottom, color-coded by employer, with 45°-intertwined stripes where two jobs overlap. Publication cards (from `_bibliography/papers.bib`) sit to the left/right, linked to their date by a dashed leader, color-coded by topic tag, filterable by date range (month granularity) and by topic. Fully automatic: no new hand-maintained timeline data file — jobs and papers come from data already maintained today, plus two new small additions to that existing data (a `topic` field per paper, a `month` field per paper).

## Architecture Decisions

- **Vertical layout, all screen sizes, v1.** Decided in `timeline.md` — cheapest to build correctly (card non-overlap is free from block stacking; no horizontal-scroll/breakpoint work). Horizontal-desktop is explicitly deferred, not cut — see `timeline.md`'s "Deferred, not rejected".
- **Mock-first, real-data-second.** `timeline.md`'s own "Before starting" list asks for a fake-data mock before the tagging work. Honored here: Phase 1 builds and gets sign-off on the visual/interaction design with hardcoded fake data; Phase 2 does the (nontrivial) real-data tagging work; Phase 3 only then wires them together. This avoids tagging 28 papers before knowing the visual design actually works.
- **Paper data extraction goes through a local `_layouts/` override, not a new `_plugins/` bib parser.** Investigated `jekyll-scholar` (v7.3.0, installed) source directly: the `{% bibliography %}` tag renders each entry through a Liquid template resolved via `site.layouts.key?(tmp)` — i.e. a real `_layouts/<name>.html` file — and that template gets the entry "liquidified," so **any custom bib field (including a new `topic` field) is already accessible as `entry.topic`** with zero new Ruby code. This is the sanctioned jekyll-scholar extension point (custom bibliography templates), not new citation-parsing logic, so it doesn't collide with `docs/BOUNDARIES.md`'s "citations → al_citations/jekyll-scholar" ownership rule.
  - This repo currently ships a copy of the **al-folio starter's own** `test/style_contract.js`, which fails the build if `_layouts/`, `_includes/`, or `_sass/` exist *anywhere in the repo*. `docs/ARCHITECTURE.md` and `docs/BOUNDARIES.md` both explicitly confirm local overrides are legal **in a user's own site** (this repo) and that this exact false-positive is a known, deliberately-unfixed gap in the copied check ("Whether to re-scope that check... is an open maintainer decision; it is deliberately unchanged here"). Task 2.1 below adjusts our copy of that check accordingly — this is expected, sanctioned maintenance of our own fork, not a workaround.
- **Data island pattern for JS.** The custom `_layouts/timeline_pub_entry.html` template emits one JSON object per `<li>` (jekyll-scholar always wraps entries in `<ol class="...">`/`<li>` — confirmed in source, not configurable away). The timeline page embeds this list hidden (`display:none`), and JS does `querySelectorAll('li')` + `JSON.parse(textContent)` per item, rather than fighting the gem for a raw JSON array. Jobs data needs no such trick — it's plain `_data/cv.yml`, loop it directly with `| jsonify` into a second hidden data island.
- **No new charting dependency.** `_config.yml` already pins d3, Chart.js, Plotly, and Vega as available third-party libraries. Given the fully custom interaction (leader lines, card packing, diagonal job-overlap stripes), plain SVG + vanilla JS is likely the least-code path — no library does "swimlane timeline with collision-avoided annotation cards" out of the box. Confirm this call in Task 1.1 rather than assuming; d3 is the fallback if hand-rolled SVG positioning gets unwieldy.
- **Self-contained widget, not new Liquid tags.** Per `AGENTS.md`'s change-routing table, a new Liquid tag/filter would need to live in a gem. A single page (`_pages/timeline.md`) plus one `_layouts/` template plus a plain `assets/js/timeline.js` + `assets/css/timeline.css` stays within what a personal site is expected to own directly.

## Task List

### Phase 1: Static mock (fake data — no Jekyll/bib integration)

Goal: validate the visual design and core interactions cheaply, get sign-off before touching real data (28 bib entries is a lot to tag twice if the design changes).

- [x] **Task 1.1: Static HTML mock with hardcoded fake data**
  **Description:** Build a standalone page (can live outside Jekyll's build initially, e.g. `tasks/timeline_mock.html`, opened directly in a browser) with ~4 fake jobs (including one overlap, to prove the 45° intertwining) and ~10 fake papers across 3-4 fake topics, hardcoded as a JS array. Renders the vertical bar with color-coded segments, diagonal-stripe overlap rendering, and non-overlapping paper cards with dashed leader lines to their date on the bar. Confirms whether hand-rolled SVG or a library (d3) is the right call (see Architecture Decisions).
  **Acceptance criteria:**
  - [x] Jobs bar renders top-to-bottom, correctly colored per fake job, with visible 45° diagonal striping during the one overlapping period
  - [x] 10 fake paper cards render with zero visual overlap between cards, each with a dashed line to its correct date position on the bar
  - [x] Design choice (hand-rolled SVG vs. d3) is made and noted in this plan
  **Design decision:** Hand-rolled CSS + a single SVG overlay, no charting library. The bar's diagonal overlap striping uses CSS `repeating-linear-gradient(45deg, ...)` directly on each segment `div` (no SVG `<pattern>` needed). Cards are plain positioned `div`s (need text wrapping, which SVG `<foreignObject>` handles more awkwardly). Only the dashed leader lines (connecting a dynamically-positioned card to a dynamically-computed bar point) use SVG `<line>`, via one `<svg>` overlay sized to the whole timeline container. This confirms the plan's "no new charting dependency" call — d3 wasn't needed.
  **Core layout logic factored out and unit-tested** in `tasks/timeline_mock_logic.js` / `test/unit_timeline_mock_logic.js` (`dateToPosition`, `packCards`, `computeJobSegments`) rather than inlined in the mock's `<script>` block, since Task 3.3 reuses this same logic against real data — see Architecture Decisions.
  **Verification:**
  - [x] Automated: `node test/unit_timeline_mock_logic.js` passes (RED confirmed against the not-yet-existing module, then GREEN after implementing it)
  - [x] Automated: ran the mock's actual fake dataset (all 4 jobs, all 10 papers) through the tested logic directly (bypassing the DOM) — confirmed exactly 1 overlap segment, 0 same-side card collisions, all 10 papers placed
  - [x] Manual check done by Marta: found two real issues — (1) job text labels rendered next to the bar overlapped it, (2) the bar had a visible gap. Root cause of (2): the fake dataset had a 2-month gap between the first two fake jobs that doesn't reflect reality (Marta's real `cv.yml` data has no employment gaps, only overlaps) — `computeJobSegments` correctly skips zero-coverage periods, which is why it rendered blank. Fixed by closing the gap in the fake data (jobs now run back-to-back, matching the real data's shape) and re-verified programmatically: `segments[i].start === segments[i-1].end` for all consecutive segments. Fixed (1) by replacing the near-bar text labels with a static color-swatch legend in the controls area (`#job-legend`), matching the topic legend's swatch style (topic checkboxes also got swatches for consistency, since they lacked them too).
  - [ ] **Still outstanding**: confirm the fix looks right at phone width (~375px) and desktop width (~1440px) — the legend/swatch approach hasn't been screenshotted or re-reviewed yet, only reasoned through and logic-verified.
  **Dependencies:** None
  **Files touched:** `tasks/timeline_mock.html`, `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `_config.yml` (excluded `tasks/` and `timeline.md` from the Jekyll build as a safety net)
  **Estimated scope:** M

- [x] **Task 1.2: Time-range filter against fake data**
  **Description:** Add a month-granularity date-range control (two inputs or a dual-handle slider) that shows/hides jobs and papers outside the selected range, re-flowing the remaining cards so they still don't overlap.
  **Acceptance criteria:**
  - [x] Narrowing the range hides out-of-range papers and re-packs the remaining ones with no gaps or overlaps
  - [x] Widening back out restores everything correctly (no lost state/data)
  **Verification:**
  - [x] Automated: extracted the inline filter predicate into a tested pure function, `filterPapers(papers, { startMs, endMs, activeTopics })`, in `tasks/timeline_mock_logic.js` (RED confirmed — `filterPapers is not a function` — before implementing, GREEN after). Asserts narrowed ranges exclude out-of-range papers (boundary-inclusive), an out-of-range window returns empty rather than erroring, and widening back out restores every paper with the input array left unmutated.
  - [x] Automated: integration test chains `filterPapers` into `packCards` and asserts the packed result is still collision-free — the "re-packs with no gaps or overlaps" half of this task's criteria, not just the filtering half.
  **Dependencies:** Task 1.1
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_mock.html` (now calls `TimelineMockLogic.filterPapers` instead of an inline predicate)
  **Estimated scope:** S

- [x] **Task 1.3: Topic filter against fake data**
  **Description:** Add topic-tag toggle controls (checkboxes/pills) that show/hide papers by fake topic, independent of the time-range filter (both can be active together).
  **Acceptance criteria:**
  - [x] Deselecting a topic hides only papers tagged with it; the jobs bar is unaffected
  - [x] Combining an active time-range filter with a topic filter narrows correctly (AND, not OR)
  **Verification:**
  - [x] Automated: same `filterPapers` test suite as Task 1.2 — asserts deselecting topics hides non-matching papers, a paper with multiple topics passes if *any* of its topics is active, and a case where a paper matches the topic filter but not the date range is correctly excluded (proving AND, not OR).
  **Dependencies:** Task 1.2
  **Files touched:** same as Task 1.2 (same underlying change)
  **Estimated scope:** S

- [x] **Addendum: venue (conference/journal name) on cards** *(requested after Phase 2 was already underway — applied directly to both `tasks/timeline_mock.html` and `tasks/timeline_real_preview.html`, not run through a formal RED/GREEN task since it's a display-only addition, no new core logic)*
  **What changed:** Cards now show the venue (from the bib entry's `booktitle`/`journal`/`school` field) between the title and topic pills, styled as a single italic line. Real venue text was extracted from all 28 `papers.bib` entries for the real-data preview; the fake mock got matching fictional venue names.
  **Real risk caught before it shipped:** some real venue names are very long (e.g. the full SIGIR 2026 proceedings title). Left unconstrained, these would wrap across multiple lines, silently invalidating the packing algorithm's fixed-`CARD_HEIGHT` assumption and causing cards to visually overlap even though `packCards` reports zero collisions (the algorithm only knows about the height you tell it, not the DOM's actual rendered height). Fixed two ways: (1) constrained `.card-venue` to one line with CSS ellipsis truncation + a `title` attribute for the full text on hover, keeping actual rendered height back in sync with the fixed constant; (2) bumped `CARD_HEIGHT` from 92 to 112px in both files to reserve room for the added line, then re-verified zero packing collisions in both the 10-paper fake set and the 28-paper real set.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` both still pass; `bundle exec jekyll build` succeeds; re-ran the packing sanity check against both datasets with the new `CARD_HEIGHT` — 0 overlaps in both.
  **Files touched:** `tasks/timeline_mock.html`, `tasks/timeline_real_preview.html`

- [x] **Addendum: bar length not matching required content height** *(requested: "ensure the length of the bars is on-scale with the time duration" — surfaced a real bug, not just a rephrasing of the proportionality already in place)*
  **What was actually wrong:** `dateToPosition`'s time→pixel mapping was already exactly linear (verified: every real job segment computes to precisely 736.4 px/year, zero deviation) — so the *time* proportionality the request named was never broken. The real bug was structural: `timeline_real_preview.html`'s container height had already been made dynamic in an earlier fix (`Math.max(TRACK_HEIGHT, maxCardBottom)`), but `track.style.height` — the colored bar element itself — was still set once, outside `render()`, to the old fixed `TRACK_HEIGHT`. When `CARD_HEIGHT` grew 92→112 for the venue-line addition above, the deepest packed card's bottom (5718px) exceeded the still-fixed bar length (5600px), leaving the most recent ~2026 cards floating below where the bar visually ended. `timeline_mock.html` had no dynamic-height logic at all — a second, older instance of the same class of bug.
  **First approach tried and rejected:** an iterative "grow the track height until packing at that height stabilizes" scheme. Numerically verified this **diverges without bound** whenever two same-side cards share the exact same date (common with month-granularity bib data — e.g. two 2026-05 papers, three 2024-10 papers) — a zero time-gap stays exactly zero at any scale, so no amount of proportional growth ever separates it, and the "required height" kept growing by a constant ~1 `CARD_HEIGHT` every iteration forever instead of converging. Caught this by computing the sequence out to 8 iterations in Node before wiring it into the page; it never leveled off.
  **Actual fix:** keep `pos()`'s time→pixel scale permanently fixed at `BASELINE_TRACK_HEIGHT` (so `dateToPosition(maxTime, …)` always lands exactly at the same point — genuinely proportional, never rescaled). Separately, once per `render()`, ask the new `computeRequiredTrackHeight(idealPositions, CARD_HEIGHT, CARD_MIN_GAP, TOP_PADDING + BASELINE_TRACK_HEIGHT)` (single pass, no iteration, no divergence risk — see Task addition below) how much *visual* room the packed cards need, and size `track.style.height`/`container.style.height` to that. Any extra reserved space below the true end-of-timeline point is simply blank (no `.track-segment` div is ever drawn there), which is an honest rendering — it does not stretch or compress the time axis.
  **New tested function:** `computeRequiredTrackHeight(cards, cardHeight, minGap, baselineHeight)` added to `tasks/timeline_mock_logic.js` — packs `cards` and returns `Math.max(baselineHeight, deepestPackedCardBottom)`. RED/GREEN in `test/unit_timeline_mock_logic.js`: sparse-cards-fit-baseline, no-cards-falls-back-to-baseline, cramped-cards-grow-past-baseline, and a regression guard asserting no packed card ever bottoms out past the returned height.
  **Also fixed:** `timeline_mock.html` was still using the fully-static pre-dynamic-height approach (never got the earlier container-height fix at all) — brought in line with the same single-pass fix so both files now share one approach.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build --baseurl /al-folio` succeeds with `tasks/` and `timeline.md` confirmed absent from `_site/`; re-derived the fix's numbers in Node against both datasets — real data (28 papers): dead zone 5718→0px, zero same-side overlaps, `pos(maxTime)` lands exactly at the fixed proportional point; fake mock data (10 papers, 4 jobs): dead zone 0px, zero overlaps, all 4 job segments compute to the identical 294.06 px/year.
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_mock.html`, `tasks/timeline_real_preview.html`

- [x] **Addendum: hover-to-see-date on the bar** *(requested: "add the option to see the date when the mouse hovers over the bar" — display-only interaction addition, no filter/data changes)*
  **What changed:** A wider (40px) transparent `.track-hover-zone` sits centered on the 14px visible bar (a bigger hit target than the mark itself, per the dataviz skill's interaction guidance). On `mousemove` it converts the cursor's Y position back to a date and shows a small dark tooltip + a thin horizontal indicator line next to the bar at that height; both hide on `mouseleave`.
  **New tested function:** `positionToDate(position, minTime, maxTime, trackHeight)` added to `tasks/timeline_mock_logic.js` — the exact inverse of the existing `dateToPosition`, clamped to the track's bounds. RED/GREEN in `test/unit_timeline_mock_logic.js`: boundary/midpoint/clamping cases mirroring `dateToPosition`'s own tests, plus a round-trip property test (`dateToPosition` then `positionToDate` recovers the original time exactly).
  **Wiring note:** the hover zone's height is set to `effectiveTrackHeight` (same value driving `track.style.height`, from the bar-length addendum above) each render, so the hoverable area always matches the bar's actual rendered length, including any reserved packing slack — hovering in that slack region correctly reports the clamped `maxTime` rather than going stale or out of range.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build --baseurl /al-folio` succeeds with `tasks/`/`timeline.md` still absent from `_site/`; both embedded `<script>` blocks checked with `node --check` against a DOM stub. No browser-automation tool was available this session to click-test the interaction myself, so opened both preview files in the local browser for Marta to confirm directly — **confirmed working** ("it's ok, I visualized it").
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_mock.html`, `tasks/timeline_real_preview.html`

- [x] **Addendum: `tasks/timeline_mock.html` (fake data) removed** *(requested after visually confirming the hover feature: "remove the timeline_mock: we will focus on the real timeline")*
  **What changed:** Deleted `tasks/timeline_mock.html` outright. `tasks/timeline_mock_logic.js` (the tested pure-logic module) and `test/unit_timeline_mock_logic.js` stay — despite the "mock" name (kept for continuity with earlier task references rather than churning a rename), it's the shared, framework-free logic layer, now consumed only by `tasks/timeline_real_preview.html`. Task 2.6 (first-author filter) retargeted to the real preview only; no other pending task referenced the fake-data file.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass (neither depended on the mock HTML file); `bundle exec jekyll build` succeeds; confirmed `timeline_mock.html` absent from `_site/` (it always was, via the `tasks/` exclude) and now absent from the working tree too.
  **Files touched:** `tasks/timeline_mock.html` (deleted)

- [x] **Addendum: "compact time" bar-scale toggle** *(requested: "add an option to 'compact time' instead of having a time-proportional bar... the bar is reduced to whatever length allows to list ALL papers... the length does not adapt dynamically when filters are applied, it's always the length allowing for ALL papers")*
  **What changed:** Added a "Bar scale" radio toggle (Proportional / Compact) above the timeline. In compact mode, papers are positioned by chronological rank (evenly spaced by `CARD_HEIGHT + CARD_MIN_GAP`) instead of real elapsed time, and job-bar segment boundaries are placed by linear interpolation onto that same rank axis (clamped at the ends). Per spec, the rank axis, the full pack, and the resulting bar length are all computed **once from all 28 papers**, independent of the active filters — filtering only hides/shows cards; it never repositions the ones that stay visible or changes the bar length. Numerically, compact mode's bar comes out to 2758px vs. proportional's fixed 5600px baseline for the same 28-paper dataset (22 distinct paper dates after collapsing 6 same-month ties).
  **New tested functions**, both added to `tasks/timeline_mock_logic.js`: `computeCompactPositions(times, pitch)` (dedups + sorts the input times, assigns evenly-spaced rank positions) and `interpolateOnAxis(time, axisPoints)` / `interpolateAxisInverse(position, axisPoints)` (piecewise-linear lookup and its inverse over that rank axis, each clamped at the ends — the inverse exists so the hover-date tooltip from the addendum above keeps working correctly in compact mode). RED/GREEN in `test/unit_timeline_mock_logic.js`: empty/single/duplicate-time cases for the rank builder; boundary/midpoint/clamping cases for both interpolation directions; a round-trip property test recovering the original time through `interpolateOnAxis` → `interpolateAxisInverse`.
  **Wiring:** `renderTrack`/`renderCards` now take a `posFn` parameter (either the existing fixed-scale `pos` or the new `compactPos`) instead of closing over a single module-level position function, so both modes share one rendering path. `render()` branches once on `compactMode` to pick `posFn`, `packedById` (recomputed from the filtered set for proportional mode; the precomputed, filter-invariant `compactPackedById` for compact mode), and `effectiveTrackHeight`, then renders identically either way.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build` succeeds; re-derived compact mode's numbers directly in Node against the real 28-paper dataset — 0px dead zone, 0 same-side overlaps, all 5 job segments compute to positive, correctly-ordered heights, hover's inverse mapping round-trips correctly across the compact axis's range, and a spot-check confirmed a paper's precomputed position is identical whether or not other papers are currently filtered out. Not independently visually verified for the same reason as the hover addendum above (no browser-automation tool this session) — opened the updated preview in the local browser for Marta to confirm directly.
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_real_preview.html`

- [x] **Addendum: shortened venue text on cards** *(requested: "use conference acronyms and omit the 'proceedings of', for instance, proceedings of ACM conference on recommender systems becomes ACM RecSys" — display-only content change, no logic touched)*
  **What changed:** Added a `venueShort` field alongside the existing `venue` field on all 28 paper entries and pointed the card's displayed text at `venueShort`, while the `title` attribute (shown on hover, per the earlier ellipsis-truncation addendum) still uses the full `venue` string — so the card stays terse but the official full name is one hover away, not lost. Examples: "Proceedings of the 18th ACM Conference on Recommender Systems (RecSys)" → `ACM RecSys`; "Transactions of the International Society for Music Information Retrieval" → `TISMIR`; "Companion of the 32nd ACM International Conference on Multimedia (MM)" → `ACM MM Companion` (kept "Companion" — a materially different track from a full ACM MM paper); workshops co-located with a parent conference → `<Workshop> @ <Parent>` (e.g. `DaQuaMRec @ ACM RecSys`). Normalized a few source inconsistencies for consistency across cards: some bib entries wrote "RecSys" without "ACM" and "Proc. of CIKM" without an org prefix at all — since every other RecSys/CIKM entry already spells out the ACM affiliation, all RecSys references became `ACM RecSys` and CIKM became `ACM CIKM`.
  **Not done as a mechanical/regex transform:** the source strings are too inconsistently formatted ("Proc. of X" vs "Proceedings of the Nth ... (ACRONYM)" vs "X Workshop ... co-located with Y" vs bare journal abbreviations like "Phys. Rev. D") for a reliable heuristic — handled as 28 direct, individually-reasoned edits instead, same as the original venue-on-cards addition.
  **Phase 3 consideration (not yet decided):** this ad hoc preview hand-copies bib data into a JS array, so adding `venueShort` here was a direct edit. Once Task 3.1's JSON-emitting `_layouts/timeline_pub_entry.html` pulls venue text from the *real* `_bibliography/papers.bib` fields, there's no `venueShort` to pull from — either (a) add a new curated `venue_short` bib field (consistent with how `topic`/`first_author`/`month` were all handled: explicit, one-time, no guessing), or (b) write a shortening heuristic at render time. Given the format inconsistency just observed and Marta's established preference for curated data over auto-derived guesses on this project (see the `month`-sourcing history above), option (a) is the likely direction — flagged here for that task, not decided now.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass (no logic changed); `bundle exec jekyll build` succeeds; confirmed all 28 entries carry a `venueShort` field via a grep count; embedded `<script>` re-checked with `node --check`. Opened the updated preview in the local browser for Marta to confirm the shortened text reads correctly on real cards.
  **Files touched:** `tasks/timeline_real_preview.html`

- [x] **Addendum: new job — ESK Karlsruhe (Maths and Physics High-School Teacher)** *(requested: add a CV entry between the KIT postdoc and the JKU PhD; two follow-up corrections in the same exchange — "School's start date is September 2020, JKU start date is October 2021", then "ensure that the postdoc at KIT and the school teacher time don't overlap")*
  **What changed in `_data/cv.yml`** (committed on `master`, not `timeline-planning` — this is real deployable CV content, unrelated to the timeline feature): added an `experience` entry for ESK Karlsruhe (2020-09 to 2021-10); corrected JKU's start date from 2021-01 to 2021-10 in both `education` and `experience`; corrected KIT's postdoc `end_date` from 2021-01 to 2020-09 so it abuts ESK's start with zero overlap, per Marta's explicit follow-up. Asked before each factual change rather than inferring — first whether to correct JKU's date at all (the original request's parenthetical "October 2021" didn't match the existing 2021-01 data), then which side of the newly-introduced KIT/ESK overlap to move.
  **What changed in `tasks/timeline_real_preview.html`:** mirrored the same three dates in the hardcoded `jobs` array (this file hand-copies `_data/cv.yml`, same as the papers array), and added a 5th job color for ESK. Picked `#15AABF` (cyan/teal) by running the dataviz skill's `validate_palette.js` against several candidates specifically for separation from KIT's purple (`#9C36B5`, since they're temporally adjacent/were briefly overlapping) — `#15AABF` scored best (ΔE 15.7 CVD / 30.0 normal-vision vs. purple) and introduced no new palette failures. Note: the original 4 job colors already fail the strict all-pairs CVD check on one pre-existing pair (Deezer orange ↔ Albatross green, ΔE 5.7) — not introduced by this change and not in scope to fix here; already mitigated by the job legend's direct text labels (color is never the only identifier).
  **Verification:** re-derived `computeJobSegments` output in Node after each date change — confirmed max 2 simultaneous colors at any point (matching the existing "never three simultaneous jobs" note in `timeline.md`), and confirmed KIT→ESK is a clean abut (zero-width gap, zero overlap) after the final correction. `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build` succeeds on both branches; `python3 -c "import yaml..."` validated `cv.yml` syntax on `master`. Opened the updated preview in the local browser for Marta to confirm.
  **Files touched:** `_data/cv.yml` (on `master`), `tasks/timeline_real_preview.html` (on `timeline-planning`)

- [x] **Addendum: compact time is now the default bar scale** *(requested: "make the 'compact time view' the default")*
  **What changed:** Moved the radio `checked` attribute from "Proportional to time" to "Compact (fit all papers)", and the initial `compactMode` state from `false` to `true`, so the page loads straight into compact mode; proportional stays available as the other option.
  **Verification:** `node --check` on the extracted `<script>` block; `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass (no logic changed, just the default); `bundle exec jekyll build` succeeds. Opened the preview in the local browser for Marta to confirm it now loads compact by default.
  **Files touched:** `tasks/timeline_real_preview.html`

- [x] **Addendum: default time-window starts October 2021** *(requested: "set the default time-window to begin on October 2021")*
  **What changed:** Added a `DEFAULT_RANGE_START` constant (`2021-10-01`, matching the corrected JKU start date from the ESK addendum above) and pointed both the initial `rangeStart.value` and the Reset button at it, in place of the dataset's actual `minTime`. The end of the range is untouched (`maxTime`, i.e. no change there). Applied to both initial load and Reset consistently, so "Reset" restores the same default rather than reverting to the full unfiltered history — treating "default" as one single state rather than two different ones. Effect: the 6 pre-JKU physics papers (2018–2021) are hidden by default; the date-range control still lets a visitor manually widen it back to see the full physics era. Job-bar segments (KIT/ESK/JKU/Deezer/Albatross) are unaffected — the date-range filter only ever applied to paper cards, not the job bar.
  **Verification:** re-derived the filter in Node against the real 28-paper dataset — 22 of 28 visible by default, and the 6 hidden ones are exactly the pre-October-2021 physics papers. `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass (no logic changed, just a default value); `bundle exec jekyll build` succeeds; embedded `<script>` re-checked with `node --check`. Opened the preview in the local browser for Marta to confirm.
  **Files touched:** `tasks/timeline_real_preview.html`

- [x] **Addendum: bar clips to the active date-range filter** *(requested: "the bar should not be shown when restricting the time. Currently, it still is" — real gap, since the date-range filter only ever hid paper cards, never job-bar segments)*
  **What changed:** New tested `clipSegmentsToRange(segments, startMs, endMs)` in `tasks/timeline_mock_logic.js` — intersects each `computeJobSegments` output segment with `[startMs, endMs]`; segments entirely outside are dropped, ones straddling a boundary are truncated to it, a segment reduced to zero width by clipping is dropped rather than rendered. `renderTrack` now takes `(posFn, startMs, endMs)` and clips before drawing; `render()` computes `activeFilters()` once and reuses it for both `filterPapers` and this clip (previously called twice per render). Works identically in both bar-scale modes since clipping happens on real time values before either `pos` or `compactPos` converts to pixels.
  **RED/GREEN in `test/unit_timeline_mock_logic.js`:** empty input, entirely-before/-after (dropped), fully-inside (unchanged), straddling each boundary (truncated), spanning the whole range (truncated to it), exact-boundary-touch (zero-width, dropped), a mixed multi-segment case, and a no-mutation guarantee — mirroring the established test shape for this file's other pure functions.
  **False alarm mid-verification:** after implementing, Marta reported "I don't see any bar" — re-derived the exact render math in Node against the real dataset (segment top/height in compact mode under the new Oct-2021-default filter) and got sane positive values for all 4 remaining segments, so the logic itself was correct. Root cause was a stale browser tab: `open` on macOS re-focuses an already-open `file://` tab rather than reloading it, so several edits this session likely wasn't reflected until a manual hard-refresh. Confirmed working after that.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build` succeeds; re-derived clipped segment positions in Node against the real dataset under the default Oct-2021 filter — KIT and ESK (both entirely before Oct 2021) correctly disappear, leaving exactly JKU/Deezer/Albatross with positive top/height values. Confirmed visually by Marta after the stale-tab issue was resolved.
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_real_preview.html`

- [x] **Addendum: crop the page to just where the bar/cards are** *(requested: "can you 'cut' the beginning of the page if there is no bar shown? and same for the bottom. Basically, the page is restricted to only where there is the bar")*
  **What changed:** New tested `computeContentBounds(pairs)` in `tasks/timeline_mock_logic.js` — given `[top, bottom]` pixel pairs (already `posFn`-transformed), returns the true `{top, bottom}` envelope across all of them, or `null` for none. `render()` now builds one `pairs` array from the clipped bar segments *and* the currently visible cards, gets the bounds, and derives a `cropOffset = bounds.top - TOP_PADDING`; every element's `top` (segments, cards, leader-line endpoints) is now written as `rawValue - cropOffset` instead of the raw value, so the first visible thing always renders at exactly `TOP_PADDING` and the container/track/hover-zone height shrinks to `bounds.bottom - bounds.top` — no leftover empty space above the first visible item or below the last.
  **This subsumed the earlier per-mode `effectiveTrackHeight` logic**, not just added to it: proportional mode's `computeRequiredTrackHeight`-based dead-zone fix and compact mode's separate `compactTrackHeight` are both gone — `computeContentBounds` derives the render height directly from what's actually being drawn each render (segments + currently-visible cards), which already guarantees no dead zone (that was the original problem `computeRequiredTrackHeight` solved) *and* now additionally crops empty space, with one simpler mechanism instead of two separate ones. `computeRequiredTrackHeight` itself stays in `timeline_mock_logic.js`, still tested, just no longer called from this file.
  **Compact mode's "positions never move when filtering" guarantee is preserved**: `compactPackedById` (the precomputed, all-28-papers pack) is untouched — a card that's visible under two different filter states still occupies the exact same *raw* position both times. What changes is only `cropOffset` (a single render-wide constant), which uniformly slides the whole visible window so it starts at `TOP_PADDING` — nothing moves *relative to* anything else that's simultaneously visible.
  **Hover tooltip fix required too:** `hoverZone`'s own `top` never moves (stays `TOP_PADDING`, matching where the first visible content now renders), so a mouse position `y` relative to it is expressed in the cropped frame — the mousemove handler now computes `realPosition = y + cropOffset` before calling `positionToDate`/`interpolateAxisInverse`, recovering the true axis position.
  **RED/GREEN in `test/unit_timeline_mock_logic.js`:** empty input → `null`, single pair, true min/max across an unordered set of pairs (not just first/last), no-mutation guarantee.
  **Verification:** `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build` succeeds; re-derived the full render math in Node against the real dataset for three cases — compact/full-range, proportional/full-range, proportional/Oct-2021-filter — confirming zero card-packing overlaps in all three and, for the Oct-2021 default, that the first visible segment renders at exactly `TOP_PADDING` (20px) and the last content ends at exactly `TOP_PADDING + effectiveTrackHeight`, with ~716px of previously-empty space above it now trimmed away. embedded `<script>` re-checked with `node --check`.
  **Noted, not fixed (pre-existing, unrelated):** the "full range" Reset state actually shows only 27 of 28 papers — `minTime` is derived from job start dates only (`Math.min(...jobs.map(j => j.start))` = KIT's 2019-01), which is *after* the earliest paper (`Descotes-Genon:2017ptp`, 2018-12), so that one paper is silently excluded even at "full range." Predates this addendum; flagged here for a future fix (`minTime` should also consider `papers.map(p => p.date)`), not addressed now since it's outside what was asked.
  **Files touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_real_preview.html`

- [x] **Addendum: Albatross AI start date corrected to November 2025**
  **What changed in `_data/cv.yml`** (on `master`): `start_date` for the Albatross AI experience entry, `2025-01` → `2025-11`, per Marta.
  **What changed in `tasks/timeline_real_preview.html`:** mirrored the same date in the `jobs` array. Re-verified `computeJobSegments` still reports max 2 simultaneous colors anywhere (the JKU/Albatross overlap now starts Nov 2025 instead of Jan 2025, still just two-way).
  **Verification:** `python3 -c "import yaml..."` on `master`; `node test/unit_timeline_mock_logic.js`, `node test/style_contract.js`, `bundle exec jekyll build` on `timeline-planning`.
  **Files touched:** `_data/cv.yml` (on `master`), `tasks/timeline_real_preview.html` (on `timeline-planning`)

### Checkpoint: Mock approved
- [x] Review the mock live in-browser with Marta — done; surfaced two real issues (job labels overlapping the bar, a visual gap caused by an unrealistic fake-data gap), both fixed and re-reviewed
- [x] Visual direction (colors, card style, leader lines, overlap striping) signed off — "looks good!"
- [x] Filter interactions feel right (and are now automated-test-covered, not just eyeballed — see Tasks 1.2/1.3)
- [x] Phase 1 complete — proceeding to Phase 2

### Phase 2: Real data prep

- [x] **Task 2.1: Un-break the local `_layouts/` override for this fork**
  **Description:** Adjust this repo's copy of `test/style_contract.js` (and/or `unit-tests.yml`) so it stops treating a local `_layouts/` directory as an error, per the documented, sanctioned exception for user sites in `docs/ARCHITECTURE.md`/`docs/BOUNDARIES.md`. Simplest option: remove `_layouts`/`_includes`/`_sass` from the `forbiddenPath` check, or skip that specific check entirely in this fork — either is fine since this check exists to protect the *upstream* starter repo, not this site.
  **Acceptance criteria:**
  - [x] `npm run lint:style-contract` passes with a placeholder `_layouts/_test.html` file present
  - [x] The check still catches its other original violations (forbidden `build:css`/`build:tailwind` npm scripts, missing `theme: al_folio_core`, missing SRI pins, `al_math` git-branch pin) — only the path-existence check changes
  **What changed:** Removed only `_includes`, `_layouts`, `_sass` from the `forbiddenPath` loop (with a comment explaining why, citing the two docs). Left `_scripts`, `assets/tailwind`, `tailwind.config.js`, `assets/webfonts` in a separate, still-enforced loop — neither doc extends the user-site carve-out to those, they stay build/starter-ownership concerns even for a personal fork.
  **Verification:**
  - [x] RED: confirmed the *unmodified* script failed, specifically citing the `_layouts` path, with a placeholder `_layouts/_test.html` present
  - [x] GREEN: after the edit, same placeholder present, check passes
  - [x] Also live-tested `_includes` and `_sass` placeholders (not just `_layouts`) — all three pass now
  - [x] Regression: `_scripts` and `assets/tailwind` placeholders are still correctly caught (proves the carve-out didn't overreach)
  - [x] Regression: temporarily broke `theme: al_folio_core` in `_config.yml` (unrelated check) — still correctly caught, then reverted — proves the edit didn't accidentally disable other checks
  - [x] All placeholder files/dirs removed after verification; `git status` clean except the one intended file
  - [x] `bundle exec jekyll build` still succeeds
  **Dependencies:** None (ran in parallel with Phase 1, as planned)
  **Files touched:** `test/style_contract.js`
  **Estimated scope:** XS

- [x] **Task 2.2: Guided topic tagging session (conversational, not silent automation)**
  **Description:** Go through the 28 entries in `_bibliography/papers.bib` with Marta, proposing a `topic = {...}` value per entry from a shortlist derived from her actual research areas. Confirm each with Marta rather than guessing silently — this is explicitly requested in `timeline.md`'s "Before starting" list.
  **What actually happened:** Presented a full 28-row draft table in chat (topic + first-author status per paper) rather than writing anything to the file first — one correction came back (`Moscati2025CoBraR` should be `recommender-systems` only, not also `multimodal-learning`), applied before writing. **Scope grew mid-session**: Marta also asked for a first-author (or shared-first-author) filter, which needed the same kind of per-paper confirmation — one real discrepancy surfaced there too (does `Ganhor2025SiBraR_TORS`, the journal extension of `ganhoer_moscati2024sibrar`, carry the same equal-contribution marking as the conference version?). Confirmed: no, genuinely different, not an oversight. `timeline.md` updated to record the new first-author-filter requirement (see its Interactivity section).
  **Final topic set** (reused from `_data/cv.yml`'s existing `research_interests`, so the CV and timeline pages use matching vocabulary instead of two parallel taxonomies): `particle-physics` (6 papers), `recommender-systems` (15), `multimodal-learning` (10), `music-information-retrieval` (8) — most papers carry 1-2 tags. 4 topics, well under the ≤8 target.
  **First-author data**: added `first_author = {true|false}` to every entry (always present, never omitted — matches the file's existing convention for the `selected` boolean field). 20 true (including 2 shared-first-author cases marked by asterisk in the original `.bib` author list: `ganhoer_moscati2024sibrar`, `nawaz2024fame`), 8 false.
  **Sequencing call**: folded Task 2.5 (filtered_bibtex_keywords) into this same commit rather than doing it as planned in a later, separate task — writing the new custom fields without also filtering them out would have left `/publications/` visibly regressed (raw field text leaking into citations) for however long until 2.5 landed. Each task should leave the system in a working state; splitting these across two commits would have violated that.
  **Acceptance criteria:**
  - [x] All 28 bib entries have a `topic` field
  - [x] Final topic list is short enough to fit as an on-screen legend without crowding (resolves the open question in `timeline.md`; target ≤8 topics) — 4 topics
  **Verification:**
  - [x] `grep -c "topic = " _bibliography/papers.bib` → 28; brace-balance check on the full file → depth 0
  - [x] Built the site before and after (via `git stash`/`git stash pop` to diff cleanly) and diffed `_site/publications/index.html`: zero occurrences of `topic` or `first_author` anywhere in the output, including the raw "show BibTeX" toggle. Only diff: a cosmetic trailing-comma change on the `key = {value}` line in that raw toggle (an artifact of how the renderer joins the filtered field list) — no visible citation text changed at all.
  - [x] **Spike test** (built and torn down, not committed): a real `_layouts/spike_json.html` custom bibliography template, invoked via `{% bibliography -f papers -q @*[key=Moscati2025CoBraR] -T spike_json %}`, correctly rendered `{"key":"Moscati2025CoBraR","topic":"recommender-systems","first_author":"true"}` — confirms the Architecture Decisions' core technical assumption (custom bib fields reachable via `entry.<field>` in a local `_layouts/` override) actually works, not just that it should work per reading gem source. One real gotcha found: **the layout filename itself must not start with `_`** (Jekyll's default file-level exclude applies inside `_layouts/` too, separate from the directory-level `include:` mechanism) — noted here so Task 3.1 doesn't repeat the mistake.
  **Dependencies:** Checkpoint (mock approved)
  **Files touched:** `_bibliography/papers.bib`, `_config.yml` (folded in Task 2.5's change)
  **Estimated scope:** M (28 entries × 2 fields, but the conversation/confirmation was the real work)

- [x] **Task 2.6: First-author filter (new requirement, added mid-session)**
  **Description:** Extend the mock's tested `filterPapers` function with an optional first-author-only predicate, ANDed with the existing date-range and topic filters. Add a matching checkbox to `tasks/timeline_mock.html`. No new visual/layout risk (reuses the same checkbox pattern and filter-composition already built and tested in Tasks 1.2/1.3), so this doesn't need a full mock-first design cycle — just the same RED/GREEN unit-test treatment `filterPapers` already got.
  **Acceptance criteria:**
  - [x] `filterPapers` accepts a `firstAuthorOnly` option; when true, only papers with `first_author: true` in their fake data pass
  - [x] Combines correctly with the existing date-range and topic filters (AND, not OR)
  - [x] Mock UI has a working "first author only" toggle
  **Verification:**
  - [x] Automated: RED/GREEN unit tests in `test/unit_timeline_mock_logic.js`
  - [x] `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` both still pass
  **Dependencies:** Task 1.3 (reuses its `filterPapers` function)
  **Files likely touched:** `tasks/timeline_mock_logic.js`, `test/unit_timeline_mock_logic.js`, `tasks/timeline_mock.html`
  **Estimated scope:** S
  **What actually happened:** Target file retargeted to `tasks/timeline_real_preview.html` (the mock was removed earlier this session — see that addendum). `filterPapers` gained a `firstAuthorOnly` option, defaulting to falsy so every existing call site (which never passes it) is unaffected — RED/GREEN in `test/unit_timeline_mock_logic.js`: omitted/false behave identically to before, `true` hides `firstAuthor: false` papers, and it combines as AND with both the date-range and topic filters (mirroring the existing Task 1.2/1.3 test pattern). Added a "First author only" checkbox in a new `#author-filter` fieldset, wired into `activeFilters()` and reset by the existing Reset button. Spot-checked the real dataset: 20 papers `firstAuthor: true` / 8 `false`, matching the count already documented from Task 2.2's tagging session. `timeline.md`'s spec for this ("papers where I'm first author (or share first authorship)") is already satisfied by the existing `firstAuthor` boolean, which was set `true` for both solo-first and the 2 shared-first-author (asterisk) cases back in Task 2.2 — no new authorship data needed.

- [x] **Task 2.3: Guided topic → color mapping session**
  **Description:** Once the final topic list exists (Task 2.2), assign each topic a color, informed by the site's existing visual palette (check for an existing accent/theme color set before inventing a new one) and basic accessibility (sufficient contrast between adjacent topic colors, since they're a legend + fill color, not just decoration).
  **What actually happened:** No site-specific accent palette was reachable locally — `al_folio_core`'s Tailwind theme lives inside the gem, not in this repo. Used the `dataviz` skill's validated categorical palette instead of inventing hex values by eye, and ran its `scripts/validate_palette.js` rather than reasoning about color distance manually (per the skill's own core rule).
  **Real finding, not just applying the skill mechanically**: the timeline's actual use (topic-colored cards packed at arbitrary positions, any two potentially adjacent) needs the strict "all-pairs" validation, not just "adjacent-pairs." Under that bar, **no 4-color combination from the 8-hue palette clears both light and dark mode simultaneously** — confirmed empirically by testing every remaining candidate 4th hue (yellow, magenta, red, green, violet) against the clean 3-hue base (blue, orange, aqua), not just trusting the palette doc's own worked example. Resolved using real data instead of forcing a workaround: the three topics that actually co-occur in time (`recommender-systems`, `multimodal-learning`, `music-information-retrieval` — all active 2022+, could appear as adjacent cards) got the trio that validates cleanly in both modes (**orange, aqua, violet**). `particle-physics` (every paper 2017-2019, temporally isolated from the other three, never actually adjacent in practice) took the 4th slot (**blue**), whose only weak pairing — blue vs. violet, dark mode only — is a risk that never materializes given the temporal separation, and is further covered by the skill's own mitigation rule (colors in the CVD warn band are legal with visible text labels, which this design already has everywhere: legend text, card topic pills).
  **Acceptance criteria:**
  - [x] `_data/timeline_colors.yml` maps every topic from Task 2.2 to a hex color — both light and dark values per topic, since this site has real dark-mode support (`enable_darkmode: true`); a light-only mapping would have been incomplete given all this validation work
  - [x] No two topic colors are visually indistinguishable at a glance — validated via the CVD/contrast script, not eyeballed, for the pairings that actually occur in practice
  **Verification:**
  - [x] `node scripts/validate_palette.js "<hex,hex,hex>" --mode light --pairs all` and `--mode dark` (run from the dataviz skill's directory) — ALL CHECKS PASS for the 3 co-occurring topics in both modes
  - [x] Updated `tasks/timeline_mock.html`'s `TOPIC_COLORS` and fake paper topics from placeholder names (`topic-recsys` etc.) to the real topic names and validated light-mode hex values, so Phase 1's mock now previews the actual legend rather than a placeholder one — this is the "render the legend... in isolation" check, done against real values instead of a separate throwaway render
  - [x] Sanity-checked the updated mock data through the tested `filterPapers`/`packCards` pipeline (10/10 papers visible and packed) before rebuilding
  - [x] `bundle exec jekyll build` still succeeds; `tasks/`/`timeline.md` still correctly excluded from output
  **Dependencies:** Task 2.2
  **Files touched:** `_data/timeline_colors.yml` (new), `tasks/timeline_mock.html`
  **Estimated scope:** XS (ended up M — the all-pairs validation work was the real cost, not the YAML file itself)

- [x] **Task 2.4: Backfill missing `month` field**
  **Description:** Only 3 of 28 entries currently have a `month` field — the rest would silently break month-granularity filtering/positioning. For each entry missing `month`, either find the real publication month (from the venue/DOI where feasible) or explicitly decide and document a fallback. Do not silently guess without flagging which entries are approximate.
  **What actually happened:** First attempted to resolve this via web lookups directly; Marta asked to be shown the missing ones and asked one by one instead, so the source-finding stayed collaborative rather than silent, same pattern as Tasks 2.2/2.3. Two lookup passes then resolved 23 of 28 with real, sourced months, and she confirmed using conference dates for the ones found:
  - **4 via Crossref** (exact DOI-resolved publication dates): `Ganhor2025SiBraR_TORS` (Jul 2026), `Moscati2025CoBraR` (Sep 2025), `ganhoer_moscati2024sibrar` (Oct 2024), `Moscati2024emomrs` (Jun 2024).
  - **16 via conference dates** (looked up via `WebSearch`, one query per venue rather than per paper — many papers share a venue): SIGIR 2026 (Jul), ICASSP 2026 (May, covers 2 papers), ICIP 2026 (Sep), UMAP 2026 (Jun), CBMI 2025 (Oct), RecSys 2025 + its 2 co-located workshops (Sep — cross-checked against the CoBraR Crossref date, consistent), WSDM 2024 (Mar), RecSys 2024 doctoral symposium (Oct, matching the already-Crossref-dated main conference), ACM MM 2024 (Oct, of a 5-day Oct 28–Nov 1 span), RecSys 2023 + its co-located workshop (Sep), CIKM 2022 (Oct), RecSys 2022's co-located workshop (Sep), FPCP 2019 (May).
  - **3 already had a real month** from before this task (`Moscati2025UMAP_discoveryPattern`, `Peintner2025emotional_rec`, `Escobedo2024SBO`).
  - **5 initially left on the explicit fallback** (PhD thesis + 4 physics journal articles, none with a conference to anchor to). Marta then supplied real months for 4 of those 5 directly: `Moscati:2019esr` → October 2019, `Blanke:2019qrx` → August 2019, `Blanke:2018yud` → January 2019, `Descotes-Genon:2017ptp` → December 2018. `Blanke:2019aao` remains the only entry on `month_approximate = {true}` (June default) — not in her list, left as-is rather than guessed.
  **Acceptance criteria:**
  - [x] All 28 entries have a `month` field
  - [x] Entries using the fallback are identifiable via `month_approximate = {true}` (1 of 28, down from an initial 5)
  **Verification:**
  - [x] `grep -c "month = " _bibliography/papers.bib` → 28; brace-balance check → depth 0; no entry has two `month` lines (checked via awk)
  - [x] Built before/after via `git stash`, diffed `_site/publications/index.html`: `month_approximate` appears zero times anywhere in output (correctly filtered). `month` itself **does** now show in more citations than before (25 first pass, +4 more after Marta's follow-up corrections — e.g. "Sep 2025", "Oct 2024", "Oct 2019") — this is a real, desired improvement (month is a standard displayed BibTeX field that simply had no data before), not a leak, and is the expected consequence of this task rather than something to guard against.
  - [x] `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` both still pass
  - [x] `bundle exec jekyll build` succeeds
  **Dependencies:** None (ran in parallel with Task 2.2/2.3, as planned)
  **Files touched:** `_bibliography/papers.bib`, `_config.yml` (added `month_approximate` to `filtered_bibtex_keywords`)
  **Estimated scope:** M

- [x] **Task 2.5: Keep new fields out of rendered citations** *(done — folded into Task 2.2's commit rather than executed separately; see that task's "Sequencing call" note for why. `first_author` also added to `filtered_bibtex_keywords`, same reasoning as `topic`. Still applies to `month_approximate` once Task 2.4 introduces it — that part remains pending.)*
  **Description:** Add `topic` (and `month_approximate` if used) to `filtered_bibtex_keywords` in `_config.yml` so these internal-only fields don't leak into the citation text shown on `/publications/`. (`month` itself should stay — it's already a standard, displayed BibTeX field.) Resolves the open question already logged in `timeline.md`.
  **Acceptance criteria:**
  - [x] `/publications/` renders with no visible `topic` or `first_author` text in any citation
  - [x] Same for `month_approximate` — added when Task 2.4 introduced the field, verified zero leakage
  **Verification:**
  - [x] Built before/after via `git stash`, diffed `_site/publications/index.html` — zero occurrences of `topic`/`first_author`/`month_approximate` anywhere in output
  **Dependencies:** Task 2.2
  **Files touched:** `_config.yml`
  **Estimated scope:** XS

### Checkpoint: Real data ready
- [x] `bundle exec jekyll build` succeeds
- [x] All 28 entries have `topic` and `first_author`
- [x] All 28 entries have `month` (27 real/sourced, 1 flagged `month_approximate`)
- [x] `/publications/` internal-only fields (`topic`, `first_author`, `month_approximate`) stay invisible; `month` itself now correctly displays where it didn't before — a real improvement, not a regression
- [x] `npm run lint:style-contract` passes

### Phase 3: Wire the mock to real data

- [x] **Task 3.1: JSON-emitting bibliography template**
  **Description:** Create `_layouts/timeline_pub_entry.html`, a Liquid template that emits one JSON object per bib entry (`key`, `title`, `year`, `month`, `topics` as an array via `entry.topic | split: ", "`, `url`). Verify empirically (this is the plan's highest-uncertainty item, based on reading gem source, not a live test) that `entry.<custom_field>` is actually populated as expected for a real entry.
  **Acceptance criteria:**
  - [x] A test page with `{% bibliography -f papers -q @* -T timeline_pub_entry %}` renders 28 `<li>` elements
  - [x] Each `<li>`'s text content is valid JSON (`JSON.parse` succeeds) with all 5 fields populated and correctly typed (topics is an array, not a string)
  **Verification:**
  - [x] Manual check: `bundle exec jekyll build`, open the built page, run the parse check in the browser console
  **Dependencies:** Checkpoint (real data ready), Task 2.1
  **Files likely touched:** `_layouts/timeline_pub_entry.html` (new)
  **Estimated scope:** S
  **What actually happened:** Field list grew from the original 6 to 9 — `venue` (from `booktitle`/`journal`/`school`, whichever is present, since entry type varies), `month_approximate`, and `first_author` weren't in scope when this task was originally planned (all three came from addenda added later this session: venue display, the physics-era month backfill, and the first-author filter). `venue_short` (the card-display acronym form) is deliberately *not* included — no such bib field exists yet; flagged in an earlier addendum as a Task-3.3-or-later decision, not invented here. Booleans (`first_author`, `month_approximate`) are emitted as raw unquoted Liquid output (`{{ entry.first_author }}`, not run through `jsonify`) — jekyll-scholar exposes BibTeX field values as strings, and `jsonify`-ing the string `"true"` would produce the JSON *string* `"true"` rather than the boolean `true`; the earlier spike test's own sample output (`"first_author":"true"`, quoted) showed exactly this trap, so this template deliberately avoids it.
  **Real bug found during verification, not a template issue:** 16 of 28 entries carried a stray `key = {value}` BibTeX field (literal placeholder text, unrelated to the real citation key) — invisible in jekyll-scholar's default rendering, but silently colliding with `entry.key`, which the *default* publication-list template also uses to generate each entry's HTML `id`. All 16 affected entries were rendering `id="value"` on the live `/publications/` page — duplicate, invalid HTML IDs, breaking anchor deep-links for those specific papers. Not something this session introduced; asked Marta before touching `_bibliography/papers.bib` broadly (16 of 28 entries) despite the fix being unambiguous, given how carefully that file has been handled all session — confirmed, then fixed **on `master`** (real bibliography content, unrelated to the timeline feature itself) via a diff of the built `/publications/` page before/after, confirming this was the *only* change and zero duplicate `id`s remained afterward. `timeline-planning` was then merged with `master` to pick this up (plus the ESK/JKU/Albatross CV corrections) — the merge conflicted in `_bibliography/papers.bib` (both branches touched nearby lines: `timeline-planning` added `topic`/`first_author`/`month` fields per-entry, `master` removed the stray `key` line) and was resolved by keeping every `timeline-planning`-added field while dropping the stray line, verified with a line-count/brace-balance/unique-key check across all 28 entries plus a manual spot-check of two resolved entries.
  **Other findings:** jekyll-scholar's own rendering handles BibTeX-to-text conversion better than expected — LaTeX macros in titles (`b{\rightarrow}c\tau\nu`) become real Unicode (`b→cτν`), and embedded `<sub>`/`<sup>` tags are cleanly removed by this template's `strip_html` filter, no extra cleanup needed. `month` comes back abbreviated and lowercased (`"jun"`, not `"June"`) — jekyll-scholar's own normalization; Task 3.2/3.3 will need `Date` parsing that accepts short month names, not the `"2019-06-01"`-via-full-name construction the ad hoc preview currently hand-codes.
  **Verification:** built a temporary spike test page (`_pages/spike_timeline_json.md`, `{% bibliography -f papers -q @* -T timeline_pub_entry %}`, not committed — built, checked, then deleted, matching the established spike-test pattern from Task 2.2's investigation) and, in Node, extracted every `<li>` inside `<ol class="bibliography">` from the built HTML and ran `JSON.parse` on each: 28/28 parsed, 28 unique keys, zero type errors across all 9 fields (topics is a real array; `first_author`/`month_approximate` are real booleans, confirmed via `typeof`, not string comparison). `node test/unit_timeline_mock_logic.js`, `node test/style_contract.js`, and `bundle exec jekyll build --baseurl /al-folio` all pass on `timeline-planning` post-merge; `tasks/timeline_real_preview.html`'s embedded `<script>` re-checked with `node --check` to confirm the merge didn't disturb it.
  **Files touched:** `_layouts/timeline_pub_entry.html` (new, on `timeline-planning`); `_bibliography/papers.bib` (stray-field fix, on `master`, then merged into `timeline-planning`)

- [x] **Task 3.2: Timeline page skeleton with real data islands**
  **Description:** Create `_pages/timeline.md` (`nav_order: 5`, the first open slot). Embed the Task 3.1 bibliography call as a hidden data island, plus a second hidden data island looping `site.data.cv.cv.sections.experience` (existing job data — no schema change needed) through `| jsonify`. Load `assets/js/timeline.js` and `assets/css/timeline.css`.
  **Acceptance criteria:**
  - [x] Page builds and is reachable at `/timeline/`
  - [x] Both data islands are present in the rendered HTML and parse correctly in-browser
  **Verification:**
  - [x] `bundle exec jekyll build`; manual check in browser devtools console
  **Dependencies:** Task 3.1
  **Files likely touched:** `_pages/timeline.md` (new)
  **Estimated scope:** S
  **What actually happened:** `nav: false` deliberately, even though `nav_order: 5` is set — Task 4.1 ("Nav + page chrome") is explicitly responsible for flipping this to `true` once the widget is actually functional; a half-built page (data islands present, no rendering JS/CSS yet) has no business showing up in the live nav. `nav_order: 5` confirmed as the correct next slot (existing pages use 2/3/4; `about.md` has none, implicitly first).
  **Two real data islands, two different shapes — a design decision, not an oversight:** jekyll-scholar's `{% bibliography %}` tag always wraps its output in `<ol class="bibliography"><li>...</li>...</ol>` (grouped by year, with an `<h2>` per year group), even with a custom `-T` template — confirmed again here, matching Task 3.1's spike test finding. There is no jekyll-scholar option to get a bare JSON array out directly, so the papers island is a hidden container of individually-JSON `<li>` elements (parse: `Array.from(el.querySelectorAll("li")).map(li => JSON.parse(li.textContent))`), while the jobs island — no plugin involved, just `{{ ... | jsonify }}` on a plain Liquid array — is a single clean JSON array in a `<script type="application/json">` tag (parse: `JSON.parse(el.textContent)`). Task 3.3's widget JS needs both parsing strategies, not one.
  **Verification:** built the real page (not a spike this time — it's a real Task 3.2 deliverable) and, in Node, parsed both islands directly from the built HTML: papers island → 28 entries, 28 unique keys; jobs island → 5 entries, and by inspection every one already carries the corrected dates from the CV fixes earlier this session (Albatross 2025-11, JKU 2021-10, ESK Karlsruhe 2020-09→2021-10, KIT →2020-09) — end-to-end confirmation that the real data pipeline (not the hand-copied preview) reflects the current, correct `_data/cv.yml`. `node test/unit_timeline_mock_logic.js` and `node test/style_contract.js` pass; `bundle exec jekyll build --baseurl /al-folio` succeeds; confirmed `_pages/timeline.md` (the real page) renders while the unrelated root `timeline.md` (the spec) stays excluded from `_site/`; confirmed `/timeline/` does not yet appear as a nav link (matches `nav: false`).
  **Files touched:** `_pages/timeline.md` (new)

- [ ] **Task 3.3: Point the Phase-1 widget at real data**
  **Description:** Move/adapt the JS and CSS built in Tasks 1.1-1.3 into `assets/js/timeline.js` / `assets/css/timeline.css`, swapping the hardcoded fake-data array for parsing the two real data islands from Task 3.2. Interaction logic (packing, filters) should need minimal changes if the fake-data shape in Phase 1 matched the real shape from Task 3.1 — confirm it does, adjust if not.
  **Acceptance criteria:**
  - [ ] All 28 real papers render as cards, correctly positioned and non-overlapping
  - [ ] The jobs bar correctly shows the two real overlap periods (JKU/Deezer 2024, JKU/Albatross AI 2025–present) with 45° striping
  - [ ] Time-range and topic filters both work against the real dataset
  **Verification:**
  - [ ] Manual check: `bundle exec jekyll serve`, visually confirm against the actual `cv.yml`/`papers.bib` data (e.g. count of visible cards matches `grep -c "^@"` when no filters are active)
  **Dependencies:** Task 3.2
  **Files likely touched:** `assets/js/timeline.js` (new), `assets/css/timeline.css` (new), `_pages/timeline.md`
  **Estimated scope:** M

### Checkpoint: Real timeline works end-to-end
- [ ] All 28 papers visible and correctly placed with no filters active
- [ ] Both real overlap periods render correctly
- [ ] Filters work against real data
- [ ] No regressions: `/publications/`, `/cv/` still render correctly

### Phase 4: Polish & ship

- [ ] **Task 4.1: Nav + page chrome**
  **Description:** Match the page title/description/nav styling conventions of the other pages (`_pages/cv.md`, `_pages/repositories.md`).
  **Acceptance criteria:**
  - [ ] "timeline" appears in the nav in the right position, styled consistently with other nav items
  **Verification:**
  - [ ] Manual check across the site nav
  **Dependencies:** Checkpoint (real timeline works)
  **Files likely touched:** `_pages/timeline.md`
  **Estimated scope:** XS

- [ ] **Task 4.2: Accessibility pass**
  **Description:** Keyboard-operable filters (tab/enter/space, not mouse-only), sufficient color contrast for topic-colored text/fills, `aria-label`s on interactive controls and cards.
  **Acceptance criteria:**
  - [ ] Full filter interaction achievable via keyboard alone
  - [ ] Topic colors meet WCAG AA contrast against their background where used for text
  **Verification:**
  - [ ] Manual check: tab through the page; run an automated contrast checker on the final palette
  **Dependencies:** Checkpoint (real timeline works)
  **Files likely touched:** `assets/js/timeline.js`, `assets/css/timeline.css`
  **Estimated scope:** S

- [ ] **Task 4.3: Responsive smoke check (vertical layout only — horizontal is deferred)**
  **Description:** Confirm the vertical layout itself holds up from narrow phone width through wide desktop width, per the v1 orientation decision in `timeline.md`. Not building the horizontal variant now.
  **Acceptance criteria:**
  - [ ] No horizontal scrollbar, clipped cards, or broken leader lines at 375px, 768px, and 1440px widths
  **Verification:**
  - [ ] Manual check at all three widths
  **Dependencies:** Task 4.2
  **Files likely touched:** `assets/css/timeline.css`
  **Estimated scope:** S

### Checkpoint: Complete
- [ ] All acceptance criteria above met
- [ ] Success criteria from `timeline.md` sanity-checked with a fresh pair of eyes (someone who hasn't seen the CV/publications page first) understanding the career trajectory in ~30 seconds
- [ ] Ready for review with Marta before merge/publish (this project's established pattern: build on a branch, preview locally, confirm, then merge to `master` and push)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `_layouts/` override drifts silently if `al_folio_core`/`al_citations` gem updates change bibliography-tag internals | Medium | Register the override via `bundle exec al-folio upgrade overrides audit` (per `docs/ARCHITECTURE.md`) and commit `.al-folio-overrides.yml` so future gem updates flag drift |
| `jekyll-scholar`'s `<ol>/<li>` wrapping behavior assumed from reading source, not yet tested live | Medium | Task 3.1's acceptance criteria requires an actual browser-side `JSON.parse` check before Phase 3 proceeds further |
| Card-packing algorithm underestimated once real density (7 papers in 2025 alone) is used, vs. sparse fake mock data | Medium | Task 3.3's checkpoint uses real data, not just the Phase-1 fake set, specifically to surface this before shipping |
| Month-granularity filtering implies precision most entries don't actually have | Low-Medium | Task 2.4 makes the fallback explicit and taggable (`month_approximate`) rather than silently guessing |
| Tagging 28 papers is real, non-automatable work that could stall the project | Low | Mock-first ordering (Phase 1 before Phase 2) means the visual design is validated before this effort is spent |

## Open Questions

- Should `month_approximate` entries get a visual distinction on the timeline (e.g. a lighter/dashed card border), or is exact-vs-approximate not worth surfacing to visitors? (Deferred to Task 2.4/3.3 discussion — not blocking earlier phases.)
- Awards/scholarships optional layer (from `timeline.md`'s Interactivity section): no data exists yet in `_data/cv.yml`. Out of scope for this plan; would need its own data-collection task first if picked up later.
- Exact hand-rolled-SVG-vs-d3 call is deferred to Task 1.1 itself rather than decided here, since it's best resolved by trying the simplest thing first.
