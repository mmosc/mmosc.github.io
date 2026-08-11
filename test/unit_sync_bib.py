#!/usr/bin/env python3
"""Unit tests for bin/sync_bib.py's pure functions.

Run: python3 test/unit_sync_bib.py
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bin"))
import sync_bib  # noqa: E402

SAMPLE_PUBLICATIONS_MD = """---
layout: page
permalink: /publications/
title: publications
years: [2024, 2023]
nav: true
nav_order: 2
---

<!-- _pages/publications.md -->

{% include bib_search.liquid %}

<div class="publications">

{%- for y in page.years %}
  <h2 class="year">{{y}}</h2>
  {% bibliography -f papers -q @*[year={{y}}]* %}
{% endfor %}

</div>
"""


class TargetYearsTest(unittest.TestCase):
    def test_sorted_descending_and_deduplicated(self):
        entries = [{"year": "2023"}, {"year": "2026"}, {"year": "2024"}, {"year": "2023"}]
        self.assertEqual(sync_bib.target_years(entries), [2026, 2024, 2023])


class SyncYearsFrontMatterTextTest(unittest.TestCase):
    def test_rewrites_years_line_when_out_of_sync(self):
        new_text, changed = sync_bib.sync_years_front_matter_text([2026, 2024, 2023], SAMPLE_PUBLICATIONS_MD)
        self.assertTrue(changed)
        self.assertIn("years: [2026, 2024, 2023]", new_text)

    def test_only_the_years_line_changes(self):
        new_text, _ = sync_bib.sync_years_front_matter_text([2026, 2024, 2023], SAMPLE_PUBLICATIONS_MD)
        old_lines = SAMPLE_PUBLICATIONS_MD.splitlines()
        new_lines = new_text.splitlines()
        self.assertEqual(len(old_lines), len(new_lines))
        diff_lines = [i for i, (a, b) in enumerate(zip(old_lines, new_lines)) if a != b]
        self.assertEqual(diff_lines, [4])  # only the `years:` line (0-indexed)

    def test_noop_when_already_in_sync(self):
        new_text, changed = sync_bib.sync_years_front_matter_text([2024, 2023], SAMPLE_PUBLICATIONS_MD)
        self.assertFalse(changed)
        self.assertEqual(new_text, SAMPLE_PUBLICATIONS_MD)

    def test_missing_front_matter_raises(self):
        with self.assertRaises(sync_bib.SyncBibError):
            sync_bib.sync_years_front_matter_text([2024], "no front matter here\n")


if __name__ == "__main__":
    unittest.main()
