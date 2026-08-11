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

REPO_ROOT = Path(__file__).resolve().parent.parent
BIB_PATH = REPO_ROOT / "_bibliography" / "papers.bib"
PUBLICATIONS_PATH = REPO_ROOT / "_pages" / "publications.md"

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


def build_report(entries):
    report = SyncReport()
    check_years_front_matter(entries, report)
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
