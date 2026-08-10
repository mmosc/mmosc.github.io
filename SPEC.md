# SPEC: papers.bib Sync Script

Branch: `bib-sync` (branched from `master` 2026-08-10, after `timeline-horizontal` merged; not merged yet). This file, like `tasks/plan.md`/`tasks/todo.md`, is a working doc for this branch only.

Requirements here were resolved in a prior planning session (clarifying questions answered directly by Marta) and are recorded in full, with rationale, in `tasks/plan.md`. This file restates them in spec form to satisfy the `/build auto` workflow's requirement for a `SPEC.md`, not to re-derive them.

## 1. Objective

Build `bin/sync_bib.py`, a manually-run maintenance script that treats `_bibliography/papers.bib` as the single source of truth for the `/timeline/` and `/publications/` pages, and eliminates three specific hand-maintained trip points: (a) `_pages/publications.md`'s hardcoded `years:` front matter, (b) wiring `preview` images from `assets/img/publication_preview/` onto bib entries, and (c) a required custom-field schema (`bibtex_show`, `selected`, `month`, `topic`, `venue_short`, `first_author`) that every existing entry already follows but nothing currently enforces.

Audience: Marta, when she adds a new paper to `papers.bib`. Success: running the script after adding an entry either (a) silently fixes the two things that are safe to auto-derive (years list, an unambiguous preview match), or (b) fails loudly with an exact, actionable list of what's missing or ambiguous — never a silent gap that only shows up later as a blank thumbnail or an uncolored/unfiltered timeline card.

**In scope:** the sync script itself, plus finishing the three currently-incomplete 2026 bib entries (`Moscati2026SwapRec`, `AndrésFerraro2026MuRS`, `JustinHangoebl2026SPRIG`) it will flag on its first real run.

**Out of scope:** `tasks/Awards_and_Tasks.md` / `tasks/PhD_papers.md` content (confirmed out of scope during planning — nothing reads them today and this project doesn't change that); any change to how the timeline or publications page render (both already consume `papers.bib` correctly at build time via jekyll-scholar); CI automation (confirmed manual-only, unlike `update-citations.yml`'s pattern).

## 2. Commands

Existing validated command set (`AGENTS.md`), plus the new script:

```bash
python3 -m pip install -r requirements.txt   # installs bibtexparser + existing deps
python3 bin/sync_bib.py                      # the script itself; exit 0 = clean/applied, exit 1 = blocked, report printed
bundle exec jekyll build --baseurl /al-folio # verify build after sync
bundle exec jekyll serve                     # -> http://localhost:4000/al-folio/publications/ and /timeline/
npm run lint:prettier                        # if CLAUDE.md is edited (Task 7)
```

## 3. Project structure

Files this feature touches:

```
bin/sync_bib.py                 # new: the sync script
requirements.txt                # add bibtexparser
_bibliography/papers.bib        # script-applied preview fills; hand-edited fields for the 3 new 2026 entries
_pages/publications.md          # script-applied years: front-matter sync (no-op today, real once a new year appears)
tasks/plan.md, tasks/todo.md    # already exist on this branch; updated as tasks complete
CLAUDE.md                       # one-line doc mention (Task 7)
```

Files this feature must **not** need to touch (if a task turns out to require one of these, treat it as a signal to stop and re-check the approach against this spec):

```
_layouts/timeline_pub_entry.html   # timeline's bib-to-JSON template already reads whatever fields exist; no change needed
_data/timeline_colors.yml          # validated against, never auto-written (see Architecture Decisions in tasks/plan.md)
assets/js/timeline.js, assets/css/timeline.css   # timeline rendering is unrelated to this script
_layouts/, _includes/, _sass/, assets/tailwind/, tailwind.config.js, assets/webfonts/   # AGENTS.md stop-sign list
```

## 4. Code style

- `bin/sync_bib.py` matches the existing style of `bin/update_scholar_citations.py` / `bin/generate_star_history.py`: a single-file Python script, stdlib + minimal deps (`bibtexparser`, `pyyaml`), run via `python3 bin/<name>.py`, no packaging or CLI-framework overhead.
- Comments: terse, only where genuinely non-obvious — e.g., why preview-matching is conservative, why topic colors are never auto-picked. No comments restating what a line already says.
- Bib-file edits are targeted text insertions (find an entry's closing brace, insert one field line), not a full re-serialize of `papers.bib` — so untouched entries stay byte-identical in `git diff`.

## 5. Testing strategy

- No existing automated test infrastructure covers `bin/` scripts (`update_scholar_citations.py` / `generate_star_history.py` have none either) — this script follows the same precedent: verified by running it against real repo data and inspecting the report/diff, not a pytest suite.
- Task-level verification (see `tasks/plan.md`): each task's acceptance criteria are checked by running the script against current repo state, plus a small number of scratch/synthetic cases (an out-of-range year, a two-candidate preview match, a synthetic new topic) to exercise the blocking-vs-safe-edit branches.
- Final regression anchor: `bundle exec jekyll build --baseurl /al-folio` plus manual load of `/publications/` and `/timeline/` to confirm the three new 2026 entries render correctly (Task 6).

## 6. Boundaries

**Always do:**

- Compute the full set of intended edits and unresolved issues before writing anything; if anything is unresolved, write nothing and exit non-zero (the atomic, two-pass design from `tasks/plan.md`).
- Keep `tasks/plan.md`, `tasks/todo.md`, and this `SPEC.md` on the `bib-sync` branch's working state — they're excluded from the Jekyll build via `_config.yml`'s existing `exclude:` list (already carries `SPEC.md` and `tasks/` forward from prior branches, no new entry needed).
- Run `bundle exec jekyll build --baseurl /al-folio` after any script-applied change, before considering a task done.

**Ask first:**

- Before merging `bib-sync` into `master`.
- Before adding any new dependency beyond `bibtexparser`.
- Before changing the required-field schema (the 6 fields) or the preview-matching heuristic's strictness.
- Before setting up any CI automation for this script (explicitly out of scope today, not oversight).

**Never do:**

- Auto-pick a color for an unrecognized `topic` value in `_data/timeline_colors.yml` — always a blocking failure, never invented.
- Guess a content value (topic, venue, month, etc.) for a missing required field — always reported, never invented.
- Half-apply a run: if any part is blocked, no file is written, full stop.
- Touch `tasks/Awards_and_Tasks.md` / `tasks/PhD_papers.md` or wire them into any rendering path.

## Success Criteria

- `python3 bin/sync_bib.py` run against the current repo state (after Task 5's hand-edits) exits 0, having auto-filled exactly the 3 expected `preview` fields and left `years:` unchanged (already correct today).
- Re-running the script immediately afterward is a true no-op (idempotent): exit 0, empty diff.
- `/publications/` and `/timeline/` both render all 3 new 2026 papers correctly (thumbnail, topic color, first-author star as applicable) after `bundle exec jekyll build --baseurl /al-folio`.
- Introducing a synthetic topic with no `timeline_colors.yml` entry, or a synthetic duplicate preview-image match, reliably blocks the run with an accurate report and zero file writes.

## Open Questions

None outstanding — all decisions were resolved during the prior planning session (see `tasks/plan.md`); the two items flagged there (SPRIG's month, MuRS's topic) were confirmed by Marta and are recorded in Task 5.
