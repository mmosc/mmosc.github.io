---
layout: page
permalink: /timeline/
title: timeline
description:
nav: false
nav_order: 5
---

<!--
  Task 3.2 (tasks/plan.md): page skeleton with the two real-data "islands"
  the widget will read from. nav stays false until Task 4.1 (nav + page
  chrome) — this page has no rendering JS/CSS wired up yet (Task 3.3).
-->

<div id="timeline-widget"></div>

<!--
  jekyll-scholar's {% bibliography %} tag always wraps its output in
  <ol class="bibliography"><li>...</li>...</ol>, even with a custom -T
  template (confirmed in Task 3.1's spike test) — there is no way to get
  a bare JSON array out of it directly. So this island is a hidden list
  of individually-JSON <li> elements, not a single JSON blob: parse it
  client-side as `Array.from(el.querySelectorAll("li")).map(li =>
  JSON.parse(li.textContent))`, exactly as Task 3.1's own verification
  script did against the built HTML.
-->
<div id="timeline-papers-data" hidden>
{% bibliography -f papers -q @* -T timeline_pub_entry %}
</div>

<!--
  Job data has no plugin constraint, so this one is a real, directly
  parseable JSON array: `JSON.parse(el.textContent)`.
-->
<script type="application/json" id="timeline-jobs-data">
{{ site.data.cv.cv.sections.experience | jsonify }}
</script>

<link rel="stylesheet" href="{{ '/assets/css/timeline.css' | relative_url }}" />
<script src="{{ '/assets/js/timeline.js' | relative_url }}"></script>
