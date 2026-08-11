# Implementation Plan: papers.bib Sync Script

Branch: `bib-sync` (branched off `master` 2026-08-10, after `timeline-horizontal` merged). Plan and todo live only on this branch, same convention as `timeline-horizontal`/`timeline-distribution-charts` — excluded from the Jekyll build via `_config.yml`'s `exclude:` list (not excluded from git history).

Decisions below were confirmed with Marta before writing this task list:

- **Scope is `_bibliography/papers.bib` sync only.** `tasks/Awards_and_Tasks.md` and `tasks/PhD_papers.md` (scholarships, co-organized events, invited talks, PC/reviewer roles, "PhD-related" paper flagging) are explicitly out of scope for this project — nothing in the codebase currently reads them, and they stay that way.
- **Trigger: manual `bin/` script**, run by Marta after editing `papers.bib`, no CI auto-commit and no CI check job. Matches `bin/update_scholar_citations.py`'s manual-invocation half (this repo already schedules that one via CI too, but Marta only wants the manual path here).
- **On anything it can't safely resolve, the script fails loudly and writes nothing** — not even the parts it was confident about. Verified this is really what's wanted: "never guesses or half-applies a change." So the script computes the *entire* set of intended edits and unresolved items up front; if anything is unresolved, it prints a report and exits non-zero without touching any file; only a fully-clean run writes changes.
- **The timeline itself needs no new code.** `/timeline/` already re-renders straight from `papers.bib` on every Jekyll build (`{% bibliography -f papers -q @* -T timeline_pub_entry %}` in `_pages/timeline.md`) — there's no stale intermediate file to regenerate. The actual gaps this script closes are three specific things that currently require a human to remember to update by hand: `_pages/publications.md`'s hardcoded `years:` front matter, `preview` image wiring, and the per-entry custom-field schema (`topic`, `venue_short`, `first_author`, `month`, `bibtex_show`, `selected`) that both pages depend on but jekyll-scholar never enforces.
- **New dependency: `bibtexparser`**, added to `requirements.txt` (currently unpinned entries — `nbconvert`, `pyyaml`, `rendercv[full]`, `scholarly` — so added the same way). Python was chosen over Ruby to match this repo's existing maintenance-script convention (`bin/update_scholar_citations.py`, `bin/generate_star_history.py`), even though `bibtex-ruby` is already available transitively via `jekyll-scholar` — consistency with the existing `bin/` scripts won out over avoiding one new pip dependency.
- **Topic colors are validated, never auto-picked.** `_data/timeline_colors.yml`'s existing palette was chosen deliberately for CVD/contrast safety (see its own header comment and `scripts/validate_palette.js`). A new `topic` value in `papers.bib` with no matching key in that file is always a blocking failure, never an auto-fix.
- **Discovered live during planning:** three new bib entries (`Moscati2026SwapRec`, `AndrésFerraro2026MuRS`, `JustinHangoebl2026SPRIG`) were added to `papers.bib` mid-session, each missing all six required custom fields, alongside three new preview images (`SwapRec.png`, `MuRS.jpg`, `SPRIG.png`) that aren't wired to any entry yet. These are real, present-tense instances of exactly the gap this script targets — Phase 3 uses them as the first real test case instead of a synthetic one.

## Overview

Build `bin/sync_bib.py`: a manually-run Python script that treats `_bibliography/papers.bib` as the source of truth and (1) keeps `_pages/publications.md`'s `years:` front matter derived rather than hand-maintained, (2) auto-wires unambiguous `preview` image matches from `assets/img/publication_preview/`, and (3) validates that every entry carries the custom-field schema the timeline and publications page actually depend on. Any ambiguity anywhere aborts the whole run with a report; only a fully-resolved run edits files.

## Architecture Decisions

- **Atomic, two-pass design.** Pass 1 (read-only): parse `papers.bib`, compute the target `years:` list, compute preview-image matches, validate required fields and topic colors, and build one in-memory report of `{safe_edits: [...], blocking_issues: [...]}`. Pass 2: if `blocking_issues` is non-empty, print the report and `sys.exit(1)` without writing anything; otherwise apply `safe_edits` and `sys.exit(0)`.
- **Preview-matching heuristic** (only considered for entries with no `preview` field already, against image files not already referenced by any entry's `preview`):
  - Normalize both the bib entry key and its title to a lowercase alphanumeric-only string; do the same to each candidate filename's stem.
  - A filename is a *candidate* for an entry if its normalized stem is a substring of the normalized key or title, or shares an alphanumeric token of length ≥ 4 with either.
  - Exactly one candidate → safe edit (`preview = {filename}` inserted into that bib entry). Zero candidates → not an error, entry is simply left without a preview (many legitimate entries have none). Two or more candidates for one entry, or one filename matching two or more entries → blocking issue, no edit for that entry/filename.
  - This is deliberately conservative and known to be imperfect across naming eras (e.g. `2024_10_fame.png` vs. the newer `FAME2026.png` bare-name convention) — that inconsistency is exactly why ambiguous cases must fail loudly rather than guess.
- **Required custom-field schema**, derived from the fact that all 25 pre-existing entries set every one of these fields with zero exceptions: `bibtex_show`, `selected`, `month`, `topic`, `venue_short`, `first_author`. `preview` is intentionally excluded from this flat check (handled by the matching logic above, since absence is often legitimate). Fields that are genuinely situational across existing entries (`doi`, `url`, `pages`, `location`, `publisher`, `address`) are not checked.
- **`years:` sync is a pure front-matter edit.** Parse only the YAML front matter block of `_pages/publications.md` (between the two `---` lines), replace the `years:` value with the sorted-descending unique set of `year` values across all bib entries, and leave the rest of the file byte-identical. No change if already in sync (true today — current front matter already covers every year present).
- **No new files beyond `bin/sync_bib.py`.** No `_layouts/`, `_includes/`, `_sass/`, or `_data/` changes — stays within this repo's ownership per `AGENTS.md`; nothing here belongs in a gem.

## Task List

### Phase 1: Foundation

- [x] **Task 1: Script skeleton + `years:` front-matter sync**
      **Description:** Create `bin/sync_bib.py`. Parse `_bibliography/papers.bib` with `bibtexparser`, compute the sorted-descending unique set of `year` values, parse `_pages/publications.md`'s front matter, and rewrite its `years:` list if it differs (byte-identical file otherwise). Add `bibtexparser` to `requirements.txt`. This is the smallest end-to-end vertical slice: real input, real output, nothing else wired in yet.
      **Acceptance criteria:**
      - [x] Running the script against the current repo makes no change (years are already in sync) and exits 0
      - [x] Temporarily adding an out-of-range `year` to a scratch copy of `papers.bib` and re-running updates `years:` correctly, in the same descending order/format as today
      - [x] Every other line of `_pages/publications.md` is untouched (diff shows only the `years:` line)
      **Verification:**
      - [x] `python3 bin/sync_bib.py` runs clean against current repo state
      - [x] Manual: scratch-copy test above, inspect the diff
      **Dependencies:** None
      **Files likely touched:** `bin/sync_bib.py`, `requirements.txt`
      **Estimated scope:** S
      **Notes:** Also added `test/unit_sync_bib.py` (stdlib `unittest`, no new devDependency) covering the pure `target_years`/`sync_years_front_matter_text` functions — real TDD RED→GREEN, not just the manual scratch check. Found and fixed a real bug during scratch testing: `load_entries`/`check_years_front_matter`'s path parameters defaulted to the module-level `BIB_PATH`/`PUBLICATIONS_PATH` *at definition time*, so reassigning those globals later (as tests need to) was silently ignored — switched to `None`-default + resolve-at-call-time.

- [x] **Task 2: Preview-image matching + auto-fill**
      **Description:** Implement the normalization/candidate-matching heuristic described above against `assets/img/publication_preview/`. Wire it into the same pass-1/pass-2 report structure from Task 1 (unambiguous matches become safe edits to `papers.bib`; ambiguous ones become blocking issues; zero-candidate entries are silently fine).
      **Acceptance criteria:**
      - [x] Against current repo state, the three unmatched images (`SwapRec.png`, `MuRS.jpg`, `SPRIG.png`) are each identified as a single unambiguous candidate for the correspondingly-named bib entry
      - [x] A synthetic two-candidate case (two filenames both matching one entry) is correctly reported as blocking, with no edit applied
      - [x] Entries that already have `preview` set are never reconsidered; entries with genuinely no candidate image are left alone, not reported as an error
      **Verification:**
      - [x] Unit-style check (small script or REPL session) against the normalization/matching function with the real current filenames as fixtures
      - [x] Full run against current repo: applied 7 matches (not just the 3 originally scoped -- also picked up `FAME2026.png`, `bevfusion.png`, `2025_music4all.png`, `2025_TORS_SiBraR.png` for pre-existing entries that already had every other required field, just no `preview` yet). Did **not** apply immediately as the plan predicted ("Task 4's required-field check will still block this run") -- that prediction assumed the full pipeline already existed; run in isolation after only Task 1+2, nothing yet blocks it, so it correctly applied. Re-verified after Task 4 landed (see Checkpoint below).
      **Dependencies:** Task 1
      **Notes:** The plain "any shared token" heuristic from the original design produced real false positives against actual data: `2025_music4all.png` weakly token-matched `AndrésFerraro2026MuRS`/`Moscati2026NetworkedTastes` via the generic word "music", and `2025_TORS_SiBraR.png` matched both `Ganhor2025SiBraR_TORS` and `Moscati2025SiBraR_workshop` via "sibrar". Fixed by adding `match_score()` (substring = 1000, else = count of shared tokens) and resolving both entry-side and filename-side ambiguity by "strongest score wins outright, ties still block" instead of "any match is equally valid" -- 4 new regression tests. Separately, found and fixed a second real bug while applying to the actual repo: `Moscati2026SwapRec`/`AndrésFerraro2026MuRS`/`JustinHangoebl2026SPRIG`'s last field had no trailing comma, so inserting a new field after it glued two fields onto one line and **bibtexparser silently dropped the whole entry** on reparse. `insert_preview_field_text` now adds the missing comma when needed; caught by a new test that round-trips the result back through `bibtexparser.loads()`, not just string-matching.
      **Known gap, addressed in Task 5:** `2026_06_GMAP_UMAP.png` (→ `Moscati2026NetworkedTastes`) and `2026_SIGIR_A2G.png` (→ `Li2026DiffusionFairness`) were confirmed by Marta during planning but share no textual signal with their entries' key/title (venue/codename-based naming) -- the heuristic correctly finds zero candidates for both (fail-quiet, not a bug), so these two need a direct hand-edit rather than relying on auto-match.
      **Files likely touched:** `bin/sync_bib.py`
      **Estimated scope:** M

### Checkpoint: Foundation
- [ ] Script runs end-to-end against real repo data, `years:` sync verified, preview-matching verified on real + synthetic cases, review with Marta before continuing

### Phase 2: Validation

- [x] **Task 3: Topic-color validation**
      **Description:** Collect every distinct `topic` value across all `papers.bib` entries (comma-split, matching `timeline_pub_entry.html`'s own `entry.topic | split: ", "`) and compare against the keys of `_data/timeline_colors.yml`. Any topic with no matching key is a blocking issue (never auto-added).
      **Acceptance criteria:**
      - [x] Against current repo state, all four existing topics (`particle-physics`, `multimodal-learning`, `recommender-systems`, `music-information-retrieval`) validate clean
      - [x] A synthetic new topic value is correctly reported as a blocking issue naming the missing topic
      **Verification:**
      - [x] Full run against current repo includes this check with no false positive -- exits 0, "Already in sync" (Task 2's preview edits are already committed, years already in sync)
      **Dependencies:** Task 1
      **Files likely touched:** `bin/sync_bib.py`
      **Estimated scope:** S

- [ ] **Task 4: Required custom-field validation**
      **Description:** For every entry, check presence of `bibtex_show`, `selected`, `month`, `topic`, `venue_short`, `first_author`. Any entry missing any of these is a blocking issue, reported with the bib key and the specific missing field names (no guessed values, ever — these are content decisions).
      **Acceptance criteria:**
      - [ ] Against current repo state, the report lists exactly `Moscati2026SwapRec`, `AndrésFerraro2026MuRS`, and `JustinHangoebl2026SPRIG`, each with its specific missing fields (`AndrésFerraro2026MuRS` already has `month`, so that one field isn't listed for it)
      - [ ] All 25 pre-existing entries validate clean
      **Verification:**
      - [ ] Full run against current repo: report matches the above exactly, exit code 1, zero files modified (confirm via `git diff` before/after)
      **Dependencies:** Task 1
      **Files likely touched:** `bin/sync_bib.py`
      **Estimated scope:** S

### Checkpoint: Validation
- [ ] Full run against real repo state produces the exact expected report (3 entries, specific missing fields, 3 preview matches computed-but-not-applied), exit code 1, no files touched — review report output with Marta before proceeding

### Phase 3: Close the real gap the script found

- [ ] **Task 5: Fill missing required fields on the 3 new 2026 entries**
      **Description:** Hand-edit `_bibliography/papers.bib` to add the missing fields to `Moscati2026SwapRec`, `AndrésFerraro2026MuRS`, and `JustinHangoebl2026SPRIG`, following the exact schema convention of every sibling entry. Proposed values (confirm with Marta, especially the flagged one):
      - `Moscati2026SwapRec`: `first_author = true`, `month = September`, `topic = recommender-systems`, `venue_short = DaQuaMRec @ ACM RecSys` (matches `Moscati2025SiBraR_workshop`'s convention), `bibtex_show = true`, `selected = false`
      - `AndrésFerraro2026MuRS`: `first_author = false` (Andrés Ferraro is listed first), `topic = music-information-retrieval, recommender-systems` (confirmed by Marta), `venue_short = MuRS @ ACM RecSys` (matches `moscati2025multimodal_music_retrieval`'s convention), `bibtex_show = true`, `selected = false` (`month` already present)
      - `JustinHangoebl2026SPRIG`: `first_author = false` (Justin Hangoebl is listed first), `topic = recommender-systems`, `venue_short = ACM CIKM` (matches `onion`'s convention), `bibtex_show = true`, `selected = false`, `month = November` (confirmed by Marta)

      Also hand-wire the two known-but-unmatchable preview images found in Task 2 (venue/codename-based filenames sharing no textual signal with their entry, both confirmed with Marta during planning): add `preview = {2026_06_GMAP_UMAP.png}` to `Moscati2026NetworkedTastes` and `preview = {2026_SIGIR_A2G.png}` to `Li2026DiffusionFairness`. These two entries already have every other required field -- this is purely the `preview` line.
      **Acceptance criteria:**
      - [ ] All three new entries carry all six required fields
      - [ ] Values match sibling-entry conventions (spot-check against `Moscati2025SiBraR_workshop`, `moscati2025multimodal_music_retrieval`, `onion`)
      - [ ] `Moscati2026NetworkedTastes` and `Li2026DiffusionFairness` each have their confirmed `preview` set
      **Verification:**
      - [ ] Manual diff review of `papers.bib`
      **Dependencies:** None (can happen in parallel with Phase 1/2, but needs Marta's confirmation on values above, especially the SPRIG month)
      **Files likely touched:** `_bibliography/papers.bib`
      **Estimated scope:** XS

- [ ] **Task 6: Clean run + rendered-page verification**
      **Description:** Re-run `bin/sync_bib.py` — it should now find zero blocking issues, auto-fill `preview` on the three entries, and exit 0. Then build the site and visually confirm both pages render the three new entries correctly.
      **Acceptance criteria:**
      - [ ] `python3 bin/sync_bib.py` exits 0, and `git diff` shows exactly the three `preview = {...}` insertions in `papers.bib` (plus no-op on `years:`, already in sync)
      - [ ] `/publications/` shows all three entries under the 2026 heading with their thumbnail images
      - [ ] `/timeline/` shows all three as cards, correctly colored/filterable by topic, first-author star present/absent as expected
      **Verification:**
      - [ ] `bundle exec jekyll build --baseurl /al-folio` succeeds
      - [ ] Manual: load `/publications/` and `/timeline/` on the dev server, confirm the three entries render correctly
      **Dependencies:** Tasks 2, 4, 5
      **Files likely touched:** `_bibliography/papers.bib` (script-applied)
      **Estimated scope:** S

### Checkpoint: Feature complete
- [ ] Script is idempotent and clean against real repo state, both pages verified rendering correctly, review with Marta

### Phase 4: Docs

- [ ] **Task 7: Document the script**
      **Description:** Add a one-line entry for `bin/sync_bib.py` to `CLAUDE.md`'s "Daily dev loop" or "Optional toolchains" section (matching how `bin/update_scholar_citations.py` is documented there), including the new `bibtexparser` requirement.
      **Acceptance criteria:**
      - [ ] `CLAUDE.md` mentions the script, its manual-invocation model, and that it requires `requirements.txt` installed
      **Verification:**
      - [ ] `npm run lint:prettier` still passes
      **Dependencies:** Task 6
      **Files likely touched:** `CLAUDE.md`
      **Estimated scope:** XS

### Checkpoint: Complete
- [ ] All acceptance criteria met, ready for review — **do not merge to master without asking Marta first**, same as the still-unmerged `timeline-distribution-charts` branch

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Preview-filename conventions are inconsistent across eras (`2024_10_fame.png` vs. `FAME2026.png` vs. bare `bevfusion.png`), so the matching heuristic will eventually hit a real false-positive or false-negative | Medium | Conservative substring/token heuristic + "fail loudly, change nothing" policy means a bad match blocks the run instead of silently attaching the wrong image |
| `bibtexparser`'s round-trip writing might reformat entries more than intended (whitespace, field order) when inserting a `preview` field | Medium | Prefer a targeted text insertion (find the entry's closing brace, insert one line) over a full re-serialize of the bib file, so untouched entries are byte-identical; verify via `git diff` showing only the intended single-line additions |
| Required-field schema (6 fields) might be too strict for some future legitimate entry type (e.g., a dataset release with no natural `month`) | Low | Schema is derived from 100% real convention across 25 entries, not invented; revisit only if a real entry needs an exception |

## Open Questions

None outstanding — both flagged items (SPRIG's month, MuRS's topic) were confirmed by Marta during planning; final values are recorded in Task 5.
