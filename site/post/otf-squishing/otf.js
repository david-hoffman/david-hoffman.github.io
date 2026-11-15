/* Geometric models only. The article's vectorial calculations remain original. */
(() => {
  "use strict";
  const radians = Math.PI / 180;
  const line = (x1, y1, x2, y2, name) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${name}"/>`;
  const text = (x, y, value, anchor = "middle", name = "") => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${name}">${value}</text>`;

  function dimension(x1, y1, x2, y2, name) {
    const horizontal = y1 === y2;
    return line(x1, y1, x2, y2, name)
      + line(x1 - (horizontal ? 0 : 4), y1 - (horizontal ? 4 : 0), x1 + (horizontal ? 0 : 4), y1 + (horizontal ? 4 : 0), name)
      + line(x2 - (horizontal ? 0 : 4), y2 - (horizontal ? 4 : 0), x2 + (horizontal ? 0 : 4), y2 + (horizontal ? 4 : 0), name);
  }

  function angleArc(cx, cy, angle, radius, side, name) {
    return `<path class="${name}" d="M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 ${side > 0 ? 1 : 0} ${cx + side * radius * Math.sin(angle)} ${cy - radius * Math.cos(angle)}"/>`;
  }

  function refraction(sample, objective, angle) {
    const sine = sample / objective * Math.sin(angle * radians);
    return sine > 1 + 1e-12 ? null : Math.asin(Math.min(1, sine)) / radians;
  }

  function axialBandwidth(index, aperture, wavelength) {
    // Rationalized form avoids subtracting nearly equal values at small NA.
    return aperture * aperture / (wavelength * (index + Math.sqrt(index * index - aperture * aperture)));
  }

  function supportHeight(frequency, index, aperture, wavelength) {
    const radius = index / wavelength;
    const pupil = aperture / wavelength;
    const q = Math.abs(frequency);
    if (q >= 2 * pupil || q === 0) return 0;
    // Autocorrelation of a spherical pupil cap. One end of the wave-vector
    // difference lies on the pupil rim, the other q away in its meridian.
    // Rationalizing sqrt(R² - (q - a)²) - sqrt(R² - a²) is stable near q = 0.
    return q * (2 * pupil - q) / (Math.sqrt(Math.max(0, radius * radius - (q - pupil) ** 2)) + Math.sqrt(Math.max(0, radius * radius - pupil * pupil)));
  }

  function drawRefraction(figure, svg, width) {
    const sample = Number(figure.querySelector("[data-sample]").value);
    const objective = Number(figure.querySelector("[data-objective]").value);
    const angle = Number(figure.querySelector("[data-angle]").value);
    const outgoing = refraction(sample, objective, angle);
    const critical = sample > objective ? Math.asin(objective / sample) / radians : null;
    const limit = objective > sample ? Math.asin(sample / objective) / radians : null;
    const cx = width / 2;
    const cy = 144;
    const length = Math.min(105, cx - 22);
    const startX = cx - length * Math.sin(angle * radians);
    const startY = cy - length * Math.cos(angle * radians);
    svg.setAttribute("viewBox", `0 0 ${width} 446`);
    let markup = `<defs><marker id="otf-ray-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 8 4 0 8Z" fill="context-stroke"/></marker></defs>`;
    markup += `<rect x="8" y="8" width="${width - 16}" height="136" class="otf-sample-medium"/><rect x="8" y="144" width="${width - 16}" height="136" class="otf-objective-medium"/>`;
    markup += line(8, cy, width - 8, cy, "otf-axis");
    markup += line(cx, 30, cx, 259, "otf-normal");
    markup += text(18, 27, `Sample · n = ${sample.toFixed(2)}`, "start", "otf-label");
    markup += text(18, 271, `Objective · n = ${objective.toFixed(2)}`, "start", "otf-label");
    markup += text(cx + 8, 48, "Normal", "start", "otf-label otf-halo");
    if (critical !== null || limit !== null) {
      const boundary = (critical ?? limit) * radians;
      const direction = critical !== null ? -1 : 1;
      markup += line(cx, cy, cx + length * Math.sin(boundary), cy + direction * length * Math.cos(boundary), "otf-critical");
      markup += critical !== null ? angleArc(cx, cy, boundary, 51, 1, "otf-critical otf-boundary-angle")
        : `<path class="otf-critical otf-boundary-angle" d="M ${cx} ${cy + 51} A 51 51 0 0 0 ${cx + 51 * Math.sin(boundary)} ${cy + 51 * Math.cos(boundary)}"/>`;
      markup += text(cx + length * Math.sin(boundary), cy + direction * length * Math.cos(boundary) + direction * 16, critical !== null ? "θc" : "θlim", "middle", "otf-label otf-halo");
    }
    markup += line(startX, startY, cx, cy, "otf-incident");
    markup += `<circle cx="${startX}" cy="${startY}" r="5" class="otf-source"/>`;
    if (angle > 0) {
      const radius = 30;
      markup += `<path class="otf-angle" d="M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx - radius * Math.sin(angle * radians)} ${cy - radius * Math.cos(angle * radians)}"/>`;
      markup += text(cx - Math.max(14, 43 * Math.sin(angle * radians / 2)), cy - 43 * Math.cos(angle * radians / 2), "θₛ", "end", "otf-ink-sample otf-halo");
    } else {
      markup += text(cx - 14, cy - 42, "θₛ = 0°", "end", "otf-ink-sample otf-halo");
    }
    if (outgoing === null) {
      markup += line(cx, cy, cx + length * Math.sin(angle * radians), startY, "otf-reflected");
      markup += text(cx, 208, "Total internal reflection");
    } else {
      const theta = outgoing * radians;
      markup += line(cx, cy, cx + length * Math.sin(theta), cy + length * Math.cos(theta), "otf-transmitted");
      if (outgoing > 0) {
        const radius = 30;
        markup += `<path class="otf-angle" d="M ${cx} ${cy + radius} A ${radius} ${radius} 0 0 0 ${cx + radius * Math.sin(theta)} ${cy + radius * Math.cos(theta)}"/>`;
        markup += text(cx + Math.max(14, 43 * Math.sin(theta / 2)), cy + 43 * Math.cos(theta / 2) + 5, "θₒ", "start", "otf-ink-air otf-halo");
      } else {
        markup += text(cx + 14, cy + 47, "θₒ = 0°", "start", "otf-ink-air otf-halo");
      }
    }
    markup += `<rect x="8" y="296" width="${width - 16}" height="142" rx="2" class="otf-equation-panel"/>`;
    markup += text(20, 318, "Snell’s law", "start", "otf-label otf-panel-title");
    markup += text(20, 340, "nₛ sin θₛ = nₒ sin θₒ", "start", "otf-label otf-equation");
    markup += text(20, 362, `NA ≤ min(nₛ, nₒ) = ${Math.min(sample, objective).toFixed(2)}`, "start", "otf-label");
    markup += text(20, 394, critical !== null ? "Sample-side critical angle" : limit !== null ? "Objective-side angular limit" : "Matched indices", "start", "otf-label otf-panel-title");
    markup += text(20, 416, critical !== null
      ? `θc = sin⁻¹(nₒ/nₛ) = ${critical.toFixed(1)}°`
      : limit !== null ? `θlim = sin⁻¹(nₛ/nₒ) = ${limit.toFixed(1)}°` : "θₒ = θₛ; no bending", "start", "otf-label");
    figure.querySelector("[data-refracted]").value = outgoing === null ? "No ray" : `${outgoing.toFixed(1)}°`;
    figure.querySelector("[data-ceiling]").value = Math.min(sample, objective).toFixed(2);
    figure.querySelector("[data-refraction-status]").textContent = critical === null
      ? "Every incident angle has a propagating transmitted ray."
      : `The sample-side critical angle is ${critical.toFixed(1)}°. At larger angles there is no propagating transmitted ray.`;
    svg.querySelector("desc").textContent = `Light travels from sample index ${sample.toFixed(2)} toward objective index ${objective.toFixed(2)}. The sample-side angle is ${angle.toFixed(1)} degrees from the normal. ${outgoing === null ? "The ray is totally internally reflected." : `The transmitted angle is ${outgoing.toFixed(1)} degrees.`} Snell's law is n sample times sin theta sample equals n objective times sin theta objective. The interface limits propagating numerical aperture to the smaller index, ${Math.min(sample, objective).toFixed(2)}. ${critical !== null ? `The dotted boundary marks the sample-side critical angle, ${critical.toFixed(1)} degrees.` : limit !== null ? `The dotted boundary marks the maximum transmitted angle, ${limit.toFixed(1)} degrees, for a sample-side ray approaching 90 degrees.` : "Both indices match, so the ray keeps its direction."}`;
    return markup;
  }

  function drawSupport(figure, svg, width) {
    const index = Number(figure.querySelector("[data-index]").value);
    const aperture = Number(figure.querySelector("[data-na]").value);
    const wavelength = Number(figure.querySelector("[data-wavelength]").value) / 1000;
    const cutoff = 2 * aperture / wavelength;
    const airBandwidth = axialBandwidth(1, aperture, wavelength);
    const sampleBandwidth = axialBandwidth(index, aperture, wavelength);
    const centerDepth = n => Math.sqrt(Math.max(0, n * n - aperture * aperture)) / wavelength;
    // Fit the support and circle centers, with two dimension lanes on the right.
    // One common scale preserves angles; the height cap handles very small NA.
    const left = 40;
    const right = width - 80;
    const lowerExtent = Math.max(airBandwidth, centerDepth(index));
    const maxGeometryHeight = Math.max(130, Math.min(300, (right - left) * .65));
    const scale = Math.min((right - left - 16) / (2 * cutoff), maxGeometryHeight / (airBandwidth + lowerExtent));
    const top = 56;
    const centerX = (left + right) / 2;
    const centerY = top + 8 + airBandwidth * scale;
    const bottom = centerY + lowerExtent * scale + 32;
    const height = bottom + 48;
    const px = x => centerX + x * scale;
    const py = z => centerY - z * scale;
    const targetStep = (width < 400 ? 32 : 50) / scale;
    const magnitude = 10 ** Math.floor(Math.log10(targetStep));
    const step = [1, 2, 5, 10].find(value => value * magnitude >= targetStep) * magnitude;
    const tickLabel = value => Number(value.toFixed(Math.max(0, -Math.floor(Math.log10(step)))));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    let markup = text(left, 15, 'Axial k<tspan baseline-shift="sub" font-size="8">z</tspan> (cycles/µm)', "start", "otf-label");
    const xTicks = Math.floor((right - left) / (2 * scale * step));
    for (let i = -xTicks; i <= xTicks; i++) {
      const x = i * step;
      markup += line(px(x), top, px(x), bottom, "otf-grid");
      markup += text(px(x), bottom + 17, tickLabel(x));
    }
    let axialTicks = "";
    const firstZ = Math.ceil((centerY - bottom) / (scale * step));
    const lastZ = Math.floor((centerY - top) / (scale * step));
    for (let i = firstZ; i <= lastZ; i++) {
      const z = i * step;
      markup += line(left, py(z), right, py(z), "otf-grid");
      axialTicks += text(left - 7, py(z) + 4, tickLabel(z), "end", "otf-halo");
    }
    function supportPath(n) {
      let path = "";
      // Separate closed lobes retain the missing cone at the origin.
      for (const side of [-1, 1]) {
        for (const sign of [1, -1]) {
          for (let step = 0; step <= 160; step++) {
            const q = cutoff * (sign > 0 ? step / 160 : 1 - step / 160);
            const z = sign * supportHeight(q, n, aperture, wavelength);
            path += `${sign > 0 && step === 0 ? "M" : "L"}${px(side * q).toFixed(3)},${py(z).toFixed(3)} `;
          }
        }
        path += "Z ";
      }
      return path;
    }
    const air = supportPath(1);
    const sample = supportPath(index);
    markup += `<path d="${air}" class="otf-air-fill"/><path d="${sample}" class="otf-sample-fill"/>`;
    markup += line(left, centerY, right, centerY, "otf-axis");
    markup += line(centerX, top, centerX, bottom, "otf-axis");
    markup += `<path d="${air}" class="otf-air-edge"/><path d="${sample}" class="otf-sample-edge"/>`;
    markup += dimension(px(0), 39, px(cutoff), 39, "otf-dimension");
    markup += text(px(cutoff / 2), 31, "2 NA/λ", "middle", "otf-label otf-halo");
    const pupil = aperture / wavelength;
    // Each upper lobe is a circular arc centered at (a, -c), with
    // a = NA/lambda, c = n cos(theta)/lambda and radius n/lambda.
    // These are the same triangles shown in the article's original figure.
    // Put the two constructions on opposite lobes. Their angle labels stay
    // apart even when the indices match or the aperture is very small.
    for (const [n, suffix, side] of [[1, "air", -1], [index, "sample", 1]]) {
      const theta = Math.asin(aperture / n);
      const depth = centerDepth(n);
      const cx = px(side * pupil);
      const cy = py(-depth);
      const name = `otf-construction-${suffix}`;
      markup += line(cx, cy, px(0), py(0), name);
      markup += line(cx, cy, px(side * cutoff), py(0), name);
      markup += line(cx, cy, cx, py(axialBandwidth(n, aperture, wavelength)), name);
      markup += `<circle cx="${cx}" cy="${cy}" r="2.5" class="otf-center-${suffix}"/>`;
      const arcRadius = Math.min(24, .7 * n / wavelength * scale);
      markup += angleArc(cx, cy, theta, arcRadius, side, `otf-angle-${suffix}`);
      const labelX = cx + side * 20;
      const labelY = Math.min(py(-Math.max(airBandwidth, depth)) + 21, bottom - 14);
      markup += line(cx + side * arcRadius * Math.sin(theta / 2), cy - arcRadius * Math.cos(theta / 2), labelX - side * 6, labelY - 4, `otf-angle-${suffix} otf-angle-guide`);
      markup += text(labelX, labelY, suffix === "air" ? "θₐ" : "θₛ", side > 0 ? "start" : "end", `otf-ink-${suffix} otf-halo otf-angle-label`);
      const extentY = py(axialBandwidth(n, aperture, wavelength));
      const edgeX = px(cutoff);
      const measureX = right + (suffix === "air" ? 48 : 16);
      markup += `<g class="otf-axial-measure otf-axial-measure-${suffix}">`;
      markup += line(px(pupil), extentY, measureX, extentY, `otf-dimension-${suffix} otf-extent-guide`);
      markup += line(edgeX, centerY, measureX, centerY, `otf-dimension-${suffix} otf-extent-guide`);
      markup += dimension(measureX, centerY, measureX, extentY, `otf-dimension-${suffix}`);
      markup += text(measureX + 8, (centerY + extentY) / 2 + 4, suffix === "air" ? "Bₐ" : "Bₛ", "start", `otf-ink-${suffix} otf-halo`);
      markup += "</g>";
    }
    // Paint tick labels over the guide lines where they cross the axis gutter.
    markup += axialTicks;
    markup += text(centerX, bottom + 38, 'Lateral k<tspan baseline-shift="sub" font-size="8">x</tspan> (cycles/µm)', "middle", "otf-label");
    for (const [n, suffix] of [[1, "air"], [index, "sample"]]) {
      const card = figure.querySelector(`[data-support-${suffix}]`);
      card.querySelector("[data-support-index]").value = n.toFixed(2);
      card.querySelector("[data-support-angle]").value = `${(Math.asin(aperture / n) / radians).toFixed(1)}°`;
      card.querySelector("[data-support-radius]").value = (n / wavelength).toFixed(2);
      card.querySelector("[data-support-depth]").value = centerDepth(n).toFixed(2);
      card.querySelector("[data-support-bandwidth]").value = axialBandwidth(n, aperture, wavelength).toFixed(3);
    }
    figure.querySelector("[data-air-resolution]").value = (1 / airBandwidth).toFixed(2);
    figure.querySelector("[data-sample-resolution]").value = (1 / sampleBandwidth).toFixed(2);
    figure.querySelector("[data-stretch]").value = `${(airBandwidth / sampleBandwidth).toFixed(2)}×`;
    figure.querySelector("[data-support-status]").textContent = `Lateral cutoff: ±${cutoff.toFixed(2)} cycles/µm in both media. Maximum |kz|: ${airBandwidth.toFixed(3)} in air, ${sampleBandwidth.toFixed(3)} cycles/µm in the sample.`;
    svg.querySelector("desc").textContent = `Two bilobed optical transfer function supports, with air shown as a dashed green boundary and sample index ${index.toFixed(2)} as a solid rust boundary. Both have lateral cutoff plus or minus 2 NA over wavelength, ${cutoff.toFixed(3)} cycles per micrometer. Dashed triangles show the air construction on the left lobe and sample construction on the right. Their radii are n over wavelength, with half angles theta measured from the vertical. Theta is arcsine of NA over n: ${(Math.asin(aperture) / radians).toFixed(1)} degrees in air and ${(Math.asin(aperture / index) / radians).toFixed(1)} degrees in the sample. The circle center depth c is n cosine theta over wavelength. External vertical bars show the positive axial extent B, equal to the radius minus c: both are on the right, with the sample bar nearer the plot and the air bar farther out. Horizontal guides connect each bar to the baseline and its lobe apex. B is n times one minus cosine theta over wavelength, or n minus the square root of n squared minus NA squared, all divided by wavelength. B decreases from ${airBandwidth.toFixed(3)} in air to ${sampleBandwidth.toFixed(3)} cycles per micrometer in the sample. Support reaches both plus and minus B, so its full vertical span is 2 B. These extrema occur at absolute lateral frequency NA over wavelength; the origin is the only supported point on the axial-frequency axis. The article's axial resolution, delta z equal to one over B, increases from ${(1 / airBandwidth).toFixed(3)} to ${(1 / sampleBandwidth).toFixed(3)} micrometers.`;
    return markup;
  }

  for (const figure of document.querySelectorAll("[data-otf]")) {
    const host = figure.querySelector(".plot-interactive");
    const svg = figure.querySelector("svg");
    const inputs = [...figure.querySelectorAll("input[type=range]")];
    function render() {
      const width = Math.max(220, svg.getBoundingClientRect().width || 680);
      svg.querySelector("[data-drawing]").innerHTML = figure.dataset.otf === "refraction"
        ? drawRefraction(figure, svg, width)
        : drawSupport(figure, svg, width);
      for (const input of inputs) {
        const value = Number(input.value).toFixed(Number(input.dataset.digits));
        const formatted = `${value}${input.dataset.unit || ""}`;
        figure.querySelector(`output[for="${input.id}"]`).value = formatted;
        input.setAttribute("aria-valuetext", formatted);
      }
    }
    inputs.forEach(input => input.addEventListener("input", render));
    figure.querySelector("[data-reset]").addEventListener("click", () => {
      inputs.forEach(input => { input.value = input.defaultValue; });
      render();
    });
    figure.querySelector("[data-match]")?.addEventListener("click", () => {
      figure.querySelector("[data-index]").value = "1";
      render();
    });
    render();
    host.hidden = false;
    figure.querySelector(".plot-fallback").hidden = true;
    new ResizeObserver(render).observe(svg);
  }
})();
