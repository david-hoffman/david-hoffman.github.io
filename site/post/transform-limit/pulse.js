/* Gaussian field envelopes: the plots show their squared magnitudes. */
(() => {
  "use strict";
  const figure = document.querySelector("[data-transform]");
  if (!figure) return;

  const timeBandwidth = 2 * Math.log(2) / Math.PI;
  const lightSpeed = 2.99792458e-5; // cm / fs, exact SI speed of light
  const product = timeBandwidth / lightSpeed; // fs cm⁻¹
  const referenceDuration = 100;
  const referenceBandwidth = product / referenceDuration;
  const minDuration = 30;
  const maxDuration = 300;
  const duration = figure.querySelector("[data-duration]");
  const bandwidth = figure.querySelector("[data-bandwidth]");
  const host = figure.querySelector(".plot-interactive");
  const charts = [...figure.querySelectorAll(".pulse-chart")];
  let pulseDuration = referenceDuration;

  // Keeping both axes fixed makes the inverse change in width visible.
  const domains = [
    { limit: 300, ticks: [-300, -150, 0, 150, 300], unit: "fs", title: "Pulse in time", axis: "Time (fs)", reference: referenceDuration },
    { limit: 500, ticks: [-500, -250, 0, 250, 500], unit: "cm⁻¹", title: "Pulse spectrum", axis: "Wavenumber offset (cm⁻¹)", reference: referenceBandwidth }
  ];
  const intensity = (offset, fwhm) => Math.exp(-4 * Math.log(2) * (offset / fwhm) ** 2);
  const line = (x1, y1, x2, y2, className) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}"/>`;
  const label = (x, y, text, anchor = "middle", className = "") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${className}">${text}</text>`;

  function draw(svg, domain, fwhm) {
    const width = Math.max(240, svg.getBoundingClientRect().width || 320);
    const height = 270;
    const left = 34;
    const right = width - 18;
    const top = 64;
    const bottom = 211;
    const x = value => left + (value + domain.limit) / (2 * domain.limit) * (right - left);
    const y = value => bottom - value * (bottom - top);
    const curve = value => Array.from({ length: 401 }, (_, index) => {
      const offset = -domain.limit + index / 400 * 2 * domain.limit;
      return `${index ? "L" : "M"}${x(offset).toFixed(2)} ${y(intensity(offset, value)).toFixed(2)}`;
    }).join(" ");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.querySelector("desc").textContent = `${domain.title}: a peak-normalized Gaussian intensity with full width at half maximum ${fwhm.toFixed(1)} ${domain.unit}. The dashed reference has width ${domain.reference.toFixed(1)} ${domain.unit}. The fixed horizontal axis runs from minus ${domain.limit} to plus ${domain.limit} ${domain.unit}.`;
    let markup = label(left, 19, domain.title, "start", "pulse-title");
    markup += label(left, 39, "Normalized intensity", "start");
    for (const level of [0, .5, 1]) {
      markup += line(left, y(level), right, y(level), level === .5 ? "pulse-half" : "pulse-grid");
      markup += label(left - 8, y(level) + 3, level.toFixed(1), "end");
    }
    for (const tick of domain.ticks) {
      markup += line(x(tick), bottom, x(tick), bottom + 5, "pulse-grid");
      markup += label(x(tick), bottom + 19, String(tick).replace("-", "−"));
    }
    markup += label((left + right) / 2, height - 12, domain.axis);
    const path = curve(fwhm);
    markup += `<path d="${path} L${right} ${bottom} L${left} ${bottom} Z" class="pulse-fill"/>`;
    markup += `<path d="${curve(domain.reference)}" class="pulse-reference"/>`;
    markup += `<path d="${path}" class="pulse-curve"/>`;
    const start = x(-fwhm / 2);
    const end = x(fwhm / 2);
    const half = y(.5);
    markup += line(start, half, end, half, "pulse-width");
    markup += line(start, half - 5, start, half + 5, "pulse-width");
    markup += line(end, half - 5, end, half + 5, "pulse-width");
    markup += label((start + end) / 2, half + 23, `${fwhm.toFixed(1)} ${domain.unit}`, "middle", "pulse-width-label");
    svg.querySelector("[data-drawing]").innerHTML = markup;
  }

  function render() {
    const spectralWidth = product / pulseDuration;
    duration.value = String(pulseDuration);
    bandwidth.value = String(spectralWidth);
    figure.querySelector("[data-duration-value]").value = `${pulseDuration.toFixed(1)} fs`;
    figure.querySelector("[data-bandwidth-value]").value = `${spectralWidth.toFixed(1)} cm⁻¹`;
    duration.setAttribute("aria-valuetext", `${pulseDuration.toFixed(1)} femtoseconds`);
    bandwidth.setAttribute("aria-valuetext", `${spectralWidth.toFixed(1)} inverse centimeters`);
    figure.querySelector("[data-pulse-summary]").textContent = `${pulseDuration.toFixed(1)} fs × ${spectralWidth.toFixed(1)} cm⁻¹`;
    charts.forEach((svg, index) => draw(svg, domains[index], index === 0 ? pulseDuration : spectralWidth));
  }

  function updateDuration(value) {
    pulseDuration = Math.max(minDuration, Math.min(maxDuration, value));
    render();
  }

  bandwidth.min = String(product / maxDuration);
  bandwidth.max = String(product / minDuration);
  duration.addEventListener("input", () => updateDuration(Number(duration.value)));
  bandwidth.addEventListener("input", () => updateDuration(product / Number(bandwidth.value)));
  figure.querySelector("[data-reset]").addEventListener("click", () => updateDuration(referenceDuration));
  for (const button of figure.querySelectorAll("[data-preset]")) {
    button.addEventListener("click", () => updateDuration(Number(button.dataset.preset)));
  }

  // Show controls only after a successful first render. The static diagram
  // remains the no-script and print version, with its own numerical summary.
  render();
  host.hidden = false;
  figure.querySelector(".plot-fallback").hidden = true;
  render();
  if ("ResizeObserver" in window) new ResizeObserver(render).observe(host);
})();
