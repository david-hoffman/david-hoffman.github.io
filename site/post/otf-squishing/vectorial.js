/* Progressive plots of the article's on-axis vectorial diffraction integral. */
(() => {
  "use strict";
  if (!globalThis.OTFModel || !globalThis.Worker) return;

  const configurations = {
    oil: { title: "Excitation, emission and confocal focus", label: "COMPARING AXIAL PROFILES", depth: "nominal", note: "The confocal profile is the product of excitation and emission intensities. Intensities retain the arbitrary scale of the Python calculation. Defaults follow that call: objective index 1.518, sample index 1.470 and NA 1.330." },
    glycerol: { title: "Confocal profiles through glycerol", label: "FOCUS THROUGH GLYCEROL", depth: "depthScale", note: "All profiles share the zero-depth peak intensity as their reference. Select a nominal focal position to inspect its peak." },
    water: { title: "Confocal profiles · water example", label: "FOCUS THROUGH WATER", depth: "depthScale", note: "Defaults follow the Python call: objective index 1.330 and sample index 1.473. All profiles share the zero-depth peak intensity as their reference." },
    ice: { title: "Air-to-ice axial profiles", label: "FOCUS THROUGH ICE", depth: "depthScale", note: "Single-wavelength profiles, scaled to the zero-depth peak. Negative and positive nominal positions show opposite aberration and focal shifts." },
    comparison: { title: "Vectorial and geometrical focus", label: "TWO FOCUS MODELS", depth: "maxDepth", note: "The vectorial result locates the intensity maximum. The geometrical result uses the article’s axial-bandwidth ratio." },
    difference: { title: "Where the focus models differ", label: "THE MODELS’ DIFFERENCE", depth: "maxDepth", note: "Difference = vectorial − geometrical. Percent difference divides by the vectorial focal position; it is undefined at zero and is omitted there." }
  };
  const colors = ["#ab492b", "#31685d", "#77628b", "#8d701d", "#356b87", "#8c595d", "#646b30", "#67543e"];
  const dashes = ["", "6 4", "2 4", "8 3 2 3", "10 3", "3 3", "9 3 3 3", "1 3"];
  const groups = new Map();
  const widgets = [];
  let initialAnchor = null;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const number = (value, digits = 2) => Math.abs(value) < .5 * 10 ** -digits ? (0).toFixed(digits) : value.toFixed(digits);
  const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const isComparison = widget => widget.group.kind === "comparison";

  function slider(widget, key, label, min, max, step, unit = "", digits = 2, scale = 1) {
    const id = `${widget.figure.id}-${key}`;
    return `<div class="plot-control"><label for="${id}">${label}<output for="${id}"></output></label><input id="${id}" type="range" data-parameter="${key}" data-unit="${unit}" data-digits="${digits}" data-scale="${scale}" min="${min}" max="${max}" step="${step}"></div>`;
  }

  function controlMarkup(widget) {
    const config = configurations[widget.kind];
    const depth = config.depth === "nominal"
      ? slider(widget, "nominal", "Nominal focal position", -50, 50, 1, " µm", 0)
      : config.depth === "maxDepth"
        ? slider(widget, "maxDepth", "Maximum nominal position", 1, 20, .5, " µm", 1)
        : slider(widget, "depthScale", "Nominal position scale", .1, widget.kind === "ice" ? 2 : 1, .05, "×", 2);
    const secondary = slider(widget, "n1", "Objective refractive index", 1, 1.8, .001, "", 3)
      + slider(widget, "excitation", widget.group.params.emission ? "Excitation wavelength" : "Wavelength", 350, 900, 1, " nm", 0, 1000)
      + (widget.group.params.emission ? slider(widget, "emission", "Emission wavelength", 350, 900, 1, " nm", 0, 1000) : "");
    const legend = isComparison(widget)
      ? `<ul class="plot-legend vectorial-static-legend"><li><span class="vectorial-key" style="--curve:${colors[0]}"></span>Vectorial${widget.kind === "difference" ? " − geometrical" : ""}</li>${widget.kind === "comparison" ? `<li><span class="vectorial-key is-dashed" style="--curve:${colors[1]}"></span>Geometrical</li>` : ""}</ul>`
      : `<p class="plot-kicker">${widget.kind === "oil" ? "Inspect a profile" : "Inspect a nominal focal position"}</p><div class="vectorial-legend" role="group" aria-label="Choose a profile to inspect" data-legend></div>`;
    const linked = isComparison(widget)
      ? ` Settings and probe are shared with <a class="vectorial-shared-link" href="#vectorial-${widget.kind === "comparison" ? "difference" : "comparison"}">${widget.kind === "comparison" ? "the difference plot" : "the focus comparison"}</a>.`
      : "";
    return `<div class="research-image"><span class="figure-label" aria-hidden="true">${config.label}</span><h3 class="vectorial-title">${config.title}</h3><svg class="vectorial-chart" role="img" aria-labelledby="${widget.figure.id}-title ${widget.figure.id}-description"><title id="${widget.figure.id}-title">${config.title}</title><desc id="${widget.figure.id}-description"></desc><g data-drawing></g></svg><span class="image-corner top-left" aria-hidden="true"></span><span class="image-corner bottom-right" aria-hidden="true"></span><span class="figure-index" aria-hidden="true">LIVE / VECTORIAL</span></div>
      <div class="plot-controls vectorial-controls">${legend}<div class="vectorial-parameters">${slider(widget, "n2", "Sample refractive index", 1, 1.8, .001, "", 3)}${slider(widget, "na", "Numerical aperture (NA)", .1, 1.8, .001, "", 3)}${depth}</div><details class="vectorial-settings"><summary>Objective and wavelength settings</summary><div class="vectorial-parameters">${secondary}</div></details><div class="plot-readout" data-readout></div><div class="plot-control vectorial-probe"><label for="${widget.figure.id}-probe">${isComparison(widget) ? "Probe nominal focal position" : "Probe axial deviation"}<output for="${widget.figure.id}-probe"></output></label><input type="range" id="${widget.figure.id}-probe" data-probe min="0" max="100" step="1" value="50"></div><div class="plot-actions"><button type="button" data-reset>Reset figure${isComparison(widget) ? "s" : ""}</button>${isComparison(widget) ? "" : '<button type="button" data-peak>Probe selected peak</button>'}</div><p class="plot-note">${config.note}${linked}</p><p class="plot-note">On-axis light only. NA is limited to the lower refractive index, so every modeled ray propagates.</p><p class="plot-note vectorial-status" role="status" aria-live="polite" data-status></p></div>`;
  }

  function synchronizeControls(group) {
    for (const widget of group.widgets) {
      for (const input of widget.host.querySelectorAll("[data-parameter]")) {
        const key = input.dataset.parameter;
        const scale = Number(input.dataset.scale);
        if (key === "na") input.max = Math.min(group.params.n1, group.params.n2).toFixed(3);
        input.value = group.params[key] * scale;
        const formatted = number(group.params[key] * scale, Number(input.dataset.digits)) + input.dataset.unit;
        widget.host.querySelector(`output[for="${input.id}"]`).value = formatted;
        input.setAttribute("aria-valuetext", formatted);
      }
    }
  }

  function status(group, message, busy) {
    for (const widget of group.widgets) {
      widget.host.setAttribute("aria-busy", String(busy));
      widget.host.querySelector("[data-status]").textContent = message;
    }
  }

  function fail(group) {
    finishAnchoredGroup(group);
    group.worker?.terminate();
    group.worker = null;
    for (const widget of group.widgets) {
      widget.host.hidden = true;
      widget.figure.querySelector(".plot-fallback").hidden = false;
    }
  }

  function schedule(group, delay = 180) {
    clearTimeout(group.timer);
    // Ending the old worker also cancels integration that is already running.
    group.worker?.terminate();
    group.worker = null;
    const token = ++group.token;
    status(group, "Updating focal profiles…", true);
    group.timer = setTimeout(() => {
      try {
        const worker = new Worker(new URL("vectorial-worker.js", document.baseURI));
        group.worker = worker;
        worker.onmessage = ({ data }) => {
          if (data.token !== group.token) return;
          worker.terminate();
          group.worker = null;
          if (data.error) { fail(group); return; }
          group.result = data.result;
          group.probeIndex = clamp(group.probeIndex, 0, data.result.series[0].x.length - 1);
          try {
            for (const widget of group.widgets) {
              widget.host.hidden = false;
              render(widget, true);
              widget.figure.querySelector(".plot-fallback").hidden = true;
            }
            status(group, "", false);
            finishAnchoredGroup(group);
          } catch (error) {
            console.error("Vectorial figure could not be drawn", error);
            fail(group);
          }
        };
        worker.onerror = () => { if (token === group.token) fail(group); };
        worker.postMessage({ token, kind: group.kind, params: group.params });
      } catch (error) {
        fail(group);
      }
    }, delay);
  }

  function seriesPeak(series) {
    let index = 0;
    for (let i = 1; i < series.y.length; i++) if (series.y[i] > series.y[index]) index = i;
    return { deviation: series.x[index], intensity: series.y[index] };
  }

  function selectedPeak(widget) {
    const series = widget.group.result.series[widget.selected];
    const peaks = widget.group.result.peaks || [];
    const peak = peaks.find(item => item.id === series.id) || peaks[widget.selected];
    return peak && Number.isFinite(peak.intensity)
      ? { deviation: peak.deviation ?? peak.actual - peak.nominal, intensity: peak.intensity }
      : seriesPeak(series);
  }

  function referenceIntensity(widget) {
    if (widget.kind === "oil" || isComparison(widget)) return 1;
    const result = widget.group.result;
    const zero = (result.peaks || []).find(peak => Math.abs(peak.nominal) < 1e-10);
    if (zero?.intensity > 0) return zero.intensity;
    return Math.max(...result.series.flatMap(series => series.y));
  }

  function dataAt(series, x) {
    if (x < series.x[0]) return null;
    if (x === series.x[0]) return series.y[0];
    const last = series.x.length - 1;
    if (x > series.x[last]) return null;
    if (x === series.x[last]) return series.y[last];
    let right = 1;
    while (right < last && series.x[right] < x) right++;
    const left = right - 1;
    const a = series.y[left], b = series.y[right];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a + (b - a) * (x - series.x[left]) / (series.x[right] - series.x[left]);
  }

  function metric(label, value, unit = "") {
    return `<div><p class="plot-kicker">${label}</p><span class="plot-value">${value}<span class="vectorial-unit">${unit}</span></span></div>`;
  }

  function updateReadout(widget) {
    const result = widget.group.result;
    const probe = widget.host.querySelector("[data-probe]");
    let markup;
    if (isComparison(widget)) {
      const vectorial = result.series.find(series => series.id === "vectorial") || result.series[0];
      const geometrical = result.series.find(series => series.id === "geometrical") || result.series[1];
      probe.min = 0; probe.max = vectorial.x.length - 1; probe.step = 1; probe.value = widget.group.probeIndex;
      widget.probeX = vectorial.x[widget.group.probeIndex];
      const actual = vectorial.y[widget.group.probeIndex];
      const geometric = geometrical.y[widget.group.probeIndex];
      const delta = actual - geometric;
      const percentDefined = Number.isFinite(actual) && Number.isFinite(delta) && Math.abs(actual) > 1e-12;
      markup = widget.kind === "comparison"
        ? metric("Vectorial focus", number(actual, 3), "µm") + metric("Geometrical focus", number(geometric, 3), "µm") + metric("Difference", number(delta, 3), "µm")
        : metric("Difference", number(delta, 3), "µm") + metric("Percent of vectorial focus", percentDefined ? number(100 * delta / actual, 2) : "Undefined", percentDefined ? "%" : "");
    } else {
      const series = result.series[widget.selected];
      const reference = referenceIntensity(widget);
      const min = result.xDomain?.[0] ?? Math.min(...result.series.map(item => item.x[0]));
      const max = result.xDomain?.[1] ?? Math.max(...result.series.map(item => item.x[item.x.length - 1]));
      const peak = selectedPeak(widget);
      probe.min = min; probe.max = max; probe.step = (max - min) / 1000;
      widget.probeX = clamp(widget.probeX ?? peak.deviation, min, max);
      probe.value = widget.probeX;
      const sampled = dataAt(series, widget.probeX);
      const intensity = sampled === null ? null : sampled / reference;
      const isOil = widget.kind === "oil";
      markup = metric("Peak deviation", number(peak.deviation, 3), "µm")
        + metric("Peak intensity", number(isOil ? peak.intensity : 100 * peak.intensity / reference, isOil ? 3 : 1), isOil ? "a.u." : "%")
        + metric("Intensity at probe", intensity === null ? "—" : number(isOil ? intensity : 100 * intensity, isOil ? 3 : 1), intensity === null ? "outside sampled curve" : isOil ? "a.u." : "%");
    }
    const formatted = `${number(widget.probeX, 3)} µm`;
    probe.setAttribute("aria-valuetext", formatted);
    widget.host.querySelector(`output[for="${probe.id}"]`).value = formatted;
    widget.host.querySelector("[data-readout]").innerHTML = markup;
  }

  function legend(widget) {
    if (isComparison(widget)) return;
    widget.host.querySelector("[data-legend]").innerHTML = widget.group.result.series.map((series, index) => `<button type="button" data-series="${index}" aria-pressed="${index === widget.selected}"><span class="vectorial-key${index % 2 ? " is-dashed" : ""}" style="--curve:${colors[index % colors.length]}"></span>${escape(series.label)}</button>`).join("");
  }

  function axisTicks(min, max, count = 5) {
    const roughStep = (max - min) / (count - 1);
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const fraction = roughStep / magnitude;
    const factor = fraction >= Math.sqrt(50) ? 10 : fraction >= Math.sqrt(10) ? 5 : fraction >= Math.sqrt(2) ? 2 : 1;
    const step = factor * magnitude;
    const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-10));
    const scientific = step < .001 || Math.max(Math.abs(min), Math.abs(max)) >= 100000;
    const significantDigits = Math.max(0, Math.ceil(Math.log10(Math.max(Math.abs(min), Math.abs(max)) / step)));
    const first = Math.ceil(min / step - 1e-10);
    const last = Math.floor(max / step + 1e-10);
    const ticks = [];
    for (let index = first; index <= last; index++) {
      const value = index * step;
      const label = scientific && index !== 0
        ? value.toExponential(significantDigits).replace(/\.?0+(?=e)/, "").replace("e+", "e")
        : number(value, scientific ? 0 : digits);
      ticks.push({ value, label });
    }
    return ticks;
  }

  function chartPanel(widget, series, frame, labels, options = {}) {
    const { x: left, y: top, width, height } = frame;
    const allX = series.flatMap(item => item.x).filter(Number.isFinite);
    const allY = series.flatMap(item => item.y).filter(Number.isFinite);
    const xmin = options.xmin ?? Math.min(...allX), xmax = options.xmax ?? Math.max(...allX);
    let ymin = Math.min(0, ...allY), ymax = Math.max(0, ...allY);
    if (ymax - ymin < 1e-9) { ymin -= .001; ymax += .001; }
    const padding = (ymax - ymin) * .08;
    ymax += padding;
    if (ymin < 0) ymin -= padding;
    const px = value => left + (value - xmin) / (xmax - xmin) * width;
    const py = value => top + height - (value - ymin) / (ymax - ymin) * height;
    const line = (x1, y1, x2, y2, css) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${css}"/>`;
    const text = (x, y, value, anchor = "middle", css = "") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${css}">${escape(value)}</text>`;
    let markup = text(left, top - 15, labels.y, "start", "vectorial-axis-label");
    for (const tick of axisTicks(xmin, xmax)) {
      markup += line(px(tick.value), top, px(tick.value), top + height, "vectorial-grid");
      if (labels.x) markup += text(px(tick.value), top + height + 20, tick.label);
    }
    for (const tick of axisTicks(ymin, ymax)) {
      markup += line(left, py(tick.value), left + width, py(tick.value), "vectorial-grid");
      markup += text(left - 9, py(tick.value) + 4, tick.label, "end");
    }
    if (ymin < 0 && ymax > 0) markup += line(left, py(0), left + width, py(0), "vectorial-zero");
    if (xmin < 0 && xmax > 0) markup += line(px(0), top, px(0), top + height, "vectorial-zero");
    const clipId = `${widget.figure.id}-${options.panel || "main"}-clip`;
    markup += `<defs><clipPath id="${clipId}"><rect x="${left}" y="${top - 4}" width="${width}" height="${height + 8}"/></clipPath></defs><g clip-path="url(#${clipId})">`;
    for (let index = 0; index < series.length; index++) {
      const item = series[index];
      const color = colors[index % colors.length];
      const selected = !isComparison(widget) && index === widget.selected;
      let path = "", previous = false;
      for (let i = 0; i < item.x.length; i++) {
        if (!Number.isFinite(item.y[i])) { previous = false; continue; }
        const x = px(item.x[i]), y = py(item.y[i]);
        path += `${previous ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
        previous = true;
        if (options.scatter || (widget.kind === "comparison" && index === 0)) markup += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}" class="vectorial-point"/>`;
      }
      if (!options.scatter && !(widget.kind === "comparison" && index === 0)) markup += `<path d="${path}" class="vectorial-curve${selected ? " is-selected" : !isComparison(widget) ? " is-muted" : ""}" stroke="${color}" stroke-dasharray="${dashes[index % dashes.length]}"/>`;
    }
    const probe = clamp(widget.probeX, xmin, xmax);
    markup += line(px(probe), top, px(probe), top + height, "vectorial-probe-line");
    series.forEach((item, index) => {
      if (!isComparison(widget) && index !== widget.selected) return;
      const value = dataAt(item, probe);
      if (Number.isFinite(value) && !(widget.kind === "difference" && options.panel === "percent" && probe === 0)) markup += `<circle cx="${px(probe)}" cy="${py(value)}" r="4.5" fill="${colors[index % colors.length]}" class="vectorial-probe-point"/>`;
    });
    markup += "</g>";
    if (labels.x) markup += text(left + width / 2, top + height + 44, labels.x, "middle", "vectorial-axis-label");
    return markup;
  }

  function render(widget, refreshLegend = false) {
    if (!widget.group.result) return;
    const result = widget.group.result;
    if (refreshLegend) legend(widget);
    updateReadout(widget);
    const svg = widget.host.querySelector("svg");
    const width = Math.max(240, svg.getBoundingClientRect().width || 640);
    const left = width < 400 ? 47 : 58;
    const right = 15;
    let markup, height;
    if (widget.kind === "difference") {
      height = 472;
      const vectorial = result.series[0];
      const geometric = result.series[1];
      const absolute = result.differences?.absolute || { x: vectorial.x, y: vectorial.y.map((value, i) => value - geometric.y[i]) };
      const percent = result.differences?.percent || { x: vectorial.x, y: vectorial.y.map((value, i) => vectorial.x[i] === 0 ? null : 100 * (value - geometric.y[i]) / value) };
      markup = chartPanel(widget, [absolute], { x: left, y: 28, width: width - left - right, height: 154 }, { y: "Difference (µm)" }, { scatter: true, panel: "absolute", xmin: 0, xmax: widget.group.params.maxDepth });
      markup += chartPanel(widget, [percent], { x: left, y: 253, width: width - left - right, height: 154 }, { x: "Nominal position (µm)", y: "Difference (%)" }, { scatter: true, panel: "percent", xmin: 0, xmax: widget.group.params.maxDepth });
    } else {
      height = width < 400 ? 288 : 326;
      const scale = referenceIntensity(widget);
      const series = result.series.map(item => ({ ...item, y: item.y.map(value => value / scale) }));
      markup = chartPanel(widget, series, { x: left, y: 28, width: width - left - right, height: height - 90 }, { x: isComparison(widget) ? "Nominal position (µm)" : "Axial deviation (µm)", y: isComparison(widget) ? "Actual focal position (µm)" : widget.kind === "oil" ? "Intensity (a.u.)" : "Relative intensity" }, { xmin: result.xDomain?.[0], xmax: result.xDomain?.[1] });
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.querySelector("[data-drawing]").innerHTML = markup;
    const readout = widget.host.querySelector("[data-readout]").textContent;
    svg.querySelector("desc").textContent = `${configurations[widget.kind].title}. Objective refractive index ${widget.group.params.n1}; sample refractive index ${widget.group.params.n2}; numerical aperture ${widget.group.params.na}. Probe ${number(widget.probeX, 3)} micrometers. ${readout}. Use the labeled controls following the chart to explore the calculation.`;
  }

  function mount(figure) {
    const kind = figure.dataset.vectorial;
    const groupKind = kind === "difference" ? "comparison" : kind;
    if (!groups.has(groupKind)) groups.set(groupKind, { kind: groupKind, params: OTFModel.defaults(groupKind), widgets: [], token: 0, probeIndex: 25, started: false });
    const group = groups.get(groupKind);
    const widget = { figure, kind, group, host: figure.querySelector(".plot-interactive"), selected: kind === "oil" ? 2 : 0, probeX: null };
    group.widgets.push(widget);
    widgets.push(widget);
    widget.host.innerHTML = controlMarkup(widget);
    widget.host.addEventListener("input", event => {
      const input = event.target;
      if (input.matches("[data-parameter]")) {
        group.params[input.dataset.parameter] = Number(input.value) / Number(input.dataset.scale);
        group.params.na = Math.min(group.params.na, Math.min(group.params.n1, group.params.n2));
        synchronizeControls(group);
        schedule(group);
      } else if (input.matches("[data-probe]")) {
        if (isComparison(widget)) {
          group.probeIndex = Number(input.value);
          group.widgets.forEach(item => render(item));
        } else {
          widget.probeX = Number(input.value);
          render(widget);
        }
      }
    });
    widget.host.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-reset")) {
        group.params = OTFModel.defaults(group.kind);
        group.probeIndex = 25;
        for (const item of group.widgets) { item.selected = item.kind === "oil" ? 2 : 0; item.probeX = null; }
        synchronizeControls(group);
        schedule(group, 0);
      } else if (button.hasAttribute("data-series")) {
        widget.selected = Number(button.dataset.series);
        widget.probeX = selectedPeak(widget).deviation;
        legend(widget);
        // Replacing the legend should not discard the keyboard user's focus.
        widget.host.querySelector(`[data-series="${widget.selected}"]`).focus({ preventScroll: true });
        render(widget);
      } else if (button.hasAttribute("data-peak")) {
        widget.probeX = selectedPeak(widget).deviation;
        render(widget);
      }
    });
    new ResizeObserver(() => render(widget)).observe(widget.host.querySelector("svg"));
  }

  // A deep link can be displaced while equations and preceding plots acquire
  // their final height. Correct that initial anchor once, unless the user moves.
  function finishAnchoredGroup(group) {
    initialAnchor?.pending.delete(group);
    settleInitialAnchor();
  }

  function settleInitialAnchor() {
    const anchor = initialAnchor;
    if (!anchor || !anchor.mathReady || !anchor.pageReady || anchor.pending.size) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (initialAnchor !== anchor) return;
      anchor.widget.figure.scrollIntoView({ block: "start", behavior: "instant" });
      anchor.cancel();
    }));
  }

  function preserveInitialAnchor() {
    const index = widgets.findIndex(widget => `#${widget.figure.id}` === location.hash);
    const geometric = ["otf-support-model", "refraction-model"].includes(location.hash.slice(1))
      ? document.getElementById(location.hash.slice(1)) : null;
    if (index < 0 && !geometric) return;
    const target = index < 0 ? { figure: geometric } : widgets[index];
    const pending = new Set(widgets.slice(0, index + 1).map(widget => widget.group));
    const events = ["wheel", "touchstart", "pointerdown", "keydown", "hashchange"];
    const cancel = () => {
      events.forEach(name => window.removeEventListener(name, cancel, true));
      initialAnchor = null;
    };
    initialAnchor = { widget: target, pending, cancel, mathReady: false, pageReady: document.readyState === "complete" };
    events.forEach(name => window.addEventListener(name, cancel, { capture: true, passive: true }));
    window.addEventListener("load", () => {
      if (initialAnchor) { initialAnchor.pageReady = true; settleInitialAnchor(); }
    }, { once: true });
    const mathReady = () => {
      if (initialAnchor) { initialAnchor.mathReady = true; settleInitialAnchor(); }
    };
    Promise.resolve(globalThis.MathJax?.startup?.promise).then(mathReady, mathReady);
    pending.forEach(group => { group.started = true; schedule(group, 0); });
  }

  document.querySelectorAll("[data-vectorial]").forEach(mount);
  groups.forEach(synchronizeControls);
  preserveInitialAnchor();
  if ("IntersectionObserver" in globalThis) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const widget = widgets.find(item => item.figure === entry.target);
        observer.unobserve(entry.target);
        if (!widget.group.started) { widget.group.started = true; schedule(widget.group, 0); }
      }
    }, { rootMargin: "500px" });
    widgets.forEach(widget => observer.observe(widget.figure));
  } else {
    groups.forEach(group => schedule(group, 0));
  }
})();
