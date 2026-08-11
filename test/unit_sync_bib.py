#!/usr/bin/env python3
"""Unit tests for bin/sync_bib.py's pure functions.

Run: python3 test/unit_sync_bib.py
"""
import sys
import unittest
from pathlib import Path

import bibtexparser

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


class FilenameMatchesEntryTest(unittest.TestCase):
    """Real current repo fixtures (see tasks/plan.md's matching heuristic)."""

    def test_substring_match(self):
        self.assertTrue(sync_bib.filename_matches_entry("SwapRec", "Moscati2026SwapRec", "SwapRec: Warming Up Cold Items"))
        self.assertTrue(sync_bib.filename_matches_entry("SPRIG", "JustinHangoebl2026SPRIG", "SPRIG: Semantic-ID-enhanced Paths"))
        self.assertTrue(sync_bib.filename_matches_entry("MuRS", "AndrésFerraro2026MuRS", "MuRS 2026: 4th Music Recommender Systems Workshop"))
        self.assertTrue(sync_bib.filename_matches_entry("bevfusion", "Essl2026SBBEVFusion", "SB-BEVFusion: Enhancing the Robustness"))
        self.assertTrue(
            sync_bib.filename_matches_entry("2025_music4all", "Geiger2025Music4AllAA", "Music4All A+A: A Multimodal Dataset")
        )

    def test_token_overlap_match_out_of_order(self):
        # filename says "TORS_SiBraR", key/title say "SiBraR" ... "TORS" (reversed order) --
        # no substring match, but they share the "tors"/"sibrar" tokens.
        self.assertTrue(
            sync_bib.filename_matches_entry(
                "2025_TORS_SiBraR", "Ganhor2025SiBraR_TORS", "Single-Branch Network Architectures to Close the Modality Gap"
            )
        )

    def test_token_overlap_across_digit_letter_boundary(self):
        # "FAME2026.png" vs key "...FAME_linking" -- key has "2026" *before* "FAME", so no
        # substring match either way; "fame" is a shared alphabetic token.
        self.assertTrue(
            sync_bib.filename_matches_entry(
                "FAME2026", "Moscati2026FAME_linking", "Linking Faces and Voices Across Languages: Insights from the FAME 2026 Challenge"
            )
        )

    def test_no_match(self):
        self.assertFalse(sync_bib.filename_matches_entry("brownian-motion", "Moscati2026SwapRec", "SwapRec: Warming Up Cold Items"))

    def test_shared_numeric_only_token_does_not_count(self):
        # both contain "2026" -- a bare year must never be enough on its own.
        self.assertFalse(sync_bib.filename_matches_entry("2026_06_GMAP_UMAP", "Li2026DiffusionFairness", "Adaptive Autoguidance"))

    def test_short_alphabetic_token_does_not_count(self):
        # shared 3-letter token ("gap") shouldn't be enough -- only tokens of length >= 4 count.
        self.assertFalse(sync_bib.filename_matches_entry("gap-photo", "Essl2026SBBEVFusion", "Robustness against sensor gap issues"))


class FindPreviewCandidatesTest(unittest.TestCase):
    def _write(self, tmp_dir, names):
        for name in names:
            (tmp_dir / name).write_text("fake image bytes")

    def test_unambiguous_match_found(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec.png", "already_used.png"])
            entries = [
                {"ID": "Moscati2026SwapRec", "title": "SwapRec: Warming Up Cold Items"},
                {"ID": "SomeOtherEntry", "title": "Unrelated Title", "preview": "already_used.png"},
            ]
            candidates = sync_bib.find_preview_candidates(entries, preview_dir)
            self.assertEqual(candidates, {"Moscati2026SwapRec": ["SwapRec.png"]})

    def test_entries_with_preview_already_set_are_skipped(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec.png"])
            entries = [{"ID": "Moscati2026SwapRec", "title": "SwapRec", "preview": "SwapRec.png"}]
            candidates = sync_bib.find_preview_candidates(entries, preview_dir)
            self.assertEqual(candidates, {})

    def test_zero_candidates_is_not_reported(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["wave-mechanics.gif"])
            entries = [{"ID": "Moscati2026SwapRec", "title": "SwapRec: Warming Up Cold Items"}]
            candidates = sync_bib.find_preview_candidates(entries, preview_dir)
            self.assertEqual(candidates, {})


class InsertPreviewFieldTextTest(unittest.TestCase):
    SAMPLE_BIB = """@inproceedings{Moscati2026SwapRec,
    title = {SwapRec},
    year = {2026}
}

@inproceedings{Other2026Entry,
    title = {Another entry with a brace in it: {Weird}},
    year = {2026}
}
"""

    def test_inserts_before_closing_brace(self):
        new_text = sync_bib.insert_preview_field_text(self.SAMPLE_BIB, "Moscati2026SwapRec", "SwapRec.png")
        self.assertIn("    preview = {SwapRec.png},\n}", new_text)
        # the second entry, including its own embedded brace, is untouched
        self.assertIn("title = {Another entry with a brace in it: {Weird}},", new_text)

    def test_adds_missing_comma_on_previous_field(self):
        # SAMPLE_BIB's last field ("year = {2026}") has NO trailing comma, matching
        # real entries added by hand (e.g. Moscati2026SwapRec before Task 5 filled
        # in the rest). Inserting a field after it without adding that comma
        # produces invalid BibTeX with two fields glued onto one line -- silently
        # dropping the whole entry when re-parsed. Found via a real corrupted-entry
        # run against the actual repo, not reasoning about the format in the abstract.
        new_text = sync_bib.insert_preview_field_text(self.SAMPLE_BIB, "Moscati2026SwapRec", "SwapRec.png")
        self.assertIn("year = {2026},\n    preview = {SwapRec.png},\n}", new_text)
        parsed = bibtexparser.loads(new_text).entries
        by_id = {e["ID"]: e for e in parsed}
        self.assertEqual(len(parsed), 2)
        self.assertEqual(by_id["Moscati2026SwapRec"]["preview"], "SwapRec.png")
        self.assertEqual(by_id["Moscati2026SwapRec"]["year"], "2026")

    def test_missing_entry_raises(self):
        with self.assertRaises(sync_bib.SyncBibError):
            sync_bib.insert_preview_field_text(self.SAMPLE_BIB, "NoSuchEntry", "x.png")


class CheckPreviewMatchesTest(unittest.TestCase):
    def _write(self, tmp_dir, names):
        for name in names:
            (tmp_dir / name).write_text("fake image bytes")

    def test_unambiguous_match_is_a_safe_edit(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec.png"])
            entries = [{"ID": "Moscati2026SwapRec", "title": "SwapRec", "preview": None}]
            del entries[0]["preview"]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertTrue(report.ok)
            self.assertEqual(len(report.safe_edits), 1)

    def test_two_candidates_for_one_entry_is_blocking(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec_v1.png", "SwapRec_v2.png"])
            entries = [{"ID": "Moscati2026SwapRec", "title": "SwapRec"}]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertFalse(report.ok)
            self.assertEqual(report.safe_edits, [])

    def test_one_filename_matching_two_entries_is_blocking(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec.png"])
            entries = [
                {"ID": "Moscati2026SwapRec", "title": "SwapRec original"},
                {"ID": "Other2026SwapRec", "title": "SwapRec follow-up"},
            ]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertFalse(report.ok)
            self.assertEqual(report.safe_edits, [])


class ScoreBasedResolutionTest(unittest.TestCase):
    """Regression tests for real false positives found running against the actual
    repo data: a shared generic domain word ("music") or a partial token overlap
    must not out-compete a genuinely stronger match for the same image.
    """

    def _write(self, tmp_dir, names):
        for name in names:
            (tmp_dir / name).write_text("fake image bytes")

    def test_strong_substring_beats_weak_shared_word_elsewhere(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["2025_music4all.png"])
            entries = [
                {"ID": "Geiger2025Music4AllAA", "title": "Music4All A+A: A Multimodal Dataset"},
                {"ID": "AndrésFerraro2026MuRS", "title": "MuRS 2026: 4th Music Recommender Systems Workshop"},
            ]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertTrue(report.ok)
            self.assertEqual(len(report.safe_edits), 1)
            self.assertIn("Geiger2025Music4AllAA", report.safe_edits[0][0])

    def test_entry_side_weak_extra_candidate_does_not_block_a_clear_winner(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["MuRS.jpg", "2025_music4all.png"])
            entries = [
                {"ID": "AndrésFerraro2026MuRS", "title": "MuRS 2026: 4th Music Recommender Systems Workshop"},
                {"ID": "Geiger2025Music4AllAA", "title": "Music4All A+A: A Multimodal Dataset"},
            ]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertTrue(report.ok)
            applied = {desc for desc, _ in report.safe_edits}
            self.assertTrue(any("AndrésFerraro2026MuRS: preview -> MuRS.jpg" in d for d in applied))
            self.assertTrue(any("Geiger2025Music4AllAA: preview -> 2025_music4all.png" in d for d in applied))

    def test_more_shared_tokens_beats_fewer_for_the_same_image(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["2025_TORS_SiBraR.png"])
            entries = [
                {"ID": "Ganhor2025SiBraR_TORS", "title": "Single-Branch Network Architectures"},
                {"ID": "Moscati2025SiBraR_workshop", "title": "Single-Branch Architectures for Recommendation"},
            ]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertTrue(report.ok)
            self.assertEqual(len(report.safe_edits), 1)
            self.assertIn("Ganhor2025SiBraR_TORS", report.safe_edits[0][0])

    def test_genuine_tie_still_blocks(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            preview_dir = Path(d)
            self._write(preview_dir, ["SwapRec.png"])
            entries = [
                {"ID": "Moscati2026SwapRec", "title": "SwapRec original"},
                {"ID": "Other2026SwapRec", "title": "SwapRec follow-up"},
            ]
            report = sync_bib.SyncReport()
            sync_bib.check_preview_matches(entries, report, preview_dir)
            self.assertFalse(report.ok)
            self.assertEqual(report.safe_edits, [])


class EntryTopicsTest(unittest.TestCase):
    def test_splits_and_dedupes_comma_separated_topics(self):
        entries = [
            {"topic": "recommender-systems, music-information-retrieval"},
            {"topic": "recommender-systems"},
            {"topic": ""},
        ]
        self.assertEqual(sync_bib.entry_topics(entries), {"recommender-systems", "music-information-retrieval"})


class CheckTopicColorsTest(unittest.TestCase):
    def _write_colors(self, tmp_dir, mapping):
        path = tmp_dir / "timeline_colors.yml"
        path.write_text("\n".join(f'{k}:\n  light: "#000000"\n  dark: "#ffffff"' for k in mapping))
        return path

    def test_known_topics_validate_clean(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            colors_path = self._write_colors(Path(d), ["recommender-systems", "music-information-retrieval"])
            entries = [{"topic": "recommender-systems, music-information-retrieval"}]
            report = sync_bib.SyncReport()
            sync_bib.check_topic_colors(entries, report, colors_path)
            self.assertTrue(report.ok)

    def test_undefined_topic_is_blocking(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            colors_path = self._write_colors(Path(d), ["recommender-systems"])
            entries = [{"topic": "recommender-systems, some-new-topic"}]
            report = sync_bib.SyncReport()
            sync_bib.check_topic_colors(entries, report, colors_path)
            self.assertFalse(report.ok)
            self.assertTrue(any("some-new-topic" in issue for issue in report.blocking_issues))

    def test_real_repo_topics_all_validate_clean(self):
        entries = sync_bib.load_entries()
        report = sync_bib.SyncReport()
        sync_bib.check_topic_colors(entries, report)
        self.assertTrue(report.ok, report.blocking_issues)


if __name__ == "__main__":
    unittest.main()
