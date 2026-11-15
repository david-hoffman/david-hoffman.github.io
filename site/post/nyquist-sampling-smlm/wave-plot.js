/* The article's square-wave model, drawn with native SVG. No dependencies. */
(() => {
  "use strict";

  const figure = document.querySelector("[data-wave-plot]");
  if (!figure) return;

  const controls = {
    signal: figure.querySelector("#wave-signal"),
    background: figure.querySelector("#wave-background"),
    period: figure.querySelector("#wave-period"),
  };
  const svg = figure.querySelector("svg");
  const x = (coordinate) => 60 + coordinate * 145;
  const y = (intensity) => 274 - intensity * 6.5;

  function wavePath(signal, background, period) {
    // Each half-period is flat; the first half contains background only.
    let path = `M ${x(0)} ${y(background)}`;
    const halfPeriod = period / 2;
    for (let step = 0; step * halfPeriod < 4; step += 1) {
      const end = Math.min(4, (step + 1) * halfPeriod);
      path += ` H ${x(end)}`;
      if (end < 4) path += ` V ${y(background + (step % 2 === 0 ? signal : 0))}`;
    }
    return path;
  }

  function update() {
    const signal = Number(controls.signal.value);
    const background = Number(controls.background.value);
    const period = Number(controls.period.value);
    const variance = signal + 2 * background;
    const snr = variance === 0 ? null : signal / Math.sqrt(variance);

    figure.querySelector("[data-wave-total]").setAttribute("d", wavePath(signal, background, period));
    figure.querySelector("[data-wave-signal]").setAttribute("d", wavePath(signal, 0, period));
    const baseline = figure.querySelector("[data-wave-background]");
    baseline.setAttribute("y1", y(background));
    baseline.setAttribute("y2", y(background));

    const start = x(period / 2);
    const end = x(period * 1.5);
    const bracketY = y(signal + background) - 22;
    figure.querySelector("[data-wave-period]").setAttribute("d",
      `M ${start} ${bracketY + 5} V ${bracketY - 5} M ${start} ${bracketY} H ${end} M ${end} ${bracketY + 5} V ${bracketY - 5}`);
    const periodLabel = figure.querySelector("[data-wave-period-label]");
    periodLabel.setAttribute("x", (start + end) / 2);
    periodLabel.setAttribute("y", bracketY - 10);
    periodLabel.textContent = `L = ${period.toFixed(1)}`;

    for (const [name, input] of Object.entries(controls)) {
      figure.querySelector(`output[for="${input.id}"]`).value =
        name === "period" ? period.toFixed(1) : input.value;
    }
    figure.querySelector("#wave-snr").value = snr === null ? "Undefined" : snr.toFixed(2);
    figure.querySelector("#wave-snr-note").textContent = snr === null
      ? "No signal or background counts: the signal-to-noise ratio is undefined (0/0)."
      : `SNR = S / √(S + 2B) = ${signal} / √${variance}. Counts are means per period; L changes the spacing only.`;
    svg.querySelector("desc").textContent =
      `Square wave with signal ${signal}, background ${background}, and period ${period} arbitrary units. ` +
      `The orange wave alternates between ${background} and ${signal + background}; the green signal alternates between 0 and ${signal}. ` +
      `Signal-to-noise ratio: ${snr === null ? "undefined, no counts" : snr.toFixed(2)}.`;
  }

  for (const input of Object.values(controls)) input.addEventListener("input", update);
  figure.querySelector("[data-wave-reset]").addEventListener("click", () => {
    for (const input of Object.values(controls)) input.value = input.defaultValue;
    update();
  });
  update();
  figure.querySelector(".plot-interactive").hidden = false;
  figure.querySelector(".plot-fallback").hidden = true;
})();
