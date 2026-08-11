// Independent of assets/js/timeline.js on purpose: re-parses the same data
// islands and listens to the same filter controls instead of timeline.js
// exposing a hook, so this file's diff can't collide with concurrent work on
// timeline.js on another branch.
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GAP_UNITS = 3;
  const RING_SIZE = 160;
  const RING_CENTER = RING_SIZE / 2;
  const RING_RADIUS = 60;
  const RING_STROKE = 24;
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  // Same 14px/45deg stripe convention timeline.css already uses for overlapping job segments.
  const STRIPE_SIZE = 14;

  function parsePapersIsland() {
    const el = document.getElementById("timeline-papers-data");
    return Array.from(el.querySelectorAll("li")).map((li) => JSON.parse(li.textContent));
  }

  const papers = parsePapersIsland().map((p) => ({
    id: p.key,
    venueShort: p.venue_short,
    date: TimelineMockLogic.parseMonthYear(p.year, p.month),
    topics: p.topics,
    firstAuthor: p.first_author,
    phdRelevant: p.phd_relevant,
  }));

  const topicLabel = (topicId) =>
    topicId
      .split("-")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");

  const minPaperTime = Math.min(...papers.map((p) => p.date));
  const maxPaperTime = Math.max(...papers.map((p) => p.date));

  const rangeStart = document.getElementById("timeline-range-start");
  const rangeEnd = document.getElementById("timeline-range-end");
  const topicFieldset = document.getElementById("timeline-topic-filters");
  const firstAuthorOnly = document.getElementById("timeline-first-author-only");
  const phdOnly = document.getElementById("timeline-phd-only");
  const rangeReset = document.getElementById("timeline-range-reset");
  const scaleModeInputs = document.querySelectorAll('input[name="timeline-scale-mode"]');

  function activeFilters() {
    const startMs = rangeStart.value ? new Date(rangeStart.value + "-01").getTime() : minPaperTime;
    const endMs = rangeEnd.value ? new Date(rangeEnd.value + "-01").getTime() : maxPaperTime;
    const activeTopics = new Set(Array.from(topicFieldset.querySelectorAll("input[type=checkbox]:checked")).map((i) => i.dataset.topic));
    return { startMs, endMs, activeTopics, firstAuthorOnly: firstAuthorOnly.checked, phdOnly: phdOnly.checked };
  }

  // items: [{ key, label, value, strokeColor, swatchBackground, breakdown? }] drive the ring
  // and table (full detail); legendItems (defaults to items) can be a coarser,
  // independently-aggregated set -- e.g. one row per venue family instead of
  // one per raw venue. Zero-value entries are dropped from all three.
  function renderDonut({ ringEl, legendEl, tableBodyEl, items, legendItems, showLegendCount = true }) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const visibleItems = items.filter((item) => item.value > 0);
    const visibleLegendItems = (legendItems || items).filter((item) => item.value > 0);

    ringEl.innerHTML = "";
    ringEl.setAttribute("viewBox", `0 0 ${RING_SIZE} ${RING_SIZE}`);
    let cumulative = 0;
    visibleItems.forEach((item) => {
      const fraction = total > 0 ? item.value / total : 0;
      const rawLength = fraction * CIRCUMFERENCE;
      const length = visibleItems.length > 1 ? Math.max(rawLength - GAP_UNITS, 0) : rawLength;
      const offset = -cumulative;
      cumulative += rawLength;

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", RING_CENTER);
      circle.setAttribute("cy", RING_CENTER);
      circle.setAttribute("r", RING_RADIUS);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", item.strokeColor);
      circle.setAttribute("stroke-width", RING_STROKE);
      circle.setAttribute("stroke-dasharray", `${length} ${CIRCUMFERENCE - length}`);
      circle.setAttribute("stroke-dashoffset", offset);
      circle.setAttribute("transform", `rotate(-90 ${RING_CENTER} ${RING_CENTER})`);
      circle.classList.add("timeline-distribution-segment");
      circle.setAttribute("tabindex", "0");
      circle.setAttribute("role", "img");
      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
      circle.setAttribute("aria-label", `${item.label}: ${item.value} paper${item.value === 1 ? "" : "s"}, ${pct}%`);

      ringEl.appendChild(circle);
    });

    legendEl.innerHTML = "";
    visibleLegendItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "timeline-distribution-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "timeline-legend-swatch";
      swatch.style.background = item.swatchBackground;
      swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "timeline-distribution-legend-label";
      label.textContent = item.label;
      li.appendChild(swatch);
      li.appendChild(label);
      if (showLegendCount) {
        const count = document.createElement("span");
        count.className = "timeline-distribution-legend-count";
        count.textContent = item.value;
        li.appendChild(count);
      }
      legendEl.appendChild(li);
    });

    tableBodyEl.innerHTML = "";
    visibleItems.forEach((item) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = item.label;
      const td = document.createElement("td");
      td.textContent = item.value;
      tr.appendChild(th);
      tr.appendChild(td);
      tableBodyEl.appendChild(tr);
      if (item.breakdown && item.breakdown.length > 1) {
        item.breakdown.forEach((sub) => {
          const subTr = document.createElement("tr");
          subTr.className = "timeline-distribution-table-subrow";
          const subTh = document.createElement("th");
          subTh.scope = "row";
          subTh.textContent = sub.label;
          const subTd = document.createElement("td");
          subTd.textContent = sub.value;
          subTr.appendChild(subTh);
          subTr.appendChild(subTd);
          tableBodyEl.appendChild(subTr);
        });
      }
    });
  }

  const topicRingEl = document.getElementById("timeline-distribution-topic-ring");
  const topicLegendEl = document.getElementById("timeline-distribution-topic-legend");
  const topicTableBodyEl = document.querySelector("#timeline-distribution-topic-table tbody");

  // A paper's topic *set* is its category -- a 2-topic paper is one paper in
  // one combo slice, not one count in each topic's own slice (that double
  // counted papers and made slice sizes not add up to the paper count).
  // Multi-topic combos render as a 45deg stripe of their topics' colors,
  // mirroring how timeline.css already stripes overlapping job segments on
  // the main bar. Universe of combos (and their colors/patterns) is computed
  // once from the full dataset, same "never recolor on filter" rule as venues.
  function comboKey(topics) {
    return [...topics].sort().join("+");
  }
  const comboTotals = {};
  const comboTopicsByKey = {};
  papers.forEach((p) => {
    const key = comboKey(p.topics);
    comboTotals[key] = (comboTotals[key] || 0) + 1;
    comboTopicsByKey[key] = [...p.topics].sort();
  });
  const comboKeys = Object.keys(comboTotals).sort((a, b) => comboTotals[b] - comboTotals[a] || a.localeCompare(b));

  const patternHost = document.createElementNS(SVG_NS, "svg");
  patternHost.setAttribute("aria-hidden", "true");
  patternHost.style.position = "absolute";
  patternHost.style.width = "0";
  patternHost.style.height = "0";
  patternHost.style.overflow = "hidden";
  const patternDefs = document.createElementNS(SVG_NS, "defs");
  patternHost.appendChild(patternDefs);
  document.body.appendChild(patternHost);

  const comboStyle = {};
  comboKeys.forEach((key, i) => {
    const topics = comboTopicsByKey[key];
    const label = topics.map(topicLabel).join(" + ");
    if (topics.length === 1) {
      const colorVar = `var(--topic-${topics[0]})`;
      comboStyle[key] = { label, strokeColor: colorVar, swatchBackground: colorVar };
      return;
    }
    const patternId = `timeline-topic-combo-stripe-${i}`;
    const tileSize = STRIPE_SIZE * topics.length;
    const pattern = document.createElementNS(SVG_NS, "pattern");
    pattern.setAttribute("id", patternId);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", tileSize);
    pattern.setAttribute("height", tileSize);
    pattern.setAttribute("patternTransform", "rotate(45)");
    topics.forEach((topicId, stripeIndex) => {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", stripeIndex * STRIPE_SIZE);
      rect.setAttribute("y", 0);
      rect.setAttribute("width", STRIPE_SIZE);
      rect.setAttribute("height", tileSize);
      rect.setAttribute("fill", `var(--topic-${topicId})`);
      pattern.appendChild(rect);
    });
    patternDefs.appendChild(pattern);
    const gradientStops = topics.map((t, idx) => `var(--topic-${t}) ${idx * STRIPE_SIZE}px ${(idx + 1) * STRIPE_SIZE}px`).join(", ");
    comboStyle[key] = {
      label,
      strokeColor: `url(#${patternId})`,
      swatchBackground: `repeating-linear-gradient(45deg, ${gradientStops})`,
    };
  });

  function renderTopicDonut(visiblePapers) {
    const counts = {};
    visiblePapers.forEach((p) => {
      const key = comboKey(p.topics);
      counts[key] = (counts[key] || 0) + 1;
    });
    const items = comboKeys.map((key) => ({
      key,
      label: comboStyle[key].label,
      value: counts[key] || 0,
      strokeColor: comboStyle[key].strokeColor,
      swatchBackground: comboStyle[key].swatchBackground,
    }));
    // Legend explains what each color means (the single topics); a striped
    // wedge is self-explanatory as "both" once those colors are known, so
    // combinations don't get their own legend row (still in the ring and table).
    const legendItems = items.filter((item) => comboTopicsByKey[item.key].length === 1);
    renderDonut({ ringEl: topicRingEl, legendEl: topicLegendEl, tableBodyEl: topicTableBodyEl, items, legendItems, showLegendCount: false });
  }

  // "MuRS @ ACM RecSys" -> family "ACM RecSys"; "ACM UMAP Workshops" -> family "ACM UMAP".
  function venueFamily(venueShort) {
    const atIndex = venueShort.indexOf(" @ ");
    if (atIndex !== -1) return venueShort.slice(atIndex + 3);
    const workshopMatch = venueShort.match(/^(.*?)\s+Workshops?$/i);
    if (workshopMatch) return workshopMatch[1];
    return venueShort;
  }

  // Computed once from the full, unfiltered paper list so slice colors never
  // repaint as filters change which papers are visible.
  const familyTotals = {};
  const familyRawVenues = {};
  papers.forEach((p) => {
    const fam = venueFamily(p.venueShort);
    familyTotals[fam] = (familyTotals[fam] || 0) + 1;
    (familyRawVenues[fam] = familyRawVenues[fam] || new Set()).add(p.venueShort);
  });

  // dataviz skill's validated categorical palette (references/palette.md).
  // Workshops within one family step lightness on that hue instead of
  // consuming a new slot.
  const VENUE_BASE_HUES = [
    { light: "#2a78d6", dark: "#3987e5" },
    { light: "#eb6834", dark: "#d95926" },
    { light: "#1baf7a", dark: "#199e70" },
    { light: "#eda100", dark: "#c98500" },
    { light: "#e87ba4", dark: "#d55181" },
    { light: "#008300", dark: "#008300" },
    { light: "#4a3aa7", dark: "#9085e9" },
    { light: "#e34948", dark: "#e66767" },
  ];
  const VENUE_OTHER_GRAY = { light: "#898781", dark: "#898781" };

  const coloredFamilies = Object.keys(familyTotals)
    .filter((fam) => familyTotals[fam] >= 2)
    .sort((a, b) => familyTotals[b] - familyTotals[a] || a.localeCompare(b))
    .slice(0, VENUE_BASE_HUES.length);

  const familyRawOrder = {};
  coloredFamilies.forEach((fam) => {
    familyRawOrder[fam] = Array.from(familyRawVenues[fam]).sort((a, b) => {
      if (a === fam) return -1;
      if (b === fam) return 1;
      return a.localeCompare(b);
    });
  });

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex([r, g, b]) {
    return (
      "#" +
      [r, g, b]
        .map((v) =>
          Math.round(Math.min(255, Math.max(0, v)))
            .toString(16)
            .padStart(2, "0")
        )
        .join("")
    );
  }
  function rgbToHsl([r8, g8, b8]) {
    const r = r8 / 255,
      g = g8 / 255,
      b = b8 / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToRgb(h360, s100, l100) {
    const h = h360 / 360,
      s = s100 / 100,
      l = l100 / 100;
    if (s === 0) {
      const v = l * 255;
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p2, q2, t2) => {
      let t = t2;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
      if (t < 1 / 2) return q2;
      if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
      return p2;
    };
    return [255 * hue2rgb(p, q, h + 1 / 3), 255 * hue2rgb(p, q, h), 255 * hue2rgb(p, q, h - 1 / 3)];
  }
  const SHADE_STEP_PCT = 12;
  const MAX_LIGHTNESS_PCT = 84;
  // Spacing shrinks to fit each family's own lightness headroom so a family
  // with many raw venues (e.g. 5) never collides two steps on the same clamped hex.
  function shadeHex(baseHex, step, stepsInFamily) {
    if (step === 0) return baseHex;
    const [h, s, l] = rgbToHsl(hexToRgb(baseHex));
    const evenSpacing = (MAX_LIGHTNESS_PCT - l) / (stepsInFamily - 1);
    const spacing = Math.min(SHADE_STEP_PCT, evenSpacing);
    return rgbToHex(hslToRgb(h, s, l + step * spacing));
  }

  (function injectVenueColorVars() {
    const lightLines = [":root {"];
    const darkLines = ['html[data-theme="dark"] {'];
    coloredFamilies.forEach((fam, familyIndex) => {
      const hues = VENUE_BASE_HUES[familyIndex];
      const stepsInFamily = familyRawOrder[fam].length;
      familyRawOrder[fam].forEach((rawVenue, step) => {
        const lightHex = shadeHex(hues.light, step, stepsInFamily);
        const darkHex = shadeHex(hues.dark, step, stepsInFamily);
        const varName = `--venue-slot-${familyIndex}-${step}`;
        lightLines.push(`  ${varName}: ${lightHex};`, `  ${varName}-text: ${TimelineMockLogic.pickContrastingTextColor(lightHex)};`);
        darkLines.push(`  ${varName}: ${darkHex};`, `  ${varName}-text: ${TimelineMockLogic.pickContrastingTextColor(darkHex)};`);
      });
    });
    lightLines.push(
      `  --venue-other: ${VENUE_OTHER_GRAY.light};`,
      `  --venue-other-text: ${TimelineMockLogic.pickContrastingTextColor(VENUE_OTHER_GRAY.light)};`,
      "}"
    );
    darkLines.push(
      `  --venue-other: ${VENUE_OTHER_GRAY.dark};`,
      `  --venue-other-text: ${TimelineMockLogic.pickContrastingTextColor(VENUE_OTHER_GRAY.dark)};`,
      "}"
    );
    const styleEl = document.createElement("style");
    styleEl.textContent = lightLines.join("\n") + "\n" + darkLines.join("\n");
    document.head.appendChild(styleEl);
  })();

  const rawVenueColorInfo = {};
  const familyBaseColorVar = {};
  coloredFamilies.forEach((fam, familyIndex) => {
    familyBaseColorVar[fam] = `var(--venue-slot-${familyIndex}-0)`;
    familyRawOrder[fam].forEach((rawVenue, step) => {
      rawVenueColorInfo[rawVenue] = { colorVar: `var(--venue-slot-${familyIndex}-${step})`, family: fam };
    });
  });

  const venueRingEl = document.getElementById("timeline-distribution-venue-ring");
  const venueLegendEl = document.getElementById("timeline-distribution-venue-legend");
  const venueTableBodyEl = document.querySelector("#timeline-distribution-venue-table tbody");

  function renderVenueDonut(visiblePapers) {
    const counts = {};
    visiblePapers.forEach((p) => {
      counts[p.venueShort] = (counts[p.venueShort] || 0) + 1;
    });

    const items = [];
    coloredFamilies.forEach((fam) => {
      familyRawOrder[fam].forEach((rawVenue) => {
        const info = rawVenueColorInfo[rawVenue];
        items.push({
          key: rawVenue,
          label: rawVenue,
          value: counts[rawVenue] || 0,
          strokeColor: info.colorVar,
          swatchBackground: info.colorVar,
        });
      });
    });

    const otherCounts = {};
    visiblePapers.forEach((p) => {
      if (!rawVenueColorInfo[p.venueShort]) otherCounts[p.venueShort] = (otherCounts[p.venueShort] || 0) + 1;
    });
    const otherTotal = Object.values(otherCounts).reduce((a, b) => a + b, 0);
    const otherBreakdown = Object.keys(otherCounts)
      .sort((a, b) => otherCounts[b] - otherCounts[a] || a.localeCompare(b))
      .map((rawVenue) => ({ label: rawVenue, value: otherCounts[rawVenue] }));
    const otherItem = {
      key: "other",
      label: "Other venues",
      value: otherTotal,
      strokeColor: "var(--venue-other)",
      swatchBackground: "var(--venue-other)",
      breakdown: otherBreakdown,
    };
    items.push(otherItem);

    // Legend rolls each family up to one row (main venue + all its workshops
    // combined), using the family's own base shade -- the ring and table
    // still carry the full per-workshop breakdown.
    const legendItems = coloredFamilies
      .map((fam) => ({
        key: fam,
        label: fam,
        value: familyRawOrder[fam].reduce((sum, rawVenue) => sum + (counts[rawVenue] || 0), 0),
        strokeColor: familyBaseColorVar[fam],
        swatchBackground: familyBaseColorVar[fam],
      }))
      .concat([otherItem]);

    renderDonut({ ringEl: venueRingEl, legendEl: venueLegendEl, tableBodyEl: venueTableBodyEl, items, legendItems });
  }

  function render() {
    const filters = activeFilters();
    const visible = TimelineMockLogic.filterPapers(papers, filters);
    renderTopicDonut(visible);
    renderVenueDonut(visible);
  }

  [rangeStart, rangeEnd].forEach((el) => el.addEventListener("change", render));
  topicFieldset.addEventListener("change", render);
  firstAuthorOnly.addEventListener("change", render);
  phdOnly.addEventListener("change", render);
  scaleModeInputs.forEach((input) => input.addEventListener("change", render));
  if (rangeReset) rangeReset.addEventListener("click", render);

  render();
})();
