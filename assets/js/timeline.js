// Career timeline widget (tasks/plan.md, Task 3.3). Adapted from the ad hoc
// preview (tasks/timeline_real_preview.html, Phase 1-2) to read real data
// instead of hardcoded arrays. Requires timeline_mock_logic.js to be loaded
// first (exposes window.TimelineMockLogic) and runs against the page
// skeleton in _pages/timeline.md (data islands + #timeline-widget markup).
(function () {
  // assets/css/timeline.css shrinks .timeline-card's width below ~762px
  // viewport width (clamp(150px, 42vw, 320px) stops growing past 320px
  // right around 42vw=320px, i.e. ~762px) so it fits without horizontal
  // overflow (Task 4.3's 375px check). Narrower cards wrap a paper's topic
  // pills onto more lines when it has 2 topics (measured: 137px actual vs
  // the 112px/1-topic-card assumption), so CARD_HEIGHT needs the same
  // breakpoint -- otherwise cards with 2 topics grow past what packCards
  // reserved and visually overlap the next same-side card.
  const NARROW_VIEWPORT_BREAKPOINT_PX = 762;
  let CARD_HEIGHT = window.innerWidth < NARROW_VIEWPORT_BREAKPOINT_PX ? 140 : 112;
  const CARD_MIN_GAP = 14;
  const TOP_PADDING = 20;
  const BASELINE_TRACK_HEIGHT = 5600;

  const now = Date.now();

  // --- Parse the three real-data islands ---------------------------------
  function parsePapersIsland() {
    const el = document.getElementById("timeline-papers-data");
    return Array.from(el.querySelectorAll("li")).map((li) => JSON.parse(li.textContent));
  }
  function parseJobsIsland() {
    return JSON.parse(document.getElementById("timeline-jobs-data").textContent);
  }
  function parseTopicColorsIsland() {
    return JSON.parse(document.getElementById("timeline-topic-colors-data").textContent);
  }

  const papers = parsePapersIsland().map((p) => ({
    id: p.key,
    title: p.title,
    venue: p.venue,
    venueShort: p.venue_short,
    date: TimelineMockLogic.parseMonthYear(p.year, p.month),
    approx: p.month_approximate,
    topics: p.topics,
    firstAuthor: p.first_author,
  }));

  // Job color and legend label have no source field in _data/cv.yml
  // (plan.md's Task 3.2 explicitly chose "no schema change" over adding
  // one), so this is a hardcoded lookup by company name, carried over from
  // the validated color set used in tasks/timeline_real_preview.html, with
  // a short display name added per Marta's request. A future job whose
  // company string isn't listed here falls back to a neutral gray and the
  // full company string rather than erroring -- update this map when a new
  // job is added.
  const JOB_META = {
    "Karlsruhe Institute of Technology (KIT), Germany": { color: "#9C36B5", shortName: "KIT" },
    "ESK Karlsruhe, Germany": { color: "#15AABF", shortName: "ESK" },
    "Johannes Kepler University Linz, Austria": { color: "#4C6EF5", shortName: "JKU" },
    "Deezer Research Team, Paris, France": { color: "#F76707", shortName: "Deezer" },
    "Albatross AI": { color: "#2F9E44", shortName: "Albatross" },
  };
  const DEFAULT_JOB_META = { color: "#888888", shortName: null };

  const jobs = parseJobsIsland().map((j, i) => {
    const meta = JOB_META[j.company] || DEFAULT_JOB_META;
    return {
      id: "job-" + i,
      label: meta.shortName || j.company,
      color: meta.color,
      start: TimelineMockLogic.parseJobDate(j.start_date, now),
      end: TimelineMockLogic.parseJobDate(j.end_date, now),
    };
  });

  // Topic colors ARE real per-topic data (_data/timeline_colors.yml) with
  // both light and dark values, already validated for both via the dataviz
  // skill (see that file's own header comment) -- unlike job colors, this
  // is cheap to make theme-aware: inject --topic-<id> custom properties for
  // both html:root (light) and html[data-theme="dark"], then reference them
  // by var() everywhere instead of a resolved hex string, so a live theme
  // toggle re-colors the widget with zero JS re-render needed.
  const topicColors = parseTopicColorsIsland();
  const topicIds = Object.keys(topicColors);
  // No single fixed text color (all-white or all-black) clears WCAG AA
  // 4.5:1 against every real topic color in both light and dark mode --
  // pickContrastingTextColor picks whichever of pure black/white contrasts
  // better against each one, so a --topic-<id>-text pair is injected
  // alongside --topic-<id> for anything that puts text directly on a topic
  // color (currently just .timeline-topic-pill).
  (function injectTopicColorVars() {
    const lines = [":root {"];
    topicIds.forEach((id) => {
      lines.push(`  --topic-${id}: ${topicColors[id].light};`);
      lines.push(`  --topic-${id}-text: ${TimelineMockLogic.pickContrastingTextColor(topicColors[id].light)};`);
    });
    lines.push('}', 'html[data-theme="dark"] {');
    topicIds.forEach((id) => {
      lines.push(`  --topic-${id}: ${topicColors[id].dark};`);
      lines.push(`  --topic-${id}-text: ${TimelineMockLogic.pickContrastingTextColor(topicColors[id].dark)};`);
    });
    lines.push("}");
    const styleEl = document.createElement("style");
    styleEl.textContent = lines.join("\n");
    document.head.appendChild(styleEl);
  })();
  const topicColorVar = (topicId) => `var(--topic-${topicId})`;
  const topicTextColorVar = (topicId) => `var(--topic-${topicId}-text)`;

  const minTime = Math.min(...jobs.map((j) => j.start));
  const maxTime = Math.max(...jobs.map((j) => j.end), ...papers.map((p) => p.date));
  const DEFAULT_RANGE_START = TimelineMockLogic.parseJobDate("2021-10", now);

  // Time-to-pixel mapping always uses this fixed scale, so the bar stays
  // strictly linear/proportional to elapsed time. See
  // tasks/timeline_real_preview.html's own comment for the fuller
  // rationale (same fix, ported unchanged).
  let effectiveTrackHeight = BASELINE_TRACK_HEIGHT;
  const pos = (time) => TOP_PADDING + TimelineMockLogic.dateToPosition(time, minTime, maxTime, BASELINE_TRACK_HEIGHT);

  // --- "Compact time" mode -------------------------------------------------
  // CARD_HEIGHT-dependent (PITCH folds it into the rank spacing itself), so
  // this whole block needs to be re-run whenever CARD_HEIGHT changes --
  // wrapped in a function rather than one-shot top-level consts, called
  // once at startup and again on every resize (see the "resize" listener
  // below), not just on filter changes -- compact mode's positions still
  // stay filter-invariant, per Marta's original spec, since resizing isn't
  // a filter.
  let compactAxis, compactPos, compactPackedById;
  function setupCompactLayout() {
    const pitch = CARD_HEIGHT + CARD_MIN_GAP;
    compactAxis = TimelineMockLogic.computeCompactPositions(papers.map((p) => p.date), pitch);
    compactPos = (time) => TOP_PADDING + TimelineMockLogic.interpolateOnAxis(time, compactAxis);
    const compactPacked = TimelineMockLogic.packCards(
      papers.map((p) => ({ id: p.id, idealPosition: compactPos(p.date) })),
      CARD_HEIGHT,
      CARD_MIN_GAP,
    );
    compactPackedById = Object.fromEntries(compactPacked.map((p) => [p.id, p]));
  }
  setupCompactLayout();

  let compactMode = true;
  let cropOffset = 0;
  // Inert for now (Task 1 of tasks/plan.md): render() doesn't branch on this
  // yet. Wired up ahead of the actual horizontal rendering work so the
  // control itself, its markup, and its event wiring can be verified in
  // isolation before any rendering logic depends on it.
  let orientation = "vertical";

  // --- DOM refs -------------------------------------------------------------
  const container = document.getElementById("timeline-container");
  const track = document.getElementById("timeline-track");
  const svg = document.getElementById("timeline-leader-lines");
  const hoverZone = document.getElementById("timeline-track-hover-zone");
  const hoverIndicator = document.getElementById("timeline-hover-indicator");
  const hoverTooltip = document.getElementById("timeline-hover-tooltip");
  const topicFieldset = document.getElementById("timeline-topic-filters");
  const firstAuthorOnly = document.getElementById("timeline-first-author-only");
  const rangeStart = document.getElementById("timeline-range-start");
  const rangeEnd = document.getElementById("timeline-range-end");
  const rangeReset = document.getElementById("timeline-range-reset");
  const scaleModeInputs = document.querySelectorAll('input[name="timeline-scale-mode"]');
  const orientationInputs = document.querySelectorAll('input[name="timeline-orientation-mode"]');

  const monthInput = (time) => new Date(time).toISOString().slice(0, 7);
  rangeStart.value = monthInput(DEFAULT_RANGE_START);
  rangeEnd.value = monthInput(maxTime);

  const topicLabel = (topicId) => topicId.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

  topicIds.forEach((topicId) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.dataset.topic = topicId;
    const swatch = document.createElement("span");
    swatch.className = "timeline-legend-swatch";
    swatch.style.background = topicColorVar(topicId);
    label.appendChild(input);
    label.appendChild(swatch);
    label.appendChild(document.createTextNode(topicLabel(topicId)));
    topicFieldset.appendChild(label);
  });

  const jobLegend = document.getElementById("timeline-job-legend");
  jobs.forEach((job) => {
    // Not a real form control (nothing to check/select) -- a plain span
    // with role="listitem", not <label>, which implies control association.
    const item = document.createElement("span");
    item.className = "timeline-job-legend-item";
    item.setAttribute("role", "listitem");
    const swatch = document.createElement("span");
    swatch.className = "timeline-legend-swatch";
    swatch.style.background = job.color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(job.label));
    jobLegend.appendChild(item);
  });

  track.style.top = TOP_PADDING + "px";
  hoverZone.style.top = TOP_PADDING + "px";

  function formatDate(time) {
    return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }

  hoverZone.addEventListener("mousemove", (e) => {
    const y = e.clientY - hoverZone.getBoundingClientRect().top;
    const realPosition = y + cropOffset;
    const date = compactMode
      ? TimelineMockLogic.interpolateAxisInverse(realPosition, compactAxis)
      : TimelineMockLogic.positionToDate(realPosition, minTime, maxTime, BASELINE_TRACK_HEIGHT);
    hoverIndicator.style.top = hoverTooltip.style.top = TOP_PADDING + y + "px";
    hoverIndicator.style.display = hoverTooltip.style.display = "block";
    hoverTooltip.textContent = formatDate(date);
  });
  hoverZone.addEventListener("mouseleave", () => {
    hoverIndicator.style.display = hoverTooltip.style.display = "none";
  });

  function renderTrack(segments, posFn) {
    track.innerHTML = "";
    segments.forEach((seg) => {
      const el = document.createElement("div");
      el.className = "timeline-track-segment";
      const top = posFn(seg.start) - cropOffset;
      const height = Math.max(posFn(seg.end) - posFn(seg.start), 1);
      el.style.top = top + "px";
      el.style.height = height + "px";
      if (seg.colors.length === 1) {
        el.style.background = seg.colors[0];
      } else {
        const stripeSize = 14;
        el.style.background = `repeating-linear-gradient(45deg, ${seg.colors[0]} 0 ${stripeSize}px, ${seg.colors[1]} ${stripeSize}px ${stripeSize * 2}px)`;
      }
      track.appendChild(el);
    });
  }

  function activeFilters() {
    const startMs = rangeStart.value ? new Date(rangeStart.value + "-01").getTime() : minTime;
    const endMs = rangeEnd.value ? new Date(rangeEnd.value + "-01").getTime() : maxTime;
    const activeTopics = new Set(
      Array.from(topicFieldset.querySelectorAll("input[type=checkbox]:checked")).map((i) => i.dataset.topic),
    );
    return { startMs, endMs, activeTopics, firstAuthorOnly: firstAuthorOnly.checked };
  }

  function renderCards(visible, packedById, posFn) {
    container.querySelectorAll(".timeline-card").forEach((n) => n.remove());

    container.style.height = TOP_PADDING * 2 + effectiveTrackHeight + "px";
    svg.innerHTML = "";
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", container.style.height);

    visible.forEach((paper) => {
      const placement = packedById[paper.id];
      const card = document.createElement("div");
      card.className = "timeline-card " + placement.side;
      card.style.top = placement.top - cropOffset + "px";
      card.style.setProperty("--card-color", topicColorVar(paper.topics[0]));
      card.setAttribute("role", "group");
      const dateText = new Date(paper.date).toLocaleDateString(undefined, { year: "numeric", month: "short" });
      card.setAttribute(
        "aria-label",
        [
          paper.firstAuthor ? "First author." : null,
          paper.approx ? `Approximately ${dateText}.` : `${dateText}.`,
          `${paper.title}.`,
          `${paper.venue}.`,
          `Topics: ${paper.topics.map(topicLabel).join(", ")}.`,
        ]
          .filter(Boolean)
          .join(" "),
      );

      const dateEl = document.createElement("div");
      dateEl.className = "timeline-card-date";
      dateEl.innerHTML = paper.approx ? `<span class="timeline-approx">~${dateText}</span>` : dateText;
      card.appendChild(dateEl);

      const titleEl = document.createElement("div");
      titleEl.className = "timeline-card-title";
      titleEl.title = paper.title;
      if (paper.firstAuthor) {
        const star = document.createElement("span");
        star.className = "timeline-first-author-star";
        star.title = "First author or shared first authorship";
        star.setAttribute("aria-hidden", "true");
        star.textContent = "★ ";
        titleEl.appendChild(star);
      }
      titleEl.appendChild(document.createTextNode(paper.title));
      card.appendChild(titleEl);

      const venueEl = document.createElement("div");
      venueEl.className = "timeline-card-venue";
      venueEl.textContent = paper.venueShort;
      venueEl.title = paper.venue;
      card.appendChild(venueEl);

      const topicsEl = document.createElement("div");
      topicsEl.className = "timeline-card-topics";
      paper.topics.forEach((tp) => {
        const pill = document.createElement("span");
        pill.className = "timeline-topic-pill";
        pill.style.background = topicColorVar(tp);
        pill.style.color = topicTextColorVar(tp);
        pill.textContent = topicLabel(tp);
        topicsEl.appendChild(pill);
      });
      card.appendChild(topicsEl);

      container.appendChild(card);

      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const cardMidY = placement.top - cropOffset + CARD_HEIGHT / 2;
      const barY = posFn(paper.date) - cropOffset;
      const barX = containerRect.width / 2;
      const cardEdgeX = placement.side === "left" ? cardRect.right - containerRect.left : cardRect.left - containerRect.left;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", cardEdgeX);
      line.setAttribute("y1", cardMidY);
      line.setAttribute("x2", barX + (placement.side === "left" ? -7 : 7));
      line.setAttribute("y2", barY);
      svg.appendChild(line);
    });
  }

  function render() {
    const filters = activeFilters();
    const visible = TimelineMockLogic.filterPapers(papers, filters);

    let packedById;
    let posFn;
    if (compactMode) {
      packedById = compactPackedById;
      posFn = compactPos;
    } else {
      const idealPositions = visible.map((p) => ({ id: p.id, idealPosition: pos(p.date) }));
      const packed = TimelineMockLogic.packCards(idealPositions, CARD_HEIGHT, CARD_MIN_GAP);
      packedById = Object.fromEntries(packed.map((p) => [p.id, p]));
      posFn = pos;
    }

    const allSegments = TimelineMockLogic.computeJobSegments(
      jobs.map((j) => ({ id: j.id, color: j.color, startTime: j.start, endTime: j.end })),
    );
    const segments = TimelineMockLogic.clipSegmentsToRange(allSegments, filters.startMs, filters.endMs);

    const pairs = segments.map((seg) => [posFn(seg.start), posFn(seg.end)]);
    visible.forEach((p) => {
      const top = packedById[p.id].top;
      pairs.push([top, top + CARD_HEIGHT]);
    });
    const bounds = TimelineMockLogic.computeContentBounds(pairs);
    const contentTop = bounds ? bounds.top : TOP_PADDING;
    const contentBottom = bounds ? bounds.bottom : TOP_PADDING;
    cropOffset = contentTop - TOP_PADDING;
    effectiveTrackHeight = Math.max(contentBottom - contentTop, 0);

    track.style.height = effectiveTrackHeight + "px";
    hoverZone.style.height = effectiveTrackHeight + "px";

    renderTrack(segments, posFn);
    renderCards(visible, packedById, posFn);
  }

  [rangeStart, rangeEnd].forEach((el) => el.addEventListener("change", render));
  topicFieldset.addEventListener("change", render);
  firstAuthorOnly.addEventListener("change", render);
  scaleModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      compactMode = document.querySelector('input[name="timeline-scale-mode"]:checked').value === "compact";
      render();
    });
  });
  orientationInputs.forEach((input) => {
    input.addEventListener("change", () => {
      orientation = document.querySelector('input[name="timeline-orientation-mode"]:checked').value;
      render();
    });
  });
  rangeReset.addEventListener("click", () => {
    rangeStart.value = monthInput(DEFAULT_RANGE_START);
    rangeEnd.value = monthInput(maxTime);
    topicFieldset.querySelectorAll("input[type=checkbox]").forEach((i) => (i.checked = true));
    firstAuthorOnly.checked = false;
    render();
  });

  // CSS makes .timeline-card's width genuinely viewport-dependent
  // (clamp(150px, 42vw, 320px) -- see the CARD_HEIGHT comment above), so a
  // live browser resize after the initial render leaves the CSS-driven
  // width/position correct but every JS-computed value (CARD_HEIGHT, the
  // compact-mode packing built from it, and the leader lines' <line>
  // coordinates, which are one-shot getBoundingClientRect() snapshots)
  // stale -- cards can drift back into overlapping each other, and leader
  // lines visibly detach from their card as its real position moves out
  // from under them. Debounced so a continuous drag-resize doesn't
  // recompute on every intermediate frame.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      CARD_HEIGHT = window.innerWidth < NARROW_VIEWPORT_BREAKPOINT_PX ? 140 : 112;
      setupCompactLayout();
      render();
    }, 150);
  });

  render();
})();
