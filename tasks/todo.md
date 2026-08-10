# Todo: Horizontal-Mode Timeline View

See `tasks/plan.md` for full descriptions, acceptance criteria, and verification steps.

## Phase 1: Foundation
- [x] Task 1: Add the Orientation toggle control (inert)
- [x] Task 2: Refactor vertical rendering behind an axis abstraction (no visual change)
- [x] **Checkpoint:** unit tests + build pass, vertical mode confirmed unchanged, review with Marta

## Phase 2: Horizontal bar (no cards yet)
- [x] Task 3: Horizontal track, striping, and hover
- [x] Task 4: Horizontal-specific baseline length and compact-axis pitch
- [x] **Checkpoint:** horizontal bar renders correctly at desktop width, review with Marta

## Phase 3: Horizontal cards and leader lines
- [x] Task 5: Card placement (compact marker + hover/focus-expand)
- [x] Task 6: Leader lines in horizontal mode
- [x] **Checkpoint:** horizontal mode functionally complete, all filters re-verified, review with Marta

## Phase 4: Responsive integration
- [x] Task 7: Force vertical below a breakpoint (992px)
- [x] Task 8: Resize-recompute for horizontal geometry
- [x] **Checkpoint:** responsive behavior confirmed, review with Marta

## Phase 5: Accessibility and verification
- [x] Task 9: Accessibility pass on the new control
- [x] Task 10: Responsive smoke check across real breakpoints (375 / breakpoint boundary / 1440)
- [x] **Checkpoint:** feature complete, ready for final review

## Phase 6: Merge
- [ ] Task 11: Merge to master, planning docs excluded
