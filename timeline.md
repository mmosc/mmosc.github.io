# Timeline of my career
This project aims at creating a milestone timeline for the publications listed on the website — not a true Gantt chart, since papers are single dated events rather than durations. Only the jobs bar has duration; papers attach to it as point markers.

The timeline page should be 
 - interactive (more on this below)
 - included as additional tab in the main page 
 - have a color coding for topics (more on this below)

## Audience & success criteria
Primary audience: visitors evaluating my career (recruiters, collaborators, conference/PC organizers doing due diligence). Success = a stranger understands my trajectory (physics → ML, job history, output over time) within ~30 seconds, without needing to read the CV or publications list first.

# Requirements

## Data source
No new data file. The timeline must be fully automatic, generated at site-build time from data I already maintain:
 - **Jobs bar**: `_data/cv.yml`, `sections.experience` (already has `company`, `position`, `start_date`, `end_date` for all 4 jobs).
 - **Paper cards**: `_bibliography/papers.bib`. Requires adding a new `topic` field (comma-separated tag list) to each entry — this is the "guide me through tagging" step below. Adding a topic tag becomes part of the normal "add a paper" workflow, same as adding `doi` or `preview` today.
 - Topic → color mapping lives in one small config (e.g. `_data/timeline_colors.yml`), so adding a new topic is a one-line addition, not a code change.

## Interactivity
The webpage should allow selecting a specific time range (with month granularity).

It should also allow selecting which topics should be included in the timeline, according to the papers' topic tag(s). This filtering is also what lets a more thorough reader (e.g. a PC chair checking my recsys-specific output) narrow the view themselves, instead of needing a separate search/table mode — recommend leaning on this rather than building a second "dossier" interface (see Not Doing).

Optionally, other things such as awards and scholarships, should be shown.


## Orientation
v1 is **vertical** (top-to-bottom bar, cards to the left/right), on all screen sizes. This was left unstated in the original spec — the "cards above or below" phrasing implied horizontal, but vertical is the easier build: card non-overlap comes for free from normal block stacking (horizontal needs real collision/packing logic once papers cluster in time, e.g. the 7 papers in 2025), and there's no separate mobile layout or horizontal-scroll UX to get right. Nothing here is wasted if a horizontal desktop variant is added later — this vertical layout becomes its mobile fallback.

## Color coding
- The main timeline bar is divided into different colors, according to the timeline of my jobs. If two jobs were taken simultaneously, then the two colors are "intertwined" in 45-degrees bars.
- The papers are appearing as "cards" to the left or right of the main bar, with a color-coding. They are linked to the exact time through dashed lines, and are not overlapping with each other. 

Note: checked against real `cv.yml` data — only two-way overlaps occur (KIT postdoc/JKU PhD do not overlap; JKU PhD overlaps with the Deezer internship in 2024, then separately with Albatross AI from 2025), never three simultaneous jobs. The two-color 45° intertwining as specified is sufficient; no need to design for a three-way split. The diagonal-stripe treatment works the same whether the bar is drawn horizontal or vertical, so this isn't affected by the orientation decision above.

## Technical constraints
This repo is a thin Jekyll starter (see `AGENTS.md`) — new `_layouts/`, `_includes/`, or `_sass/` files aren't allowed here; that's the `al_folio_core` gem's territory. The timeline must be built as a self-contained client-side widget (its own JS/CSS asset, loaded from a normal page under `_pages/`), not as new Liquid includes. `_config.yml` already has `al_charts` enabled with d3, Chart.js, Plotly, and Vega available as third-party libraries — pick one of these rather than pulling in a new charting dependency.

## Before starting
 - Provide a mock example of how the timeline would look, with fake timeline and fake papers
 - Guide me through the creation/association of topic tags to papers
 - Guide me through the creation/association of color codings to topic tags

# Not doing (v1)
 - **Full due-diligence/dossier mode** (filterable table by venue/coauthor/keyword) — topic-tag filtering covers most of this need at much lower cost; revisit only if real visitors ask for more.
 - **Scroll-driven narrative timeline** (scroll = time, no widgets) — striking, but sacrifices the drill-down filtering that's explicitly required above.
 - **Coauthor graph on hover** — genuinely interesting but a separate, much bigger feature; not needed to hit the 30-second-read success criterion.
 - **Moving the timeline onto `/cv/` or `/about/` instead of its own tab** — keeps `/cv/` as the dossier/download page and the timeline as a distinct exploratory visual, per the original spec.

# Deferred, not rejected
 - **Horizontal layout on wide/desktop screens.** Once vertical v1 is solid, add a horizontal variant above a screen-width breakpoint, with vertical staying as the mobile fallback (see Orientation). Deferred because vertical alone gets a working, mobile-friendly timeline shipped fastest.

# Open questions
 - Does the new `topic` field on bib entries need to be added to `filtered_bibtex_keywords` in `_config.yml` so it doesn't leak into the rendered citation text on `/publications/`? (Likely yes — check before shipping.)
 - Roughly how many distinct topic tags do we expect (5? 10?) — determines how many colors the palette needs and whether a legend fits on screen without crowding.
 - Awards/scholarships layer: do I have this data anywhere yet? (Not currently in `_data/cv.yml` — would need to be added first if this optional layer is in scope.)