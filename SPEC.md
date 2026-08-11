# SPEC: Horizontal-Mode Timeline View

Branch: `timeline-horizontal` (branched from `master`, not merged yet). This file, like `tasks/plan.md`/`tasks/todo.md`, is a working doc for this branch only — see Boundaries below for why it doesn't ship to `master`.

Requirements here were resolved in a prior planning session (clarifying questions answered directly by Marta) and are recorded in full, with rationale, in `tasks/plan.md`. This file restates them in spec form to satisfy the `/build auto` workflow's requirement for a `SPEC.md`, not to re-derive them.

## 1. Objective

The `/timeline/` page (a vertical, interactive career milestone timeline — jobs bar + publication cards, shipped on `master`) gets a second orientation: horizontal. Same audience as the original feature (recruiters, collaborators, conference/PC organizers doing due diligence), same success criterion (understand the career trajectory within ~30 seconds) — horizontal is an alternative presentation of identical data and identical interactivity, not a new feature set.

**In scope:** an "Orientation" toggle (Vertical / Horizontal) and a fully working horizontal rendering of the existing bar + cards + filters + hover interaction.

**Out of scope:** any change to what data is shown, how it's filtered, or the vertical layout's current behavior; any new data file, Liquid tag, or gem-owned path; automated visual-regression tooling.

## 2. Commands

Reuses this repo's existing validated command set (see `AGENTS.md`); no new commands are introduced by this feature.

```bash
bundle exec jekyll serve                         # dev server -> http://localhost:4000/al-folio/timeline/
bundle exec jekyll build --baseurl /al-folio      # production-style build; verify no errors, no tasks/SPEC.md leakage into _site/
node test/unit_timeline_mock_logic.js             # pure-logic unit tests (must stay green; expected unchanged by this feature)
npm run lint:style-contract                       # confirms no new _layouts/_includes/_sass/tailwind files were added
npm run lint:prettier                             # formatting (printWidth 150, @shopify/prettier-plugin-liquid)
```

Manual verification (no automated coverage for this widget, matching existing precedent):

- Load `/timeline/` in a real or emulated browser at 375px, ~992px (from both sides), and 1440px.
- Toggle Orientation and Bar-scale in combination; toggle every filter (date range, topics, first-author-only) in both orientations.

## 3. Project structure

Files this feature touches:

```
_pages/timeline.md              # add the "Orientation" fieldset (markup only)
assets/css/timeline.css         # new horizontal-mode rules (track, segments, hover, cards, leader lines)
assets/js/timeline.js           # orientation state, axis-abstraction refactor, horizontal render paths
tasks/plan.md, tasks/todo.md    # already exist on this branch; updated as tasks complete
```

Files this feature must **not** need to touch (if a task turns out to require one of these, treat it as a signal to stop and re-check the approach against this spec):

```
assets/js/timeline_mock_logic.js      # pure logic is already orientation-agnostic (see Objective/Boundaries)
test/unit_timeline_mock_logic.js      # only touched if a genuinely new pure computation is extracted
_layouts/timeline_pub_entry.html      # bib-to-JSON template, unrelated to orientation
_data/timeline_colors.yml             # topic color data, unrelated to orientation
_data/cv.yml                          # job data, unrelated to orientation
_config.yml                           # except for the one-line SPEC.md exclude added by this spec itself
```

## 4. Code style

- Match `assets/js/timeline.js`'s existing style exactly: a single IIFE module, no framework/library introduced (the existing file already confirmed `al_charts`'s d3/Chart.js/Plotly/Vega weren't needed for this widget — that finding still holds).
- Match `assets/css/timeline.css`'s existing style: colors via `var(--global-*)` theme tokens and `var(--topic-*)`/`var(--topic-*-text)` custom properties — never a new hardcoded hex value, so dark-mode reactivity and WCAG AA contrast keep working automatically in horizontal mode too.
- Comments: this codebase's existing comments are unusually dense but all earn their place — each one records a non-obvious _why_ (a bug found, a rejected approach, an empirical tuning number). New comments in this feature should follow that same bar: skip anything a reader could infer from the code itself, keep anything that explains a real constraint or a decision that would otherwise look arbitrary (e.g., "why 992px," "why this baseline length").
- Formatting: Prettier, `printWidth: 150`, `@shopify/prettier-plugin-liquid` for `_pages/timeline.md`.

## 5. Testing strategy

- **Pure logic layer** (`timeline_mock_logic.js`): expected to need zero changes, since `packCards`/`computeCompactPositions`/`dateToPosition`/`positionToDate`/`interpolateOnAxis`/`interpolateAxisInverse`/`computeJobSegments`/`clipSegmentsToRange`/`filterPapers` already operate on orientation-agnostic 1D positions and two alternating lane labels. `node test/unit_timeline_mock_logic.js` must stay green throughout — if a task needs to modify this file, that's a signal to re-examine whether the orientation-agnostic assumption actually held, not to proceed silently.
- **If** a genuinely new pure computation emerges during implementation (e.g., a cross-axis container-size formula worth isolating), it follows this project's existing RED→GREEN convention: write the failing assertion in `test/unit_timeline_mock_logic.js` first, then implement in `timeline_mock_logic.js`.
- **DOM/CSS/orientation-wiring layer** (`timeline.js`, `timeline.css`): no automated coverage, matching the existing precedent for this widget (the original vertical build verified responsiveness manually, at named breakpoints, not via Playwright — real bugs were found that way, not by reasoning about CSS abstractly). Each task in `tasks/plan.md` states its own manual verification steps; follow those exactly.
- **Regression anchor:** Task 2 of `tasks/plan.md` (the axis-abstraction refactor) must leave vertical-mode output pixel-identical — verify by comparing `/timeline/` before/after at 375/762/1440px before any horizontal-specific code is written.

## 6. Boundaries

**Always do:**

- Run `node test/unit_timeline_mock_logic.js`, `npm run lint:style-contract`, and `bundle exec jekyll build --baseurl /al-folio` before each commit.
- Keep every change within `_pages/`, `assets/css/`, `assets/js/` — never create `_layouts/`, `_includes/`, `_sass/`, `assets/tailwind/`, `tailwind.config.js`, or `assets/webfonts/` (AGENTS.md's stop-sign list; `lint:style-contract` enforces this in CI).
- Keep `tasks/plan.md`, `tasks/todo.md`, and this `SPEC.md` on the `timeline-horizontal` branch only — do not let them reach `master`. (`_config.yml`'s `exclude:` list already has `tasks/`; this spec adds `SPEC.md` to that same list as a build-time safety net, mirroring how `timeline.md` was excluded during the original build.)
- Preserve every existing vertical-mode behavior and every existing filter/control exactly as-is.

**Ask first:**

- Before merging `timeline-horizontal` into `master`.
- Before changing the ~992px "force vertical" breakpoint to something materially different from what Task 7 converges on.
- Before adding any new npm/gem dependency, or any charting library, to render horizontal mode.
- Before adding automated Playwright/visual-regression coverage for this widget (currently out of scope by design, not oversight).

**Never do:**

- Touch gem-owned paths (layouts/includes/sass/tailwind) to implement this feature.
- Change `_data/cv.yml`, `_data/timeline_colors.yml`, `_bibliography/papers.bib`, or `_layouts/timeline_pub_entry.html` — this feature is presentation-only.
- Commit directly to `master`, or skip/bypass a failing `lint:style-contract`/unit-test/build check to force a commit through.
