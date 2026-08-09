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
- [ ] 3.2 `_pages/timeline.md` skeleton with two hidden data islands (papers, jobs)
- [ ] 3.3 Point Phase-1 widget JS/CSS at real data

## Checkpoint: Real timeline works end-to-end
- [ ] All 28 papers visible and correctly placed, no filters active
- [ ] Both real overlap periods (JKU/Deezer 2024, JKU/Albatross 2025–present) render correctly
- [ ] Filters work against real data
- [ ] No regressions on `/publications/`, `/cv/`

## Phase 4: Polish & ship
- [ ] 4.1 Nav entry + page chrome
- [ ] 4.2 Accessibility pass (keyboard, contrast, aria-labels)
- [ ] 4.3 Responsive smoke check at 375px / 768px / 1440px (vertical layout only)

## Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Fresh-eyes 30-second-read check
- [ ] Reviewed with Marta before merge/publish
