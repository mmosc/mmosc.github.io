const assert = require("node:assert/strict");
const { dateToPosition, packCards, computeJobSegments, filterPapers } = require("../tasks/timeline_mock_logic.js");

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

console.log("timeline mock logic: all assertions passed.");
