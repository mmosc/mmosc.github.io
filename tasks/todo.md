# Todo: Career Timeline Page

Full detail, acceptance criteria, and rationale in [`plan.md`](plan.md). Source spec: [`timeline.md`](../timeline.md).

## Phase 1: Static mock (fake data)
- [x] 1.1 Static HTML mock with hardcoded fake jobs + papers (vertical bar, overlap striping, non-overlapping cards, leader lines)
- [x] 1.2 Time-range filter (month granularity) against fake data
- [x] 1.3 Topic filter against fake data

## Checkpoint: Mock approved
- [x] Reviewed live in-browser with Marta — approved ("looks good!") after fixing job-label overlap and bar-continuity issues

## Phase 2: Real data prep
- [x] 2.1 Fix `test/style_contract.js` to allow local `_layouts/` override in this fork
- [ ] 2.2 Guided session: add `topic` field to all 28 bib entries
- [ ] 2.3 Guided session: topic → color mapping (`_data/timeline_colors.yml`)
- [ ] 2.4 Backfill `month` field on all 28 bib entries (flag approximated ones)
- [ ] 2.5 Add `topic`/`month_approximate` to `filtered_bibtex_keywords`

## Checkpoint: Real data ready
- [ ] `bundle exec jekyll build` succeeds
- [ ] All 28 entries have `topic` + `month`
- [ ] `/publications/` output unchanged
- [ ] `npm run lint:style-contract` passes

## Phase 3: Wire mock to real data
- [ ] 3.1 `_layouts/timeline_pub_entry.html` JSON-emitting template + live JSON.parse check
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
