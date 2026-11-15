/* Uniform-area ring sampling, matching the model in nyquist_fig.py. */
(() => {
  "use strict";

  const roots = [...document.querySelectorAll("[data-circle-plot]")];
  if (!roots.length) return;

  const defaults = { count: 30, width: Math.sqrt(1.2) - 1, seed: 42, reveal: false };
  const state = { ...defaults };
  const center = 210;
  const scale = 130;

  // A repeatable sample makes adding points and resetting easy to compare.
  function sample(seed) {
    let value = seed >>> 0;
    function random() {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(value ^ (value >>> 15), value | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    }
    return Array.from({ length: 1000 }, () => ({ area: random(), angle: random() * 2 * Math.PI }));
  }

  let points = sample(state.seed);

  const views = roots.map((root, index) => {
    const host = root.querySelector(".plot-interactive");
    const prefix = `circle-${index + 1}`;
    host.innerHTML = `
      <div class="circle-layout">
        <div class="research-image circle-frame">
          <span class="figure-label" aria-hidden="true">POINTS BECOME A CIRCLE</span>
          <svg class="circle-chart" viewBox="0 0 420 420" role="img" aria-labelledby="${prefix}-title ${prefix}-description">
            <title id="${prefix}-title">Randomly sampling points on a circle</title>
            <desc id="${prefix}-description"></desc>
            <path class="circle-band" fill-rule="evenodd"></path>
            <g class="circle-points"></g>
            <text class="circle-count" x="210" y="414" text-anchor="middle"></text>
          </svg>
          <span class="image-corner top-left" aria-hidden="true"></span>
          <span class="image-corner bottom-right" aria-hidden="true"></span>
          <span class="figure-index" aria-hidden="true"></span>
        </div>
        <div class="circle-controls plot-controls">
          <div class="circle-control plot-control">
            <label for="${prefix}-count">Points <output for="${prefix}-count" data-circle-count></output></label>
            <input id="${prefix}-count" type="range" min="1" max="1000" step="1" value="30" data-circle-count-input>
            <div class="circle-presets" aria-label="Point count presets">
              <button type="button" data-circle-preset="10">10</button>
              <button type="button" data-circle-preset="30">30</button>
              <button type="button" data-circle-preset="90">90</button>
              <button type="button" data-circle-preset="1000">1,000</button>
            </div>
          </div>
          <div class="circle-control plot-control">
            <label for="${prefix}-width">Ring width <output for="${prefix}-width" data-circle-width></output></label>
            <input id="${prefix}-width" type="range" min="0" max="40" step="0.01" value="9.54" aria-describedby="${prefix}-width-help" data-circle-width-input>
            <p id="${prefix}-width-help" class="circle-help">Width as a percentage of the inner radius.</p>
          </div>
          <label class="circle-reveal" for="${prefix}-reveal"><input id="${prefix}-reveal" type="checkbox" data-circle-reveal> Show underlying ring</label>
          <div class="circle-actions plot-actions">
            <button type="button" data-circle-resample>New sample</button>
            <button type="button" data-circle-reset>Reset</button>
          </div>
          <p class="circle-help">Add points to the same sample, or draw a new one. Both circle plots stay in sync. The scale stays fixed.</p>
          <p class="circle-status" aria-live="polite" aria-atomic="true"></p>
        </div>
      </div>`;
    host.querySelector(".figure-index").textContent = root.dataset.figureIndex;

    const view = {
      root, host,
      count: host.querySelector("[data-circle-count-input]"),
      countOutput: host.querySelector("[data-circle-count]"),
      width: host.querySelector("[data-circle-width-input]"),
      widthOutput: host.querySelector("[data-circle-width]"),
      reveal: host.querySelector("[data-circle-reveal]"),
      band: host.querySelector(".circle-band"),
      points: host.querySelector(".circle-points"),
      description: host.querySelector("desc"),
      chartCount: host.querySelector(".circle-count"),
      status: host.querySelector(".circle-status"),
      presets: [...host.querySelectorAll("[data-circle-preset]")]
    };
    view.count.addEventListener("input", () => {
      state.count = Number(view.count.value);
      render();
    });
    view.width.addEventListener("input", () => {
      state.width = Number(view.width.value) / 100;
      render();
    });
    view.reveal.addEventListener("change", () => {
      state.reveal = view.reveal.checked;
      render();
    });
    view.presets.forEach(button => button.addEventListener("click", () => {
      state.count = Number(button.dataset.circlePreset);
      render();
    }));
    host.querySelector("[data-circle-resample]").addEventListener("click", () => {
      state.seed = (state.seed + 1) >>> 0;
      points = sample(state.seed);
      render();
      view.status.textContent = `New sample drawn with ${state.count.toLocaleString()} points.`;
    });
    host.querySelector("[data-circle-reset]").addEventListener("click", () => {
      Object.assign(state, defaults);
      points = sample(state.seed);
      render();
      view.status.textContent = "Original interactive sample restored: 30 points, 9.54% ring width.";
    });
    return view;
  });

  function circlePath(radius) {
    return `M ${center - radius} ${center} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0 Z`;
  }

  function render() {
    const outer = 1 + state.width;
    const widthLabel = `${(state.width * 100).toFixed(2)}%`;
    const countLabel = state.count.toLocaleString();
    // In the original, r² = 1 + 0.2u. Generalize to r² = 1 + (R² − 1)u.
    const markup = points.slice(0, state.count).map(point => {
      const radius = Math.sqrt(1 + (outer * outer - 1) * point.area);
      const x = center + scale * radius * Math.cos(point.angle);
      const y = center - scale * radius * Math.sin(point.angle);
      return `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="2.5"/>`;
    }).join("");

    for (const view of views) {
      view.count.value = String(state.count);
      view.countOutput.value = countLabel;
      view.width.value = String(state.width * 100);
      view.widthOutput.value = widthLabel;
      view.reveal.checked = state.reveal;
      view.points.innerHTML = markup;
      view.band.setAttribute("d", circlePath(outer * scale) + " " + circlePath(scale));
      view.band.setAttribute("visibility", state.reveal ? "visible" : "hidden");
      view.chartCount.textContent = `${countLabel} ${state.count === 1 ? "point" : "points"}`;
      view.description.textContent = `${countLabel} points sampled uniformly ${state.width === 0 ? "on a circle" : "over the area of a ring"}. Inner radius 1, outer radius ${outer.toFixed(4)}, in arbitrary units. Ring width ${widthLabel} of the inner radius. The underlying ring is ${state.reveal ? "shown" : "hidden"}.`;
      view.presets.forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.circlePreset) === state.count)));
      view.status.textContent = "";
    }
  }

  render();
  for (const view of views) {
    view.host.hidden = false;
    view.root.querySelector(".plot-fallback").hidden = true;
  }
})();
