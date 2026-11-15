(() => {
  'use strict';

  const lab = document.querySelector('[data-deconvolution]');
  if (!lab || !window.Worker) return;
  const panel = lab.querySelector('.plot-interactive');
  const defaults = { experiment: 'point', na: 1.46, wavelengthNm: 525, photons: 1000, iterations: 10, noise: true, seed: 1941, size: 128, pixelNm: 40 };
  let params = { ...defaults };
  let view = 'space';
  let result = null;
  let worker = null;
  let requestId = 0;
  let debounce = 0;
  let timeout = 0;
  const keys = ['truth', 'observed', 'restored'];
  const colors = ['#202b30', '#ab492b', '#31685d'];

  panel.innerHTML = `
    <div class="plot-controls deconvolution-controls">
      <div class="deconvolution-wide deconvolution-switches">
        <fieldset><legend>Specimen</legend><div class="plot-actions">
          <button type="button" data-specimen="point" aria-pressed="true">Point emitter</button>
          <button type="button" data-specimen="target" aria-pressed="false">Resolution target</button>
        </div></fieldset>
        <fieldset><legend>View</legend><div class="plot-actions">
          <button type="button" data-view="space" aria-pressed="true">Real space</button>
          <button type="button" data-view="frequency" aria-pressed="false">Frequency space</button>
        </div></fieldset>
      </div>
      <div class="plot-control"><label for="deconv-na">Numerical aperture<output for="deconv-na"></output></label><input id="deconv-na" data-param="na" type="range" min="0.5" max="1.49" step="0.01" value="1.46"></div>
      <div class="plot-control"><label for="deconv-wavelength">Emission wavelength<output for="deconv-wavelength"></output></label><input id="deconv-wavelength" data-param="wavelengthNm" type="range" min="400" max="750" step="5" value="525"></div>
      <div class="plot-control"><label for="deconv-photons">Peak photons<output for="deconv-photons"></output></label><input id="deconv-photons" data-param="photons" type="range" min="1" max="4" step="0.1" value="3"></div>
      <div class="plot-control"><label for="deconv-iterations">Richardson–Lucy iterations<output for="deconv-iterations"></output></label><input id="deconv-iterations" data-param="iterations" type="range" min="0" max="40" step="1" value="10"></div>
      <div class="deconvolution-wide plot-actions">
        <div class="deconvolution-noise"><label><input type="checkbox" data-noise checked>Poisson shot noise</label><button type="button" data-new-noise>New noise</button></div>
        <button type="button" data-reset>Reset simulation</button>
      </div>
      <p class="deconvolution-wide deconvolution-status" role="status" aria-live="polite">Preparing the live calculation…</p>
    </div>
    <div class="research-image">
      <span class="figure-label" aria-hidden="true">LIVE / DECONVOLUTION</span>
      <div class="deconvolution-images">${keys.map((key, i) => `
        <div class="deconvolution-image"><h4><b data-title="${key}">${['True specimen', 'Observed image', 'Reconstruction'][i]}</b><span data-subtitle="${key}"></span></h4>
          <canvas width="256" height="256" role="img" data-image="${key}" aria-label="${['True specimen', 'Observed image', 'Reconstruction'][i]}: calculation pending"></canvas>
          <div class="deconvolution-scale"><i aria-hidden="true"></i><span></span></div>
        </div>`).join('')}
      </div>
      <p class="deconvolution-view-note" data-view-note></p>
      <svg class="deconvolution-profile" viewBox="0 0 660 210" role="img" aria-label="Center-line comparison: calculation pending"></svg>
      <ul class="plot-legend">${['True specimen', 'Observed', 'Reconstruction'].map((label, i) => `<li><i aria-hidden="true" style="--line-color:${colors[i]}"></i>${label}</li>`).join('')}</ul>
      <span class="image-corner top-left" aria-hidden="true"></span><span class="image-corner bottom-right" aria-hidden="true"></span>
      <span class="figure-index" aria-hidden="true">2D / LIVE MODEL</span>
    </div>
    <div class="deconvolution-readout">
      <div><p class="plot-kicker">Optical cutoff · 2 NA / λ</p><span class="plot-value" data-cutoff>—</span><small> µm⁻¹</small></div>
      <div><p class="plot-kicker">Abbe period · λ / (2 NA)</p><span class="plot-value" data-period>—</span><small> nm</small></div>
    </div>
    <details class="deconvolution-model-note"><summary>What this live model calculates</summary>
      <p>Each optical change generates a new two-dimensional scalar circular-pupil point spread function (PSF). The specimen is convolved with that PSF; optional Poisson shot noise is added; Richardson–Lucy deconvolution uses the original PSF. Peak photons sets the expected count in the brightest pixel before noise. Changing it with noise off leaves the normalized image unchanged.</p>
      <p>This is an illustrative calculation, not a rerun of the published figures. It uses a small synthetic line target and shot noise only, rather than the article’s full USAF target and camera-noise simulation. Images use 40 nm pixels. The original figures and experimental data comparison remain below.</p>
      <p data-model-details></p>
      <p><a href="deconvolution-model.js">Calculation source</a></p>
    </details>`;

  const status = panel.querySelector('.deconvolution-status');
  const canvases = keys.map(key => panel.querySelector(`[data-image="${key}"]`));
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  if (contexts.some(context => !context)) return;
  const profile = panel.querySelector('.deconvolution-profile');
  const controls = [...panel.querySelectorAll('[data-param]')];
  const noiseControl = panel.querySelector('[data-noise]');
  const newNoise = panel.querySelector('[data-new-noise]');
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  panel.hidden = false;
  lab.querySelector('[data-live-fallback]').hidden = true;

  function syncControls() {
    for (const input of controls) {
      const key = input.dataset.param;
      input.value = key === 'photons' ? Math.log10(params.photons) : params[key];
      const value = key === 'na' ? params.na.toFixed(2) : number.format(params[key]);
      input.previousElementSibling.querySelector('output').textContent = value + (key === 'wavelengthNm' ? ' nm' : '');
      input.setAttribute('aria-valuetext', value + (key === 'wavelengthNm' ? ' nanometers' : key === 'photons' ? ' peak photons' : ''));
    }
    noiseControl.checked = params.noise;
    newNoise.disabled = !params.noise;
    panel.querySelector('[data-param="photons"]').disabled = !params.noise;
    for (const button of panel.querySelectorAll('[data-specimen]')) button.setAttribute('aria-pressed', String(button.dataset.specimen === params.experiment));
    for (const button of panel.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }

  function stopCalculation() {
    window.clearTimeout(debounce);
    window.clearTimeout(timeout);
    if (worker) worker.terminate();
    worker = null;
    requestId++;
  }

  function fail() {
    stopCalculation();
    lab.dataset.state = 'error';
    panel.removeAttribute('aria-busy');
    status.textContent = 'Live calculation unavailable. Try Reset simulation, or explore the original figures below.';
  }

  function calculate() {
    const id = requestId;
    const started = performance.now();
    try {
      worker = new Worker('deconvolution-worker.js');
      worker.onerror = event => { event.preventDefault(); if (id === requestId) fail(); };
      worker.onmessage = event => {
        if (event.data.id !== requestId) return;
        if (event.data.error) { fail(); return; }
        result = event.data.result;
        window.clearTimeout(timeout);
        worker.terminate();
        worker = null;
        lab.dataset.state = 'ready';
        panel.removeAttribute('aria-busy');
        try { render(); } catch (_) { fail(); return; }
        status.textContent = `Calculated ${params.iterations} iterations in ${Math.round(performance.now() - started)} ms · ${result.size} × ${result.size} pixels · ${result.pixelNm} nm / pixel.`;
      };
      timeout = window.setTimeout(fail, 30000);
      worker.postMessage({ id, params: { ...params } });
    } catch (_) { fail(); }
  }

  function schedule(immediate = false) {
    stopCalculation();
    syncControls();
    lab.dataset.state = 'busy';
    panel.setAttribute('aria-busy', 'true');
    status.textContent = `Calculating ${params.iterations} iterations…${result ? ' Previous result is shown until ready.' : ''}`;
    if (immediate) calculate();
    else debounce = window.setTimeout(calculate, 180);
  }

  const ramp = [[19, 30, 34], [58, 62, 65], [145, 73, 48], [218, 137, 69], [255, 244, 201]];
  function color(value) {
    const t = Math.max(0, Math.min(1, value)) * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(t));
    return ramp[i].map((v, channel) => Math.round(v + (ramp[i + 1][channel] - v) * (t - i)));
  }
  const palette = Array.from({ length: 256 }, (_, i) => color(i / 255));
  function maximum(values) {
    let max = 0;
    for (const value of values) max = Math.max(max, value);
    return max || 1;
  }

  function imageData(values, size, start, extent, scale, frequency, point) {
    const image = new ImageData(extent, extent);
    for (let y = 0; y < extent; y++) for (let x = 0; x < extent; x++) {
      const value = Math.max(0, values[(start + y) * size + start + x] / scale);
      const displayed = frequency ? Math.max(0, (Math.log10(Math.max(value, 1e-4)) + 4) / 4) : point ? Math.sqrt(value) : value;
      const rgb = palette[Math.max(0, Math.min(255, Math.round(displayed * 255)))];
      const offset = (y * extent + x) * 4;
      image.data[offset] = rgb[0]; image.data[offset + 1] = rgb[1]; image.data[offset + 2] = rgb[2]; image.data[offset + 3] = 255;
    }
    return image;
  }

  function render() {
    if (!result) return;
    const frequency = view === 'frequency';
    const point = result.experiment === 'point';
    const size = result.size;
    const extent = frequency ? size : point ? size / 2 : size;
    const start = (size - extent) / 2;
    const arrays = keys.map(key => frequency ? result.spectra[key] : result[key]);
    const commonMax = Math.max(...keys.map(key => maximum(result[key])));
    const scales = arrays.map(array => frequency ? 1 : point ? maximum(array) : commonMax);
    const fieldUm = extent * result.pixelNm / 1000;
    const frequencyExtent = 1000 / result.pixelNm;
    const scaleLength = frequency ? 5 : 1;
    const scaleFraction = frequency ? scaleLength / frequencyExtent : scaleLength / fieldUm;
    canvases.forEach((canvas, index) => {
      const scratch = document.createElement('canvas');
      scratch.width = scratch.height = extent;
      scratch.getContext('2d').putImageData(imageData(arrays[index], size, start, extent, scales[index], frequency, point), 0, 0);
      const context = contexts[index];
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 256, 256);
      context.drawImage(scratch, 0, 0, 256, 256);
      if (frequency) {
        context.beginPath();
        context.strokeStyle = '#202b30';
        context.lineWidth = 3.5;
        context.setLineDash([5, 4]);
        context.arc(128, 128, 256 * result.cutoffPerUm / frequencyExtent, 0, 2 * Math.PI);
        context.stroke();
        context.strokeStyle = '#fffdf7';
        context.lineWidth = 1.5;
        context.stroke();
        context.setLineDash([]);
      } else if (!point) {
        const profileY = 256 * (0.5 + result.profileYUm / fieldUm);
        context.beginPath();
        context.strokeStyle = '#fffdf7';
        context.lineWidth = 1;
        context.globalAlpha = 0.55;
        context.setLineDash([3, 4]);
        context.moveTo(0, profileY); context.lineTo(256, profileY);
        context.stroke();
        context.setLineDash([]); context.globalAlpha = 1;
      }
      const scale = canvas.nextElementSibling;
      scale.querySelector('i').style.width = `${scaleFraction * 100}%`;
      scale.querySelector('span').textContent = `${scaleLength} ${frequency ? 'µm⁻¹' : 'µm'}`;
      canvas.setAttribute('aria-label', `${['True specimen', 'Observed image', 'Richardson–Lucy reconstruction'][index]}, ${point ? 'point emitter' : 'resolution target'}, ${frequency ? 'frequency space; dashed circle marks optical cutoff' : `real space; ${fieldUm.toFixed(2)} micrometers wide`}.`);
    });
    panel.querySelector('[data-subtitle="truth"]').textContent = point ? 'Single point emitter' : 'Synthetic line groups';
    panel.querySelector('[data-subtitle="observed"]').textContent = result.noise ? 'Blur + shot noise' : 'Blur only';
    panel.querySelector('[data-title="restored"]').textContent = result.iterations === 0 ? 'Initial estimate' : 'Reconstruction';
    panel.querySelector('[data-subtitle="restored"]').textContent = result.iterations === 0 ? 'Uniform · 0 iterations' : `${result.iterations} iterations`;
    panel.querySelector('[data-cutoff]').textContent = result.cutoffPerUm.toFixed(2);
    panel.querySelector('[data-period]').textContent = Math.round(1000 / result.cutoffPerUm);
    panel.querySelector('[data-view-note]').textContent = frequency
      ? 'Full-domain Fourier magnitude, normalized to each image’s zero frequency. Log display: 10⁻⁴ to 1. Dashed circles mark the optical cutoff; frequencies outside it are not new measurements.'
      : `${point ? 'Central crop' : 'Image field'}: ${fieldUm.toFixed(2)} µm wide. ${point ? 'Each image is scaled to its own peak, with gamma 0.5, to compare shape. The profile crosses the center.' : `All panels share one linear intensity scale. Left to right: ${4 * result.pixelNm}, ${6 * result.pixelNm}, and ${8 * result.pixelNm} nm line-pair periods. The dashed line marks the profile below.`}`;
    panel.querySelector('[data-model-details]').textContent = typeof result.modelDescription === 'string' ? result.modelDescription : '';
    drawProfile(arrays, scales, { frequency, point, size, start, extent, fieldUm, frequencyExtent });
  }

  function drawProfile(arrays, scales, options) {
    const { frequency, point, size, start, extent, fieldUm, frequencyExtent } = options;
    const measuredWidth = Math.max(240, Math.round(profile.getBoundingClientRect().width));
    profile.setAttribute('viewBox', `0 0 ${measuredWidth} 210`);
    const left = 43, top = 22, width = measuredWidth - 55, height = 142;
    const xDomain = frequency ? frequencyExtent : fieldUm;
    const x = value => left + (value / xDomain + .5) * width;
    const y = value => top + (1 - Math.max(0, Math.min(1, value))) * height;
    const nodes = [];
    const node = (name, attributes, text) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      if (text !== undefined) element.textContent = text;
      nodes.push(element);
      return element;
    };
    [0, .5, 1].forEach(value => {
      node('line', { x1: left, x2: left + width, y1: y(value), y2: y(value), class: 'profile-grid' });
      node('text', { x: left - 9, y: y(value) + 4, 'text-anchor': 'end' }, frequency ? ['10⁻⁴', '10⁻²', '1'][value * 2] : String(value));
    });
    node('line', { x1: left, x2: left + width, y1: top + height, y2: top + height, class: 'profile-axis' });
    const tick = frequency ? 5 : point ? .5 : 1;
    for (let value = -Math.floor(xDomain / 2 / tick) * tick; value <= xDomain / 2; value += tick) {
      node('line', { x1: x(value), x2: x(value), y1: top + height, y2: top + height + 4, class: 'profile-axis' });
      node('text', { x: x(value), y: top + height + 19, 'text-anchor': 'middle' }, String(value));
    }
    if (frequency) {
      [-1, 1].forEach(sign => node('line', { x1: x(sign * result.cutoffPerUm), x2: x(sign * result.cutoffPerUm), y1: top, y2: top + height, class: 'profile-cutoff' }));
      node('text', { x: x(result.cutoffPerUm) + 5, y: top + 11 }, 'cutoff');
    }
    arrays.forEach((array, index) => {
      const coordinates = [];
      for (let i = 0; i < extent; i++) {
        const sample = frequency ? array[Math.floor(size / 2) * size + start + i] : result.profiles[keys[index]][start + i];
        const value = Math.max(0, sample / scales[index]);
        const normalized = frequency ? (Math.log10(Math.max(value, 1e-4)) + 4) / 4 : value;
        coordinates.push(`${i ? 'L' : 'M'}${x(((start + i) / size - .5) * (frequency ? frequencyExtent : size * result.pixelNm / 1000)).toFixed(2)},${y(normalized).toFixed(2)}`);
      }
      node('path', { d: coordinates.join(' '), stroke: colors[index], class: 'profile-line' });
    });
    node('text', { x: left + width / 2, y: 205, 'text-anchor': 'middle' }, frequency ? 'Spatial frequency (µm⁻¹)' : 'Position (µm)');
    node('text', { x: left, y: 11 }, frequency ? 'Normalized Fourier magnitude' : point ? 'Peak-normalized intensity' : 'Intensity (shared scale)');
    profile.replaceChildren(...nodes);
    profile.setAttribute('aria-label', `${frequency ? 'Fourier magnitude along the horizontal center line' : `Intensity along the horizontal line at ${result.profileYUm.toFixed(2)} micrometers`}. Black: true specimen. Rust: observed. Green: reconstructed.${frequency ? ` Optical cutoff: ${result.cutoffPerUm.toFixed(2)} inverse micrometers.` : ''}`);
  }

  for (const input of controls) input.addEventListener('input', () => {
    params[input.dataset.param] = input.dataset.param === 'photons' ? Math.round(10 ** Number(input.value)) : Number(input.value);
    schedule();
  });
  noiseControl.addEventListener('change', () => { params.noise = noiseControl.checked; schedule(true); });
  newNoise.addEventListener('click', () => { params.seed = (params.seed + 1) >>> 0; schedule(true); });
  panel.querySelector('[data-reset]').addEventListener('click', () => { params = { ...defaults }; view = 'space'; schedule(true); });
  for (const button of panel.querySelectorAll('[data-specimen]')) button.addEventListener('click', () => {
    if (params.experiment === button.dataset.specimen) return;
    params.experiment = button.dataset.specimen; schedule(true);
  });
  for (const button of panel.querySelectorAll('[data-view]')) button.addEventListener('click', () => { view = button.dataset.view; syncControls(); render(); });
  for (const link of document.querySelectorAll('[data-live-specimen]')) link.addEventListener('click', () => {
    params.experiment = link.dataset.liveSpecimen;
    schedule(true);
    lab.querySelector('h3').focus({ preventScroll: true });
  });
  window.addEventListener('pagehide', stopCalculation);
  window.addEventListener('pageshow', event => { if (event.persisted) schedule(true); });
  if (window.ResizeObserver) {
    let previousWidth = 0;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - previousWidth) > 1) { previousWidth = width; render(); }
    });
    observer.observe(profile);
  } else window.addEventListener('resize', render);
  schedule(true);
})();
