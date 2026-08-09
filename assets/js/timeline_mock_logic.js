// Pure layout logic for the career-timeline mock (tasks/plan.md, Task 1.1).
// No DOM dependency, so it can be unit tested directly and reused unchanged
// in Phase 3 once real data replaces the fake dataset (see plan.md Task 3.3).
(function (root) {
  function dateToPosition(time, minTime, maxTime, trackHeight) {
    const clamped = Math.min(Math.max(time, minTime), maxTime);
    return ((clamped - minTime) / (maxTime - minTime)) * trackHeight;
  }

  function positionToDate(position, minTime, maxTime, trackHeight) {
    const clamped = Math.min(Math.max(position, 0), trackHeight);
    return minTime + (clamped / trackHeight) * (maxTime - minTime);
  }

  function packCards(cards, cardHeight, minGap) {
    const sorted = [...cards].sort((a, b) => a.idealPosition - b.idealPosition);
    const cursors = { left: -Infinity, right: -Infinity };
    return sorted.map((card, i) => {
      const side = i % 2 === 0 ? "left" : "right";
      let top = card.idealPosition;
      if (top < cursors[side] + minGap) {
        top = cursors[side] + minGap;
      }
      cursors[side] = top + cardHeight;
      return { id: card.id, side, top };
    });
  }

  function computeJobSegments(jobs) {
    if (jobs.length === 0) return [];

    const boundaries = new Set();
    jobs.forEach((job) => {
      boundaries.add(job.startTime);
      boundaries.add(job.endTime);
    });
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    const segments = [];
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      if (start === end) continue;

      const colors = jobs.filter((job) => job.startTime <= start && job.endTime >= end).map((job) => job.color);

      if (colors.length > 0) {
        segments.push({ start, end, colors });
      }
    }
    return segments;
  }

  function clipSegmentsToRange(segments, startMs, endMs) {
    return segments
      .map((seg) => ({ ...seg, start: Math.max(seg.start, startMs), end: Math.min(seg.end, endMs) }))
      .filter((seg) => seg.start < seg.end);
  }

  function computeContentBounds(pairs) {
    if (pairs.length === 0) return null;
    const top = Math.min(...pairs.map(([t]) => t));
    const bottom = Math.max(...pairs.map(([, b]) => b));
    return { top, bottom };
  }

  function filterPapers(papers, { startMs, endMs, activeTopics, firstAuthorOnly }) {
    return papers.filter(
      (paper) =>
        paper.date >= startMs &&
        paper.date <= endMs &&
        paper.topics.some((topic) => activeTopics.has(topic)) &&
        (!firstAuthorOnly || paper.firstAuthor),
    );
  }

  function computeRequiredTrackHeight(cards, cardHeight, minGap, baselineHeight) {
    const packed = packCards(cards, cardHeight, minGap);
    const maxBottom = packed.reduce((max, card) => Math.max(max, card.top + cardHeight), 0);
    return Math.max(baselineHeight, maxBottom);
  }

  // "Compact time" mode: rank-based positions instead of real-elapsed-time
  // proportional ones, so the bar is only ever as long as needed to list
  // every distinct time value, regardless of how much real time separates them.
  function computeCompactPositions(times, pitch) {
    const distinct = Array.from(new Set(times)).sort((a, b) => a - b);
    return distinct.map((time, index) => ({ time, position: index * pitch }));
  }

  function interpolateOnAxis(time, axisPoints) {
    if (axisPoints.length === 0) return 0;
    if (time <= axisPoints[0].time) return axisPoints[0].position;
    const last = axisPoints[axisPoints.length - 1];
    if (time >= last.time) return last.position;
    for (let i = 1; i < axisPoints.length; i++) {
      if (time <= axisPoints[i].time) {
        const prev = axisPoints[i - 1];
        const next = axisPoints[i];
        const fraction = (time - prev.time) / (next.time - prev.time);
        return prev.position + fraction * (next.position - prev.position);
      }
    }
    return last.position;
  }

  function interpolateAxisInverse(position, axisPoints) {
    if (axisPoints.length === 0) return 0;
    if (position <= axisPoints[0].position) return axisPoints[0].time;
    const last = axisPoints[axisPoints.length - 1];
    if (position >= last.position) return last.time;
    for (let i = 1; i < axisPoints.length; i++) {
      if (position <= axisPoints[i].position) {
        const prev = axisPoints[i - 1];
        const next = axisPoints[i];
        const fraction = (position - prev.position) / (next.position - prev.position);
        return prev.time + fraction * (next.time - prev.time);
      }
    }
    return last.time;
  }

  const MONTH_ABBREVIATIONS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // Bib entries carry year + an abbreviated month name (jekyll-scholar's own
  // normalization, e.g. "jul", not "July" or "07") -- see Task 3.1.
  function parseMonthYear(year, month) {
    const monthIndex = MONTH_ABBREVIATIONS.indexOf(String(month).toLowerCase().slice(0, 3));
    return Date.UTC(parseInt(year, 10), monthIndex === -1 ? 0 : monthIndex, 1);
  }

  // cv.yml's start_date/end_date are "YYYY-MM" strings, or the literal
  // string "present" for an ongoing job.
  function parseJobDate(dateStr, now) {
    if (dateStr === "present") return now;
    const [year, month] = dateStr.split("-");
    return Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  }

  // WCAG 2.x relative-luminance contrast ratio (same formula the dataviz
  // skill's validate_palette.js uses for its own contrast checks).
  function relativeLuminance(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(hex1, hex2) {
    const l1 = relativeLuminance(hex1);
    const l2 = relativeLuminance(hex2);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }

  // No single fixed text color (all-white or all-black) clears WCAG AA
  // 4.5:1 against every real topic color in both light and dark mode (see
  // test/unit_timeline_mock_logic.js's regression guard) -- picking
  // whichever of pure black/white contrasts better against a given
  // background does.
  function pickContrastingTextColor(bgHex) {
    return contrastRatio("#000000", bgHex) >= contrastRatio("#ffffff", bgHex) ? "#000000" : "#ffffff";
  }

  const api = {
    dateToPosition,
    positionToDate,
    packCards,
    computeJobSegments,
    clipSegmentsToRange,
    computeContentBounds,
    filterPapers,
    computeRequiredTrackHeight,
    computeCompactPositions,
    interpolateOnAxis,
    interpolateAxisInverse,
    contrastRatio,
    pickContrastingTextColor,
    parseMonthYear,
    parseJobDate,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TimelineMockLogic = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
