const assert = require("node:assert/strict");
const {
  dateToPosition,
  packCards,
  computeJobSegments,
  filterPapers,
  computeRequiredTrackHeight,
  positionToDate,
  computeCompactPositions,
  interpolateOnAxis,
  interpolateAxisInverse,
  clipSegmentsToRange,
  computeContentBounds,
} = require("../tasks/timeline_mock_logic.js");

// dateToPosition: maps a time value onto a track, clamped to [0, trackHeight]
assert.strictEqual(dateToPosition(0, 0, 1000, 500), 0, "earliest time maps to position 0");
assert.strictEqual(dateToPosition(1000, 0, 1000, 500), 500, "latest time maps to trackHeight");
assert.strictEqual(dateToPosition(500, 0, 1000, 500), 250, "midpoint maps to half of trackHeight");
assert.strictEqual(dateToPosition(-50, 0, 1000, 500), 0, "time before range clamps to 0");
assert.strictEqual(dateToPosition(1050, 0, 1000, 500), 500, "time after range clamps to trackHeight");

// packCards: alternates sides, pushes down colliding same-side cards, never overlaps
{
  const result = packCards([], 20, 5);
  assert.deepStrictEqual(result, [], "empty input produces empty output");
}

{
  // well-spaced cards: no push-down needed, tops equal ideal positions
  const cards = [
    { id: "a", idealPosition: 0 },
    { id: "b", idealPosition: 100 },
    { id: "c", idealPosition: 200 },
    { id: "d", idealPosition: 300 },
  ];
  const result = packCards(cards, 20, 10);
  assert.strictEqual(result.find((r) => r.id === "a").side, "left");
  assert.strictEqual(result.find((r) => r.id === "b").side, "right");
  assert.strictEqual(result.find((r) => r.id === "c").side, "left");
  assert.strictEqual(result.find((r) => r.id === "d").side, "right");
  result.forEach((r) => {
    const card = cards.find((c) => c.id === r.id);
    assert.strictEqual(r.top, card.idealPosition, `well-spaced card ${r.id} keeps its ideal position`);
  });
}

{
  // clustered same-side cards must be pushed apart, never overlapping
  const cards = [
    { id: "a", idealPosition: 0 },
    { id: "b", idealPosition: 5 },
    { id: "c", idealPosition: 10 },
    { id: "d", idealPosition: 15 },
  ];
  const cardHeight = 20;
  const minGap = 5;
  const result = packCards(cards, cardHeight, minGap);

  const bySide = { left: [], right: [] };
  result.forEach((r) => bySide[r.side].push(r));
  ["left", "right"].forEach((side) => {
    const placed = bySide[side].sort((a, b) => a.top - b.top);
    for (let i = 1; i < placed.length; i++) {
      const prevBottom = placed[i - 1].top + cardHeight;
      assert.ok(
        placed[i].top >= prevBottom,
        `clustered ${side} card ${placed[i].id} (top ${placed[i].top}) must not overlap previous card (bottom ${prevBottom})`,
      );
    }
  });
}

// computeJobSegments: turns possibly-overlapping job intervals into non-overlapping
// segments tagged with every color active in that segment
{
  const result = computeJobSegments([]);
  assert.deepStrictEqual(result, [], "no jobs produces no segments");
}

{
  const result = computeJobSegments([{ id: "j1", color: "A", startTime: 0, endTime: 100 }]);
  assert.deepStrictEqual(result, [{ start: 0, end: 100, colors: ["A"] }], "single job produces a single segment");
}

{
  // non-overlapping jobs with a gap between them: the gap must not appear as a segment
  const result = computeJobSegments([
    { id: "j1", color: "A", startTime: 0, endTime: 30 },
    { id: "j2", color: "B", startTime: 50, endTime: 80 },
  ]);
  assert.deepStrictEqual(result, [
    { start: 0, end: 30, colors: ["A"] },
    { start: 50, end: 80, colors: ["B"] },
  ]);
}

{
  // overlapping jobs: the overlap window must carry both colors, flanked by single-color segments
  const result = computeJobSegments([
    { id: "j1", color: "A", startTime: 0, endTime: 100 },
    { id: "j2", color: "B", startTime: 40, endTime: 60 },
  ]);
  assert.deepStrictEqual(result, [
    { start: 0, end: 40, colors: ["A"] },
    { start: 40, end: 60, colors: ["A", "B"] },
    { start: 60, end: 100, colors: ["A"] },
  ]);
}

// clipSegmentsToRange: the job bar must only show color within the active
// date-range filter — a segment entirely outside the window disappears
// entirely, and one straddling a boundary is truncated to it.
{
  assert.deepStrictEqual(clipSegmentsToRange([], 0, 100), [], "no segments produces no clipped segments");
}

{
  const segments = [{ start: 0, end: 50, colors: ["A"] }];
  assert.deepStrictEqual(clipSegmentsToRange(segments, 100, 200), [], "a segment entirely before the range is dropped");
}

{
  const segments = [{ start: 300, end: 400, colors: ["A"] }];
  assert.deepStrictEqual(clipSegmentsToRange(segments, 100, 200), [], "a segment entirely after the range is dropped");
}

{
  const segments = [{ start: 120, end: 180, colors: ["A"] }];
  assert.deepStrictEqual(
    clipSegmentsToRange(segments, 100, 200),
    [{ start: 120, end: 180, colors: ["A"] }],
    "a segment fully inside the range is unchanged",
  );
}

{
  const segments = [{ start: 50, end: 150, colors: ["A"] }];
  assert.deepStrictEqual(
    clipSegmentsToRange(segments, 100, 200),
    [{ start: 100, end: 150, colors: ["A"] }],
    "a segment straddling the start boundary is truncated to it",
  );
}

{
  const segments = [{ start: 150, end: 250, colors: ["A"] }];
  assert.deepStrictEqual(
    clipSegmentsToRange(segments, 100, 200),
    [{ start: 150, end: 200, colors: ["A"] }],
    "a segment straddling the end boundary is truncated to it",
  );
}

{
  const segments = [{ start: 0, end: 500, colors: ["A"] }];
  assert.deepStrictEqual(
    clipSegmentsToRange(segments, 100, 200),
    [{ start: 100, end: 200, colors: ["A"] }],
    "a segment spanning the entire range is truncated to exactly the range",
  );
}

{
  // touching a boundary exactly leaves a zero-width segment, which must be dropped, not rendered
  const segments = [{ start: 0, end: 100, colors: ["A"] }];
  assert.deepStrictEqual(clipSegmentsToRange(segments, 100, 200), [], "a segment that only touches the boundary is dropped, not a zero-width render");
}

{
  // mixed set + no-mutation guarantee
  const segments = [
    { start: 0, end: 50, colors: ["A"] },
    { start: 80, end: 150, colors: ["A", "B"] },
    { start: 180, end: 220, colors: ["B"] },
    { start: 400, end: 500, colors: ["C"] },
  ];
  const beforeClip = JSON.stringify(segments);
  const result = clipSegmentsToRange(segments, 100, 200);
  assert.deepStrictEqual(result, [
    { start: 100, end: 150, colors: ["A", "B"] },
    { start: 180, end: 200, colors: ["B"] },
  ]);
  assert.strictEqual(JSON.stringify(segments), beforeClip, "clipSegmentsToRange must not mutate its input");
}

// computeContentBounds: finds the true min-top/max-bottom across whatever is
// actually being rendered (clipped bar segments + visible cards), so the
// page can crop away empty space above/below where nothing is shown.
{
  assert.strictEqual(computeContentBounds([]), null, "no content means no bounds");
}

{
  assert.deepStrictEqual(computeContentBounds([[50, 90]]), { top: 50, bottom: 90 }, "a single pair is its own bounds");
}

{
  // true min/max, not just the first/last pair in the array
  const pairs = [
    [100, 150],
    [20, 60],
    [200, 400],
    [70, 110],
  ];
  assert.deepStrictEqual(computeContentBounds(pairs), { top: 20, bottom: 400 }, "finds the true min top and max bottom across all pairs");
}

{
  // no-mutation guarantee
  const pairs = [
    [10, 20],
    [30, 40],
  ];
  const before = JSON.stringify(pairs);
  computeContentBounds(pairs);
  assert.strictEqual(JSON.stringify(pairs), before, "computeContentBounds must not mutate its input");
}

// filterPapers: date-range + topic filtering, combined with AND (plan.md
// Tasks 1.2 and 1.3's actual acceptance criteria)
{
  const papers = [
    { id: "p1", date: 0, topics: ["a"] },
    { id: "p2", date: 50, topics: ["a", "b"] },
    { id: "p3", date: 100, topics: ["b"] },
    { id: "p4", date: 150, topics: ["c"] },
  ];
  const allTopics = new Set(["a", "b", "c"]);

  // no filtering: full range, all topics active -> everything passes through
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: allTopics }).map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
    "full range and all topics returns every paper",
  );

  // Task 1.2: narrowing the date range excludes out-of-range papers, range bounds inclusive
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 25, endMs: 100, activeTopics: allTopics }).map((p) => p.id),
    ["p2", "p3"],
    "narrowed range excludes papers outside [startMs, endMs], includes boundary matches",
  );

  // Task 1.2: date range excluding everything returns empty, not an error
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 1000, endMs: 2000, activeTopics: allTopics }).map((p) => p.id),
    [],
    "range outside all paper dates returns no papers",
  );

  // Task 1.2: widening back out restores everything, and the input array is untouched
  const beforeFilter = JSON.stringify(papers);
  filterPapers(papers, { startMs: 25, endMs: 100, activeTopics: allTopics });
  assert.strictEqual(JSON.stringify(papers), beforeFilter, "filterPapers must not mutate its input");
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: allTopics }).map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
    "widening the range back out restores every paper (no lost state)",
  );

  // Task 1.3: topic filter hides papers matching none of the active topics
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: new Set(["c"]) }).map((p) => p.id),
    ["p4"],
    "deselecting topics hides papers that match none of the remaining active topics",
  );

  // Task 1.3: a paper with multiple topics passes if ANY of its topics is active
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: new Set(["b"]) }).map((p) => p.id),
    ["p2", "p3"],
    "multi-topic paper p2 passes because topic b is active, even though topic a is not",
  );

  // Task 1.3: date range AND topic filter combine as AND, not OR
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 60, activeTopics: new Set(["b"]) }).map((p) => p.id),
    ["p2"],
    "p3 matches the topic filter but not the date range, so it must be excluded (AND, not OR)",
  );

  // deselecting every topic returns nothing, regardless of date range
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: new Set() }).map((p) => p.id),
    [],
    "no active topics returns no papers even with the full date range",
  );
}

// Task 2.6: first-author-only filter, ANDed with the existing date-range and
// topic filters
{
  const papers = [
    { id: "p1", date: 0, topics: ["a"], firstAuthor: true },
    { id: "p2", date: 50, topics: ["a", "b"], firstAuthor: false },
    { id: "p3", date: 100, topics: ["b"], firstAuthor: true },
    { id: "p4", date: 150, topics: ["c"], firstAuthor: false },
  ];
  const allTopics = new Set(["a", "b", "c"]);

  // firstAuthorOnly omitted (undefined): behaves exactly as before, no filtering by authorship
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: allTopics }).map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
    "omitting firstAuthorOnly doesn't filter by authorship (backward compatible)",
  );

  // firstAuthorOnly: false explicitly: same as omitted
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: allTopics, firstAuthorOnly: false }).map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
    "firstAuthorOnly: false includes every paper regardless of authorship",
  );

  // firstAuthorOnly: true: only papers with firstAuthor: true pass
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: allTopics, firstAuthorOnly: true }).map((p) => p.id),
    ["p1", "p3"],
    "firstAuthorOnly: true hides papers where firstAuthor is false",
  );

  // combines as AND with the date-range filter
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 60, activeTopics: allTopics, firstAuthorOnly: true }).map((p) => p.id),
    ["p1"],
    "p3 is first-author but outside the date range, so it must be excluded (AND, not OR)",
  );

  // combines as AND with the topic filter
  assert.deepStrictEqual(
    filterPapers(papers, { startMs: 0, endMs: 150, activeTopics: new Set(["c"]), firstAuthorOnly: true }).map((p) => p.id),
    [],
    "p4 matches the topic filter but not firstAuthorOnly, so it must be excluded (AND, not OR)",
  );
}

// integration: filterPapers -> packCards must still produce non-overlapping placements
{
  const papers = [
    { id: "p1", date: 0, topics: ["a"] },
    { id: "p2", date: 5, topics: ["a"] },
    { id: "p3", date: 10, topics: ["a"] },
    { id: "p4", date: 15, topics: ["a"] },
    { id: "p5", date: 1000, topics: ["b"] }, // filtered out below
  ];
  const visible = filterPapers(papers, { startMs: 0, endMs: 20, activeTopics: new Set(["a"]) });
  const packed = packCards(
    visible.map((p) => ({ id: p.id, idealPosition: p.date })),
    20,
    5,
  );
  assert.strictEqual(packed.length, 4, "only the 4 in-range, in-topic papers get packed");
  const bySide = { left: [], right: [] };
  packed.forEach((r) => bySide[r.side].push(r));
  ["left", "right"].forEach((side) => {
    const placed = bySide[side].sort((a, b) => a.top - b.top);
    for (let i = 1; i < placed.length; i++) {
      assert.ok(placed[i].top >= placed[i - 1].top + 20, `filtered+packed ${side} cards must not overlap`);
    }
  });
}

// computeRequiredTrackHeight: the bar/track must always be at least as tall as
// the space packCards actually needs, so the bar never ends before the last
// card (the "dead zone" bug: CARD_HEIGHT grew from 92->112 for venue text,
// pushing maxCardBottom past the old fixed TRACK_HEIGHT).
{
  // sparse cards well within the baseline height: required height is just the baseline
  const cards = [
    { id: "a", idealPosition: 0 },
    { id: "b", idealPosition: 100 },
    { id: "c", idealPosition: 200 },
  ];
  const height = computeRequiredTrackHeight(cards, 20, 10, 500);
  assert.strictEqual(height, 500, "sparse cards that fit within the baseline don't grow the track");
}

{
  // no cards at all: required height is just the baseline, not 0
  const height = computeRequiredTrackHeight([], 20, 10, 500);
  assert.strictEqual(height, 500, "no cards falls back to the baseline height");
}

{
  // clustered cards on one side need more room than the baseline provides
  const cards = [
    { id: "a", idealPosition: 0 },
    { id: "b", idealPosition: 2 },
    { id: "c", idealPosition: 4 },
    { id: "d", idealPosition: 6 },
    { id: "e", idealPosition: 8 },
  ];
  const cardHeight = 100;
  const minGap = 10;
  const baseline = 50;
  const height = computeRequiredTrackHeight(cards, cardHeight, minGap, baseline);

  const packed = packCards(cards, cardHeight, minGap);
  const maxBottom = Math.max(...packed.map((c) => c.top + cardHeight));
  assert.strictEqual(height, maxBottom, "cramped cards grow the track to exactly fit the deepest packed card");
  assert.ok(height > baseline, "the computed height must actually exceed the too-small baseline in this case");
}

{
  // regression guard for the real bug: the returned height must never leave a
  // dead zone below the last card when re-packed at that same height
  const cards = [
    { id: "a", idealPosition: 0 },
    { id: "b", idealPosition: 1 },
    { id: "c", idealPosition: 2 },
    { id: "d", idealPosition: 3 },
    { id: "e", idealPosition: 4 },
    { id: "f", idealPosition: 5 },
  ];
  const cardHeight = 112;
  const minGap = 12;
  const height = computeRequiredTrackHeight(cards, cardHeight, minGap, 100);
  const packed = packCards(cards, cardHeight, minGap);
  packed.forEach((c) => {
    assert.ok(c.top + cardHeight <= height, `card ${c.id} bottom (${c.top + cardHeight}) must not exceed the computed track height (${height})`);
  });
}

// positionToDate: the inverse of dateToPosition, needed to convert a mouse
// position on the bar back into a date for the hover tooltip.
assert.strictEqual(positionToDate(0, 0, 1000, 500), 0, "position 0 maps to earliest time");
assert.strictEqual(positionToDate(500, 0, 1000, 500), 1000, "position at trackHeight maps to latest time");
assert.strictEqual(positionToDate(250, 0, 1000, 500), 500, "midpoint position maps to midpoint time");
assert.strictEqual(positionToDate(-50, 0, 1000, 500), 0, "position before the track clamps to the earliest time");
assert.strictEqual(positionToDate(600, 0, 1000, 500), 1000, "position past the track clamps to the latest time");

{
  // round-trip: dateToPosition then positionToDate must recover the original time
  const minTime = 1000;
  const maxTime = 100000;
  const trackHeight = 5600;
  [minTime, maxTime, 50000, 12345].forEach((time) => {
    const position = dateToPosition(time, minTime, maxTime, trackHeight);
    assert.strictEqual(positionToDate(position, minTime, maxTime, trackHeight), time, `round-trip must recover ${time}`);
  });
}

// computeCompactPositions: "compact time" mode — evenly-spaced, rank-based
// positions instead of real-elapsed-time proportional ones, so the bar is
// only ever as long as needed to list every distinct paper date.
{
  assert.deepStrictEqual(computeCompactPositions([], 20), [], "no times produces no axis points");
}

{
  assert.deepStrictEqual(computeCompactPositions([100], 20), [{ time: 100, position: 0 }], "a single time sits at position 0");
}

{
  // unsorted, with a duplicate: output must be sorted, duplicates collapsed to one entry
  const result = computeCompactPositions([300, 100, 300, 200], 20);
  assert.deepStrictEqual(
    result,
    [
      { time: 100, position: 0 },
      { time: 200, position: 20 },
      { time: 300, position: 40 },
    ],
    "distinct times get evenly-spaced ranks in ascending order; duplicates collapse to one axis point",
  );
}

// interpolateOnAxis: maps an arbitrary time onto the compact (piecewise-linear)
// axis built by computeCompactPositions, so job-boundary dates (which rarely
// land exactly on a paper's date) still get a sensible position.
{
  assert.strictEqual(interpolateOnAxis(500, []), 0, "an empty axis falls back to position 0");
}

{
  const axis = computeCompactPositions([0, 100, 200], 50);
  assert.strictEqual(interpolateOnAxis(0, axis), 0, "a time exactly on an axis point returns that point's position");
  assert.strictEqual(interpolateOnAxis(100, axis), 50, "a time exactly on a middle axis point returns that point's position");
  assert.strictEqual(interpolateOnAxis(50, axis), 25, "a time halfway between two axis points interpolates linearly");
  assert.strictEqual(interpolateOnAxis(-100, axis), 0, "a time before the first axis point clamps to its position");
  assert.strictEqual(interpolateOnAxis(500, axis), 100, "a time after the last axis point clamps to its position");
}

// interpolateAxisInverse: the inverse of interpolateOnAxis (position -> time),
// needed so the hover tooltip still shows a sensible date in compact mode.
{
  assert.strictEqual(interpolateAxisInverse(30, []), 0, "an empty axis falls back to time 0");
}

{
  const axis = computeCompactPositions([0, 100, 200], 50);
  assert.strictEqual(interpolateAxisInverse(0, axis), 0, "a position exactly on an axis point returns that point's time");
  assert.strictEqual(interpolateAxisInverse(50, axis), 100, "a position exactly on a middle axis point returns that point's time");
  assert.strictEqual(interpolateAxisInverse(25, axis), 50, "a position halfway between two axis points interpolates linearly");
  assert.strictEqual(interpolateAxisInverse(-40, axis), 0, "a position before the first axis point clamps to its time");
  assert.strictEqual(interpolateAxisInverse(1000, axis), 200, "a position after the last axis point clamps to its time");
}

{
  // round-trip: interpolateOnAxis then interpolateAxisInverse recovers the
  // original time for any value that lands within the axis's range
  const axis = computeCompactPositions([10, 40, 90, 91, 200], 30);
  [10, 40, 65, 90, 91, 150, 200].forEach((time) => {
    const position = interpolateOnAxis(time, axis);
    assert.strictEqual(interpolateAxisInverse(position, axis), time, `round-trip must recover ${time}`);
  });
}

console.log("timeline mock logic: all assertions passed.");
