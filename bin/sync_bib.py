#!/usr/bin/env python3
"""Keep _pages/publications.md and the timeline in sync with _bibliography/papers.bib.

Manually invoked (no CI): run after editing papers.bib.

  python3 bin/sync_bib.py

Computes every intended edit and every unresolved issue up front. If anything
is unresolved, prints a report and writes nothing (exit 1) -- never guesses,
never half-applies a change. Only a fully-clean run writes files (exit 0).
See tasks/plan.md for the full design rationale.
"""
import re
import sys
from pathlib import Path

import bibtexparser
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
BIB_PATH = REPO_ROOT / "_bibliography" / "papers.bib"
PUBLICATIONS_PATH = REPO_ROOT / "_pages" / "publications.md"
PREVIEW_DIR = REPO_ROOT / "assets" / "img" / "publication_preview"
TIMELINE_COLORS_PATH = REPO_ROOT / "_data" / "timeline_colors.yml"

FRONT_MATTER_RE = re.compile(r"\A---\n(.*?\n)---\n", re.DOTALL)
YEARS_LINE_RE = re.compile(r"^years:\s*\[.*\]\s*$", re.MULTILINE)


class SyncBibError(Exception):
    """Raised when papers.bib or publications.md isn't shaped as expected."""


class SyncReport:
    """Accumulates safe (unambiguous) edits and blocking (needs-a-human) issues.

    A run applies its safe edits only if there are zero blocking issues --
    never a partial apply.
    """

    def __init__(self):
        self.safe_edits = []  # list of (description, apply_fn)
        self.blocking_issues = []  # list of description strings

    def add_safe_edit(self, description, apply_fn):
        self.safe_edits.append((description, apply_fn))

    def add_blocking_issue(self, description):
        self.blocking_issues.append(description)

    @property
    def ok(self):
        return not self.blocking_issues


def load_entries(bib_path=None):
    # `bib_path=BIB_PATH` would bind the default at *definition* time, so
    # reassigning the module-level BIB_PATH later (as tests do) would be
    # silently ignored -- resolve it at call time instead.
    if bib_path is None:
        bib_path = BIB_PATH
    with open(bib_path, encoding="utf-8") as f:
        return bibtexparser.load(f).entries


def target_years(entries):
    return sorted({int(e["year"]) for e in entries}, reverse=True)


def sync_years_front_matter_text(years, text):
    """Pure text transform: rewrite the `years:` front-matter line, if needed.

    Returns (new_text, changed). Only ever touches that one line -- the rest
    of the file, including the front-matter delimiters, is untouched.
    """
    match = FRONT_MATTER_RE.match(text)
    if not match:
        raise SyncBibError("no YAML front matter found (expected a leading '---' block)")
    front_matter = match.group(1)
    new_years_line = "years: [" + ", ".join(str(y) for y in years) + "]"
    new_front_matter, count = YEARS_LINE_RE.subn(new_years_line, front_matter)
    if count != 1:
        raise SyncBibError(f"expected exactly one 'years:' line in front matter, found {count}")
    if new_front_matter == front_matter:
        return text, False
    new_text = text[: match.start(1)] + new_front_matter + text[match.end(1) :]
    return new_text, True


def check_years_front_matter(entries, report, pub_path=None):
    if pub_path is None:
        pub_path = PUBLICATIONS_PATH
    years = target_years(entries)
    text = pub_path.read_text(encoding="utf-8")
    new_text, changed = sync_years_front_matter_text(years, text)
    if not changed:
        return

    def apply():
        pub_path.write_text(new_text, encoding="utf-8")

    try:
        display_path = pub_path.relative_to(REPO_ROOT)
    except ValueError:
        display_path = pub_path
    report.add_safe_edit(f"{display_path}: years: -> {years}", apply)


def normalize_blob(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def alnum_tokens(s):
    """Alphabetic tokens (letter-runs only, digits act as a natural boundary), len >= 4.

    Numeric-only tokens (years, etc.) are deliberately excluded from matching --
    two things sharing a year is not a real identifying signal, and would make
    almost every same-year image a false "candidate" for almost every same-year
    entry.
    """
    return {t.lower() for t in re.findall(r"[A-Za-z]+", s) if len(t) >= 4}


STRONG_MATCH_SCORE = 1000  # a normalized-substring hit; always outranks any number of shared tokens


def match_score(stem, key, title):
    """0 = no match. STRONG_MATCH_SCORE = substring hit. Otherwise, the number
    of shared alphabetic tokens (>= 1) -- a weaker, gradeable signal.

    Two entries can each weakly share one generic word (e.g. "music") with an
    image that's really only a strong (substring) match for one of them, or
    share a different *number* of tokens with it (e.g. one shares two, "tors"
    and "sibrar", the other only "sibrar") -- the score lets callers prefer
    the stronger claim instead of treating every match as equally good.
    """
    stem_blob = normalize_blob(stem)
    if stem_blob and (stem_blob in normalize_blob(key) or stem_blob in normalize_blob(title or "")):
        return STRONG_MATCH_SCORE
    stem_tokens = alnum_tokens(stem)
    if not stem_tokens:
        return 0
    entry_tokens = alnum_tokens(key) | alnum_tokens(title or "")
    return len(stem_tokens & entry_tokens)


def filename_matches_entry(stem, key, title):
    """Conservative match: a normalized-substring hit, or a shared alphabetic token.

    Deliberately does not try harder than this -- preview-filename conventions
    are inconsistent across eras (see tasks/plan.md), so a match that isn't
    found this way is reported as "no candidate" rather than guessed at.
    """
    return match_score(stem, key, title) > 0


def find_preview_candidates(entries, preview_dir=None):
    """entry key -> list of candidate filenames, for entries with no `preview` yet.

    Only considers image files not already referenced by any entry's `preview`.
    An entry with zero candidates is simply omitted (not an error -- plenty of
    entries legitimately have no preview image).
    """
    if preview_dir is None:
        preview_dir = PREVIEW_DIR
    referenced = {e["preview"] for e in entries if e.get("preview")}
    available = sorted(p.name for p in preview_dir.iterdir() if p.is_file() and p.name not in referenced)

    candidates = {}
    for e in entries:
        if e.get("preview"):
            continue
        key = e["ID"]
        title = e.get("title", "")
        matches = [fname for fname in available if filename_matches_entry(Path(fname).stem, key, title)]
        if matches:
            candidates[key] = matches
    return candidates


def insert_preview_field_text(bib_text, entry_key, filename):
    """Targeted text insertion: one `preview = {...},` line before the entry's
    closing brace. Every entry in papers.bib ends with a `}` alone on its own
    line -- relying on that real convention instead of brace-matching, since a
    LaTeX escape like `Ganh{\\"o}r` makes naive brace-counting unsafe.
    """
    lines = bib_text.split("\n")
    key_re = re.compile(r"^@\w+\{\s*" + re.escape(entry_key) + r"\s*,")
    start = next((i for i, line in enumerate(lines) if key_re.match(line)), None)
    if start is None:
        raise SyncBibError(f"could not locate entry {entry_key!r} in papers.bib")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].strip() == "}"), None)
    if end is None:
        raise SyncBibError(f"could not find closing brace for entry {entry_key!r}")
    # The field immediately before the closing brace may be missing its trailing
    # comma (real hand-added entries do this on their last field) -- inserting a
    # new field after it without adding one glues two fields onto one line,
    # producing invalid BibTeX that silently drops the whole entry on reparse.
    prev_line = lines[end - 1]
    if prev_line.strip() and not prev_line.rstrip().endswith(","):
        lines = lines[:]
        lines[end - 1] = prev_line.rstrip() + ","
    new_lines = lines[:end] + [f"    preview = {{{filename}}},"] + lines[end:]
    return "\n".join(new_lines)


def check_preview_matches(entries, report, preview_dir=None, bib_path=None):
    """Two-phase, symmetric strong-beats-weak resolution.

    Phase 1 (entry-side): an entry with several raw candidate images narrows
    to its single best-scoring one; a genuine tie at the top score is
    reported and that entry gets no edit.

    Phase 2 (filename-side): among the entries that came out of phase 1
    wanting the *same* image, the strongest-scoring one wins it; the losers
    simply get no preview this run (not an error -- same as zero candidates).
    A tie at the top score there is reported instead of guessed.
    """
    if preview_dir is None:
        preview_dir = PREVIEW_DIR
    if bib_path is None:
        bib_path = BIB_PATH
    entries_by_key = {e["ID"]: e for e in entries}
    raw_candidates = find_preview_candidates(entries, preview_dir)  # key -> [filenames]

    def score(key, fname):
        e = entries_by_key[key]
        return match_score(Path(fname).stem, e["ID"], e.get("title", ""))

    best_per_entry = {}  # key -> (best_filename, best_score)
    for key, filenames in sorted(raw_candidates.items()):
        scored = sorted(((score(key, f), f) for f in filenames), reverse=True)
        top_score = scored[0][0]
        top_filenames = sorted(f for s, f in scored if s == top_score)
        if len(top_filenames) > 1:
            report.add_blocking_issue(
                f"{key}: ambiguous preview match, {len(top_filenames)} equally-strong candidate images: "
                f"{', '.join(top_filenames)}"
            )
            continue
        best_per_entry[key] = (top_filenames[0], top_score)

    filename_to_keys = {}
    for key, (fname, _) in best_per_entry.items():
        filename_to_keys.setdefault(fname, []).append(key)

    for fname, keys in sorted(filename_to_keys.items()):
        scored = sorted(((score(k, fname), k) for k in keys), reverse=True)
        top_score = scored[0][0]
        top_keys = sorted(k for s, k in scored if s == top_score)
        if len(top_keys) > 1:
            report.add_blocking_issue(f"{fname}: matches multiple entries equally well ({', '.join(top_keys)}), ambiguous")
            continue
        key = top_keys[0]

        def apply(key=key, fname=fname, bib_path=bib_path):
            text = bib_path.read_text(encoding="utf-8")
            new_text = insert_preview_field_text(text, key, fname)
            bib_path.write_text(new_text, encoding="utf-8")

        report.add_safe_edit(f"{key}: preview -> {fname}", apply)


def entry_topics(entries):
    """All distinct topic values across entries, comma-split -- matches
    `timeline_pub_entry.html`'s own `entry.topic | split: ", "`.
    """
    topics = set()
    for e in entries:
        for t in (e.get("topic") or "").split(","):
            t = t.strip()
            if t:
                topics.add(t)
    return topics


def check_topic_colors(entries, report, colors_path=None):
    """A topic with no color defined in timeline_colors.yml always blocks --
    never auto-added. That palette was chosen deliberately for CVD/contrast
    safety (see the file's own header comment); picking a color blindly here
    would undo that care.
    """
    if colors_path is None:
        colors_path = TIMELINE_COLORS_PATH
    with open(colors_path, encoding="utf-8") as f:
        colors = yaml.safe_load(f) or {}
    missing = sorted(entry_topics(entries) - set(colors.keys()))
    try:
        display_path = colors_path.relative_to(REPO_ROOT)
    except ValueError:
        display_path = colors_path
    for topic in missing:
        report.add_blocking_issue(f"topic {topic!r} has no color defined in {display_path}")


REQUIRED_FIELDS = ["bibtex_show", "selected", "month", "topic", "venue_short", "first_author", "phd_relevant"]


def check_required_fields(entries, report):
    """Every entry must carry all of REQUIRED_FIELDS -- derived from the fact
    that all 25 pre-existing entries set every one of them with zero
    exceptions (see tasks/plan.md). `preview` is deliberately not part of
    this check -- absence of a preview image is often legitimate, handled
    separately by check_preview_matches. Never guesses a value; only names
    what's missing.
    """
    for e in sorted(entries, key=lambda e: e["ID"]):
        missing = [f for f in REQUIRED_FIELDS if not e.get(f)]
        if missing:
            report.add_blocking_issue(f"{e['ID']}: missing required field(s): {', '.join(missing)}")


def build_report(entries):
    report = SyncReport()
    check_years_front_matter(entries, report)
    check_preview_matches(entries, report)
    check_topic_colors(entries, report)
    check_required_fields(entries, report)
    return report


def main():
    entries = load_entries()
    report = build_report(entries)

    if not report.ok:
        print("BLOCKED -- the following need manual attention, nothing was changed:\n")
        for issue in report.blocking_issues:
            print(f"  - {issue}")
        return 1

    if not report.safe_edits:
        print("Already in sync -- nothing to do.")
        return 0

    for description, apply_fn in report.safe_edits:
        apply_fn()
        print(f"Applied: {description}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
