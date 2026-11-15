/* Two models from the article, rendered directly in SVG. */
(() => {
  "use strict";
  const radians = Math.PI / 180;
  const aperture = 0.8;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const signed = (value, digits = 2) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
  const line = (x1, y1, x2, y2, className) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}"/>`;
  const label = (x, y, text, anchor = "middle", className = "") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${className}">${text}</text>`;
  const handle = (x, y) => `<g class="optics-handle" data-handle aria-hidden="true">
    <circle class="optics-hit" cx="${x}" cy="${y}" r="23"/>
    <circle class="optics-halo" cx="${x}" cy="${y}" r="12"/>
    <circle class="optics-spot" cx="${x}" cy="${y}" r="5"/>
  </g>`;

  for (const figure of document.querySelectorAll("[data-optics]")) {
    const isPosition = figure.dataset.optics === "position";
    const host = figure.querySelector(".plot-interactive");
    const svg = figure.querySelector("svg");
    const drawing = svg.querySelector("[data-drawing]");
    const inputs = [...figure.querySelectorAll("input[type=range]")];
    const input = inputs[0];
    const focal = inputs[1];
    const index = inputs[2];
    let geometry;
    let activePointer = null;

    function render() {
      const width = Math.max(240, svg.getBoundingClientRect().width || 680);
      const height = 300;
      const axis = 143;
      const f = Number(focal.value);
      const n = index ? Number(index.value) : 1;
      // Limit the physical offset to the aperture when focal length changes.
      if (!isPosition) {
        const limit = Number((f * aperture).toFixed(2));
        const previous = Number(input.value);
        input.min = String(-limit);
        input.max = String(limit);
        input.value = String(clamp(previous, -limit, limit));
      }
      const value = Number(input.value);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      let markup = line(16, axis, width - 16, axis, "optics-axis");

      if (isPosition) {
        const theta = value * radians;
        const displacement = f * Math.tan(theta);
        const lens = width * 0.34;
        const left = 30;
        const scale = Math.min((width - lens - 42) / 8, 35);
        const focus = lens + f * scale;
        const spot = axis - displacement * scale;
        const rayStart = axis + (lens - left) * Math.tan(theta);
        const halfBeam = 1.15 * scale;
        geometry = { axis, lens, left, width };

        markup += line(focus, 34, focus, 249, "optics-plane");
        markup += `<path class="optics-lens" d="M ${lens} 45 Q ${lens - 19} ${axis} ${lens} 241 Q ${lens + 19} ${axis} ${lens} 45 Z"/>`;
        markup += `<path class="optics-beam" d="M ${left} ${rayStart - halfBeam} L ${lens} ${axis - halfBeam} L ${focus} ${spot} L ${lens} ${axis + halfBeam} L ${left} ${rayStart + halfBeam} Z"/>`;
        for (const delta of [-halfBeam, halfBeam]) {
          markup += `<path class="optics-ray optics-marginal" d="M ${left} ${rayStart + delta} L ${lens} ${axis + delta} L ${focus} ${spot}"/>`;
        }
        markup += `<path class="optics-ray" d="M ${left} ${rayStart} L ${lens} ${axis} L ${focus} ${spot}"/>`;
        const radius = Math.min(38, f * scale * .45);
        const arcX = lens + radius * Math.cos(theta);
        const arcY = axis - radius * Math.sin(theta);
        markup += `<path class="optics-dimension" d="M ${lens + radius} ${axis} A ${radius} ${radius} 0 0 ${value >= 0 ? 0 : 1} ${arcX} ${arcY}"/>`;
        markup += label(lens + radius + 7, axis - 9, "θ", "start", "optics-label");
        markup += `<path class="optics-dimension" d="M ${lens} 262 v 8 M ${lens} 266 H ${focus} M ${focus} 262 v 8"/>`;
        markup += label((lens + focus) / 2, 287, `f = ${f.toFixed(1)} mm`);
        markup += line(focus + 13, axis, focus + 13, spot, "optics-dimension");
        markup += label(focus + 19, (axis + spot) / 2 + 4, "y", "start", "optics-label");
        markup += label(lens - 12, 24, "Lens", "end");
        markup += label(focus, 24, "Focal plane");
        markup += `<circle class="optics-spot" cx="${focus}" cy="${spot}" r="4.5"/>`;
        markup += handle(left, rayStart);
        figure.querySelector("[data-result]").value = signed(displacement);
        figure.querySelector("[data-equation]").textContent = `y = ${f.toFixed(1)} × tan(${signed(value, 1)}°)`;
        svg.querySelector("desc").textContent = `A parallel beam enters the lens at ${value} degrees. With focal length ${f} millimeters, the spot is displaced ${displacement.toFixed(3)} millimeters. The solid chief ray passes through the lens center; dashed marginal rays meet it at the focal plane.`;
      } else {
        const theta = Math.asin(value / (f * n));
        const degrees = theta / radians;
        const pupil = width * .24;
        const bodyStart = pupil + 9;
        const bodyEnd = width * .53;
        const pupilY = axis - value / (f * aperture) * 78;
        const origin = bodyEnd + 12;
        const length = Math.min(width * .36, 147);
        const endX = origin + length * Math.cos(theta);
        const endY = axis + length * Math.sin(theta);
        const dx = -Math.sin(theta) * 8;
        const dy = Math.cos(theta) * 8;
        geometry = { axis, pupil, halfPupil: 78, f, width };

        // The objective hides internal ray paths: this is a sine-condition
        // mapping, not a thin-lens construction with a tangent relationship.
        markup += `<path class="optics-beam" d="M 18 ${pupilY - 14} L ${pupil} ${pupilY} L 18 ${pupilY + 14} Z"/>`;
        markup += line(18, pupilY - 14, pupil, pupilY, "optics-ray optics-marginal");
        markup += line(18, pupilY + 14, pupil, pupilY, "optics-ray optics-marginal");
        markup += line(18, pupilY, pupil, pupilY, "optics-ray");
        markup += line(pupil, 52, pupil, 234, "optics-plane");
        markup += `<path class="optics-lens" d="M ${bodyStart} 51 H ${bodyEnd - 13} L ${bodyEnd} 74 V 212 L ${bodyEnd - 13} 235 H ${bodyStart} Z"/>`;
        for (const fraction of [.2, .32, .68]) {
          const x = bodyStart + (bodyEnd - bodyStart) * fraction;
          markup += line(x, 57, x, 229, "optics-plane");
        }
        markup += `<path class="optics-beam" d="M ${origin + dx} ${axis + dy} L ${endX + dx} ${endY + dy} L ${endX - dx} ${endY - dy} L ${origin - dx} ${axis - dy} Z"/>`;
        markup += line(origin, axis, endX, endY, "optics-ray");
        for (const sign of [-1, 1]) markup += line(origin + sign * dx, axis + sign * dy, endX + sign * dx, endY + sign * dy, "optics-ray optics-marginal");
        const radius = Math.min(40, length * .5);
        markup += `<path class="optics-dimension" d="M ${origin + radius} ${axis} A ${radius} ${radius} 0 0 ${value >= 0 ? 1 : 0} ${origin + radius * Math.cos(theta)} ${axis + radius * Math.sin(theta)}"/>`;
        markup += label(origin + radius + 6, axis + (value >= 0 ? 20 : -12), "θ", "start", "optics-label");
        markup += label(pupil, 24, "Back pupil");
        markup += label(bodyEnd + (width - bodyEnd) / 2, 24, "Output beam");
        markup += label((bodyStart + bodyEnd) / 2, 262, "Objective");
        markup += label((bodyStart + bodyEnd) / 2, 281, "NA = 0.80");
        markup += line(pupil - 15, axis, pupil - 15, pupilY, "optics-dimension");
        markup += label(pupil - 22, (axis + pupilY) / 2 + 4, "y", "end", "optics-label");
        markup += handle(pupil, pupilY);
        figure.querySelector("[data-result]").value = signed(degrees, 1);
        figure.querySelector("[data-equation]").textContent = `θ = sin⁻¹(${signed(value)} / (${f.toFixed(1)} × ${n.toFixed(2)}))`;
        figure.querySelector("[data-pupil-limit]").textContent = `Allowed pupil offset: ±${(f * aperture).toFixed(2)} mm.`;
        svg.querySelector("desc").textContent = `An input spot ${value.toFixed(2)} millimeters from the pupil center produces a collimated beam tilted ${degrees.toFixed(2)} degrees. Focal length ${f} millimeters, sample refractive index ${n}. Positive pupil offset is above the axis; positive output angle points downward. Objective schematic, not to scale.`;
      }
      drawing.innerHTML = markup;
      for (const control of inputs) {
        const digits = control === index || (!isPosition && control === input) ? 2 : 1;
        const units = control.dataset.unit || "";
        const value = Number(control.value);
        figure.querySelector(`output[for="${control.id}"]`).value = `${control === input ? signed(value, digits) : value.toFixed(digits)}${units}`;
        control.setAttribute("aria-valuetext", `${value.toFixed(digits)}${units}`);
      }
    }

    function moveHandle(event) {
      const rect = svg.getBoundingClientRect();
      const y = (event.clientY - rect.top) * 300 / rect.height;
      const value = isPosition
        ? Math.atan((y - geometry.axis) / (geometry.lens - geometry.left)) / radians
        : (geometry.axis - y) / geometry.halfPupil * geometry.f * aperture;
      const bounded = clamp(value, Number(input.min), Number(input.max));
      const step = Number(input.step);
      input.value = String(Math.round(bounded / step) * step);
      render();
    }

    svg.addEventListener("pointerdown", event => {
      if (!event.target.closest("[data-handle]") || event.button !== 0) return;
      activePointer = event.pointerId;
      svg.setPointerCapture(activePointer);
      svg.classList.add("is-dragging");
      moveHandle(event);
    });
    svg.addEventListener("pointermove", event => {
      if (event.pointerId === activePointer) moveHandle(event);
    });
    function endDrag() {
      activePointer = null;
      svg.classList.remove("is-dragging");
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("lostpointercapture", endDrag);
    inputs.forEach(control => control.addEventListener("input", render));
    figure.querySelector("[data-center]").addEventListener("click", () => { input.value = "0"; render(); });
    figure.querySelector("[data-reset]").addEventListener("click", () => {
      // Restore the offset's original bounds before its value, avoiding the
      // browser clamping a default against a previously shortened focal length.
      focal.value = focal.defaultValue;
      if (!isPosition) { input.min = String(-aperture * Number(focal.value)); input.max = String(aperture * Number(focal.value)); }
      inputs.forEach(control => { control.value = control.defaultValue; });
      render();
    });
    render();
    host.hidden = false;
    figure.querySelector(".plot-fallback").hidden = true;
    const observer = new ResizeObserver(render);
    observer.observe(svg);
  }
})();
