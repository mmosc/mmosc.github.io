---
layout: page
permalink: /timeline/
title: timeline
description:
nav: true
nav_order: 5
---

<div id="timeline-widget">
  <div class="timeline-controls">
    <fieldset>
      <legend>Time range (month granularity)</legend>
      <div class="timeline-range-inputs">
        <input type="month" id="timeline-range-start" aria-label="Start month" />
        <span>to</span>
        <input type="month" id="timeline-range-end" aria-label="End month" />
        <button type="button" id="timeline-range-reset">Reset</button>
      </div>
    </fieldset>
    <fieldset id="timeline-topic-filters">
      <legend>Topics</legend>
    </fieldset>
    <fieldset id="timeline-author-filter">
      <legend>Authorship</legend>
      <label><input type="checkbox" id="timeline-first-author-only" /> First author only</label>
    </fieldset>
    <!-- Not real form controls (nothing to check/select), so plain spans
         rather than <label> -- a <label> with no associated input is a
         semantic misuse that some screen readers announce oddly. -->
    <fieldset id="timeline-job-legend" role="list" aria-label="Jobs, color-coded to the bar below">
      <legend>Jobs</legend>
    </fieldset>
    <fieldset id="timeline-scale-mode">
      <legend>Bar scale</legend>
      <label><input type="radio" name="timeline-scale-mode" value="proportional" /> Proportional to time</label>
      <label><input type="radio" name="timeline-scale-mode" value="compact" checked /> Compact (fit all papers)</label>
    </fieldset>
  </div>

  <div class="timeline-wrapper">
    <div class="timeline-container" id="timeline-container">
      <div class="timeline-track" id="timeline-track"></div>
      <svg class="timeline-leader-lines" id="timeline-leader-lines"></svg>
      <div class="timeline-track-hover-zone" id="timeline-track-hover-zone"></div>
      <div class="timeline-hover-indicator" id="timeline-hover-indicator"></div>
      <div class="timeline-hover-tooltip" id="timeline-hover-tooltip"></div>
      <!-- cards injected here by assets/js/timeline.js -->
    </div>
  </div>
</div>

<!--
  jekyll-scholar's bibliography tag always wraps its output in
  <ol class="bibliography"><li>...</li>...</ol>, even with a custom -T
  template (confirmed in Task 3.1's spike test) — there is no way to get
  a bare JSON array out of it directly. So this island is a hidden list
  of individually-JSON <li> elements, not a single JSON blob: parse it
  client-side as `Array.from(el.querySelectorAll("li")).map(li =>
  JSON.parse(li.textContent))`, exactly as Task 3.1's own verification
  script did against the built HTML.

  IMPORTANT: never write a literal "{​% ... %​}"-style tag delimiter in
  this file's prose (even inside an HTML comment or describing what a
  tag does) — Liquid processes the whole file as a template before HTML
  comment semantics apply, so it will execute. That mistake is exactly
  what caused this comment's own text to render a second, unfiltered,
  default-templated copy of the full bibliography as visible page
  content below the widget — found and fixed the same session.
-->
<div id="timeline-papers-data" hidden>
{% bibliography -f papers -q @* -T timeline_pub_entry %}
</div>

<!--
  Job and topic-color data have no plugin constraint, so both of these are
  real, directly parseable JSON: `JSON.parse(el.textContent)`.
-->
<script type="application/json" id="timeline-jobs-data">
{{ site.data.cv.cv.sections.experience | jsonify }}
</script>

<script type="application/json" id="timeline-topic-colors-data">
{{ site.data.timeline_colors | jsonify }}
</script>

<link rel="stylesheet" href="{{ '/assets/css/timeline.css' | relative_url }}" />
<script src="{{ '/assets/js/timeline_mock_logic.js' | relative_url }}"></script>
<script src="{{ '/assets/js/timeline.js' | relative_url }}"></script>
