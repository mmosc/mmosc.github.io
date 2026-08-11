module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  safelist: [
    "collapse",
    "collapsing",
    "show",
    "dropdown-menu",
    "dropdown-item",
    "table",
    "table-dark",
    "table-hover",
    "table-responsive",
    "af-tooltip",
    "af-popover",
    "font-weight-bold",
    "font-weight-medium",
    "font-weight-lighter",
    // medium-zoom injects these at runtime, so they never appear in the static
    // HTML PurgeCSS scans; without them the zoom overlay's z-index rule is purged
    // and page chrome (scroll-progress bar, ToC) bleeds through a zoomed image.
    "medium-zoom-overlay",
    "medium-zoom-image--opened",
    // assets/js/timeline.js's laneClass() builds these via string concatenation
    // (base + "-far"), so the literal tokens never appear in timeline.js's own
    // source text for PurgeCSS's extractor to find. Without them, horizontal
    // mode's second-row cards lose their top/bottom offset and visually overlap
    // the near-lane cards -- invisible locally since `jekyll serve` never runs
    // PurgeCSS, only the production deploy build does.
    "above-far",
    "below-far",
  ],
};
