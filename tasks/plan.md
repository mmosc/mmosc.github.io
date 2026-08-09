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

### Checkpoint: Mock approved
- [x] Review the mock live in-browser with Marta — done; surfaced two real issues (job labels overlapping the bar, a visual gap caused by an unrealistic fake-data gap), both fixed and re-reviewed
- [x] Visual direction (colors, card style, leader lines, overlap striping) signed off — "looks good!"
- [x] Filter interactions feel right (and are now automated-test-covered, not just eyeballed — see Tasks 1.2/1.3)
- [x] Phase 1 complete — proceeding to Phase 2

### Phase 2: Real data prep

- [ ] **Task 2.1: Un-break the local `_layouts/` override for this fork**
  **Description:** Adjust this repo's copy of `test/style_contract.js` (and/or `unit-tests.yml`) so it stops treating a local `_layouts/` directory as an error, per the documented, sanctioned exception for user sites in `docs/ARCHITECTURE.md`/`docs/BOUNDARIES.md`. Simplest option: remove `_layouts`/`_includes`/`_sass` from the `forbiddenPath` check, or skip that specific check entirely in this fork — either is fine since this check exists to protect the *upstream* starter repo, not this site.
  **Acceptance criteria:**
  - [ ] `npm run lint:style-contract` passes with a placeholder `_layouts/_test.html` file present
  - [ ] The check still catches its other original violations (forbidden `build:css`/`build:tailwind` npm scripts, missing `theme: al_folio_core`, missing SRI pins, `al_math` git-branch pin) — only the path-existence check changes
  **Verification:**
  - [ ] Tests pass: `npm run lint:style-contract`
  - [ ] Remove the placeholder file after confirming
  **Dependencies:** None (can run in parallel with Phase 1)
  **Files likely touched:** `test/style_contract.js`
  **Estimated scope:** XS

- [ ] **Task 2.2: Guided topic tagging session (conversational, not silent automation)**
  **Description:** Go through the 28 entries in `_bibliography/papers.bib` with Marta, proposing a `topic = {...}` value per entry (comma-separated tags) from a shortlist derived from her actual research areas (already drafted in `_data/cv.yml`'s `research_interests` section: multimodal learning, recommender systems, music information retrieval — likely needs 1-2 more granular tags once real papers are sorted, e.g. distinguishing physics-era papers from ML-era ones). Confirm each with Marta rather than guessing silently — this is explicitly requested in `timeline.md`'s "Before starting" list.
  **Acceptance criteria:**
  - [ ] All 28 bib entries have a `topic` field
  - [ ] Final topic list is short enough to fit as an on-screen legend without crowding (resolves the open question in `timeline.md`; target ≤8 topics)
  **Verification:**
  - [ ] `grep -c "topic = " _bibliography/papers.bib` returns 28
  - [ ] `bundle exec jekyll build` still succeeds; `/publications/` page spot-checked to confirm citation text is unchanged (topic not yet filtered — that's Task 2.5)
  **Dependencies:** Checkpoint (mock approved)
  **Files likely touched:** `_bibliography/papers.bib`
  **Estimated scope:** M (28 small edits, but the conversation/confirmation is the real work, not the edits)

- [ ] **Task 2.3: Guided topic → color mapping session**
  **Description:** Once the final topic list exists (Task 2.2), assign each topic a color, informed by the site's existing visual palette (check for an existing accent/theme color set before inventing a new one) and basic accessibility (sufficient contrast between adjacent topic colors, since they're a legend + fill color, not just decoration).
  **Acceptance criteria:**
  - [ ] `_data/timeline_colors.yml` maps every topic from Task 2.2 to a hex color
  - [ ] No two topic colors are visually indistinguishable at a glance (manual check, not just "different hex values")
  **Verification:**
  - [ ] Manual check: render the legend from Task 2.2's topic list against the chosen colors in isolation before wiring into the full page
  **Dependencies:** Task 2.2
  **Files likely touched:** `_data/timeline_colors.yml` (new)
  **Estimated scope:** XS

- [ ] **Task 2.4: Backfill missing `month` field**
  **Description:** Only 3 of 28 entries currently have a `month` field — the rest would silently break month-granularity filtering/positioning. For each entry missing `month`, either find the real publication month (from the venue/DOI where feasible) or explicitly decide and document a fallback (e.g. default to the venue's known conference month, or mid-year as a labeled "approximate" placement). Do not silently guess without flagging which entries are approximate.
  **Acceptance criteria:**
  - [ ] All 28 entries have a `month` field
  - [ ] Entries using the fallback (vs. a confirmed real month) are identifiable (e.g. a `month_approximate: true` field), so the UI can optionally distinguish them later if needed
  **Verification:**
  - [ ] `grep -c "month = " _bibliography/papers.bib` returns 28
  **Dependencies:** None (can run in parallel with Task 2.2/2.3)
  **Files likely touched:** `_bibliography/papers.bib`
  **Estimated scope:** M

- [ ] **Task 2.5: Keep new fields out of rendered citations**
  **Description:** Add `topic` (and `month_approximate` if used) to `filtered_bibtex_keywords` in `_config.yml` so these internal-only fields don't leak into the citation text shown on `/publications/`. (`month` itself should stay — it's already a standard, displayed BibTeX field.) Resolves the open question already logged in `timeline.md`.
  **Acceptance criteria:**
  - [ ] `/publications/` renders with no visible `topic` or `month_approximate` text in any citation
  **Verification:**
  - [ ] `bundle exec jekyll build --baseurl /al-folio` succeeds; grep the built `_site/publications/index.html` for the literal string `topic` and confirm no leakage into visible text
  **Dependencies:** Task 2.2
  **Files likely touched:** `_config.yml`
  **Estimated scope:** XS

### Checkpoint: Real data ready
- [ ] `bundle exec jekyll build` succeeds
- [ ] All 28 entries have both `topic` and `month`
- [ ] `/publications/` unchanged from before this phase (diff the rendered HTML text, ignoring the new bib fields)
- [ ] `npm run lint:style-contract` passes (Task 2.1 confirmed working)

### Phase 3: Wire the mock to real data

- [ ] **Task 3.1: JSON-emitting bibliography template**
  **Description:** Create `_layouts/timeline_pub_entry.html`, a Liquid template that emits one JSON object per bib entry (`key`, `title`, `year`, `month`, `topics` as an array via `entry.topic | split: ", "`, `url`). Verify empirically (this is the plan's highest-uncertainty item, based on reading gem source, not a live test) that `entry.<custom_field>` is actually populated as expected for a real entry.
  **Acceptance criteria:**
  - [ ] A test page with `{% bibliography -f papers -q @* -T timeline_pub_entry %}` renders 28 `<li>` elements
  - [ ] Each `<li>`'s text content is valid JSON (`JSON.parse` succeeds) with all 5 fields populated and correctly typed (topics is an array, not a string)
  **Verification:**
  - [ ] Manual check: `bundle exec jekyll build`, open the built page, run the parse check in the browser console
  **Dependencies:** Checkpoint (real data ready), Task 2.1
  **Files likely touched:** `_layouts/timeline_pub_entry.html` (new)
  **Estimated scope:** S

- [ ] **Task 3.2: Timeline page skeleton with real data islands**
  **Description:** Create `_pages/timeline.md` (`nav_order: 5`, the first open slot). Embed the Task 3.1 bibliography call as a hidden data island, plus a second hidden data island looping `site.data.cv.cv.sections.experience` (existing job data — no schema change needed) through `| jsonify`. Load `assets/js/timeline.js` and `assets/css/timeline.css`.
  **Acceptance criteria:**
  - [ ] Page builds and is reachable at `/timeline/`
  - [ ] Both data islands are present in the rendered HTML and parse correctly in-browser
  **Verification:**
  - [ ] `bundle exec jekyll build`; manual check in browser devtools console
  **Dependencies:** Task 3.1
  **Files likely touched:** `_pages/timeline.md` (new)
  **Estimated scope:** S

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
