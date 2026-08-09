# Todo: Career Timeline Page

Full detail, acceptance criteria, and rationale in [`plan.md`](plan.md). Source spec: [`timeline.md`](../timeline.md).

## Phase 1: Static mock (fake data) — file since removed, see Phase 2 addendum
- [x] 1.1 Static HTML mock with hardcoded fake jobs + papers (vertical bar, overlap striping, non-overlapping cards, leader lines)
- [x] 1.2 Time-range filter (month granularity) against fake data
- [x] 1.3 Topic filter against fake data

## Checkpoint: Mock approved
- [x] Reviewed live in-browser with Marta — approved ("looks good!") after fixing job-label overlap and bar-continuity issues

## Phase 2: Real data prep
- [x] 2.1 Fix `test/style_contract.js` to allow local `_layouts/` override in this fork
- [x] 2.2 Guided session: add `topic` + `first_author` fields to all 28 bib entries (first-author filter was a new requirement added mid-session — see `timeline.md`)
- [x] 2.3 Guided session: topic → color mapping (`_data/timeline_colors.yml`) — validated with the dataviz skill's palette script, not picked by eye
- [x] 2.4 Backfill `month` field on all 28 bib entries — 27 real/sourced (4 Crossref, 16 conference dates, 3 pre-existing, 4 supplied directly by Marta), only `Blanke:2019aao` still flagged `month_approximate`
- [x] 2.5 Add `topic`/`first_author`/`month_approximate` to `filtered_bibtex_keywords` (folded into 2.2/2.4's commits, not done separately)
- [x] Addendum: bar length not matching required content height — bar/container now always fully spans packed cards (`computeRequiredTrackHeight`, single-pass)
- [x] Addendum: hover-to-see-date on the bar (`positionToDate`, wider hit zone)
- [x] Addendum: `tasks/timeline_mock.html` (fake data) removed — Marta confirmed the real-data preview visually and asked to focus on it exclusively going forward; `timeline_mock_logic.js` (the tested pure-logic module) stays, now consumed only by `timeline_real_preview.html`
- [x] Addendum: "compact time" bar-scale toggle — cards/segments positioned by chronological rank instead of real elapsed time, sized once from all 28 papers regardless of active filters (`computeCompactPositions`, `interpolateOnAxis`/`interpolateAxisInverse`)
- [x] 2.6 First-author filter (checkbox against `timeline_real_preview.html`, now the sole preview file)

## Checkpoint: Real data ready
- [x] `bundle exec jekyll build` succeeds
- [x] All 28 entries have `topic` + `first_author`
- [x] All 28 entries have `month` (27 real, 1 flagged approximate)
- [x] `/publications/` internal-only fields stay invisible; `month` now correctly displays where it didn't before
- [x] `npm run lint:style-contract` passes

## Phase 3: Wire mock to real data
- [x] 3.1 `_layouts/timeline_pub_entry.html` JSON-emitting template + live JSON.parse check — found and fixed a real bug along the way: 16 bib entries had a stray `key = {value}` field causing duplicate/invalid HTML ids on the live `/publications/` page (fixed on `master`, merged into `timeline-planning`)
- [x] 3.2 `_pages/timeline.md` skeleton with two hidden data islands (papers, jobs) — `nav: false` until Task 4.1
- [x] 3.3 Point Phase-1 widget JS/CSS at real data — `timeline_mock_logic.js` moved to `assets/js/` (real deployed code, wasn't before); found and fixed a real bug via Playwright: card titles had no line-clamp, so unusually long real titles wrapped to 3-4 lines and visually overlapped the next card; also added full dark-mode reactivity for topic colors + page chrome (not originally in scope, turned out cheap given `_data/timeline_colors.yml` and the site's own `--global-*` theme tokens already existed)

## Checkpoint: Real timeline works end-to-end
- [x] All 28 papers visible and correctly placed, no filters active
- [x] Both real overlap periods (JKU/Deezer 2024, JKU/Albatross 2025–present) render correctly
- [x] Filters work against real data
- [x] No regressions on `/publications/`, `/cv/`

## Phase 4: Polish & ship
- [x] 4.1 Nav entry + page chrome — `nav: true`, added a real page description; "timeline" confirmed last in nav (order 5), real click-through navigation verified
- [x] 4.2 Accessibility pass (keyboard, contrast, aria-labels) — found a real WCAG failure: white pill text failed 4.5:1 against 7 of 8 real topic-color/mode combinations; fixed with a computed per-color black/white text choice (`pickContrastingTextColor`), not a hardcoded guess
- [x] 4.3 Responsive smoke check at 375px / 768px / 1440px (vertical layout only) — 375px was flatly broken (horizontal scroll, all cards clipped), not just tight; fixing it surfaced two more real bugs (cards overlapping at narrow widths, then leader lines desyncing on live browser resize) — see plan.md for all three

## Checkpoint: Complete
- [x] All acceptance criteria met
- [ ] Fresh-eyes 30-second-read check
- [ ] Reviewed with Marta before merge/publish
