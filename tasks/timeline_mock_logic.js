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

  function filterPapers(papers, { startMs, endMs, activeTopics }) {
    return papers.filter((paper) => paper.date >= startMs && paper.date <= endMs && paper.topics.some((topic) => activeTopics.has(topic)));
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

  const api = {
    dateToPosition,
    positionToDate,
    packCards,
    computeJobSegments,
    filterPapers,
    computeRequiredTrackHeight,
    computeCompactPositions,
    interpolateOnAxis,
    interpolateAxisInverse,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TimelineMockLogic = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
