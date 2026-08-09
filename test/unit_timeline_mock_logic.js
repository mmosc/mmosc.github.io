const assert = require("node:assert/strict");
const { dateToPosition, packCards, computeJobSegments } = require("../tasks/timeline_mock_logic.js");

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

console.log("timeline mock logic: all assertions passed.");
