// Pure layout logic for the career-timeline mock (tasks/plan.md, Task 1.1).
// No DOM dependency, so it can be unit tested directly and reused unchanged
// in Phase 3 once real data replaces the fake dataset (see plan.md Task 3.3).
(function (root) {
  function dateToPosition(time, minTime, maxTime, trackHeight) {
    const clamped = Math.min(Math.max(time, minTime), maxTime);
    return ((clamped - minTime) / (maxTime - minTime)) * trackHeight;
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

  function filterPapers(papers, { startMs, endMs, activeTopics }) {
    return papers.filter((paper) => paper.date >= startMs && paper.date <= endMs && paper.topics.some((topic) => activeTopics.has(topic)));
  }

  function computeRequiredTrackHeight(cards, cardHeight, minGap, baselineHeight) {
    const packed = packCards(cards, cardHeight, minGap);
    const maxBottom = packed.reduce((max, card) => Math.max(max, card.top + cardHeight), 0);
    return Math.max(baselineHeight, maxBottom);
  }

  const api = { dateToPosition, packCards, computeJobSegments, filterPapers, computeRequiredTrackHeight };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TimelineMockLogic = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
