/* A live, illustrative 2D incoherent imaging model, not the data behind Figs. 1–3.
 * Scalar circular pupil with the published Hanser model's sine apodization,
 * n = 1.518, and five-sample pixel integration; PSF normalized to unit flux.
 * The pupil autocorrelation has an exact discrete support bounded by 2 NA / λ.
 * Work on a 2×-wide periodic FFT grid and show its central half: the dark guard
 * region separates the compact object from its periodic copies. Airy tails are
 * periodic on this finite grid; this is not an infinite-space calculation.
 * Spectra always use the full computational grid, never the displayed crop.
 * RL uses the mean initialization and unaccelerated multiplicative update of
 * the article's pyDecon reference, with an optional known uniform background.
 * Camera read noise, 3D diffraction, vector polarization, and aberrations are
 * deliberately omitted. No plotted PNG is used as measured or simulated data.
 */
(() => {
  "use strict";

  const DEFAULTS = Object.freeze({ experiment: "point", na: 1.46, wavelengthNm: 525,
    pixelNm: 40, size: 128, iterations: 10, photons: 1000, noise: true,
    background: 0, seed: 20261115 });

  function parameters(input = {}) {
    const p = { ...DEFAULTS, ...input };
    for (const key of ["na", "wavelengthNm", "pixelNm", "size", "iterations", "photons", "background", "seed"]) {
      if (!Number.isFinite(p[key])) throw new Error(`Invalid ${key}.`);
    }
    if (!["point", "target"].includes(p.experiment)) throw new Error("Choose point or target.");
    if (![128, 256].includes(p.size)) throw new Error("Use a 128 or 256 pixel display.");
    if (p.na < 0.2 || p.na > 1.5 || p.wavelengthNm < 350 || p.wavelengthNm > 800 ||
        p.pixelNm < 10 || p.pixelNm > 100) throw new Error("Optical parameters are outside this model's range.");
    if (2 * p.na / p.wavelengthNm >= 1 / (2 * p.pixelNm)) {
      throw new Error("Pixel sampling must put the incoherent cutoff below Nyquist.");
    }
    if (!Number.isInteger(p.iterations) || p.iterations < 0 || p.iterations > 100 ||
        p.photons < 1 || p.photons > 1000000 || p.background < 0 || p.background > 10000 ||
        !Number.isInteger(p.seed) || typeof p.noise !== "boolean") throw new Error("Invalid simulation controls.");
    return p;
  }

  class FFTGrid {
    constructor(size) {
      if (size < 2 || (size & (size - 1))) throw new Error("FFT size must be a power of two.");
      this.size = size;
      this.reverse = new Uint32Array(size);
      const bits = Math.log2(size);
      for (let i = 0; i < size; i++) {
        let value = i, reversed = 0;
        for (let bit = 0; bit < bits; bit++) { reversed = (reversed << 1) | (value & 1); value >>>= 1; }
        this.reverse[i] = reversed;
      }
      this.cos = new Float64Array(size / 2);
      this.sin = new Float64Array(size / 2);
      for (let i = 0; i < size / 2; i++) {
        this.cos[i] = Math.cos(2 * Math.PI * i / size);
        this.sin[i] = Math.sin(2 * Math.PI * i / size);
      }
    }

    line(real, imaginary, offset, stride, inverse) {
      const n = this.size;
      for (let i = 0; i < n; i++) {
        const j = this.reverse[i];
        if (j <= i) continue;
        const a = offset + i * stride, b = offset + j * stride;
        let swap = real[a]; real[a] = real[b]; real[b] = swap;
        swap = imaginary[a]; imaginary[a] = imaginary[b]; imaginary[b] = swap;
      }
      for (let width = 2; width <= n; width *= 2) {
        const half = width / 2, twiddleStep = n / width;
        for (let start = 0; start < n; start += width) {
          for (let j = 0; j < half; j++) {
            const a = offset + (start + j) * stride, b = a + half * stride;
            const cosine = this.cos[j * twiddleStep];
            const sine = (inverse ? 1 : -1) * this.sin[j * twiddleStep];
            const re = real[b] * cosine - imaginary[b] * sine;
            const im = real[b] * sine + imaginary[b] * cosine;
            real[b] = real[a] - re; imaginary[b] = imaginary[a] - im;
            real[a] += re; imaginary[a] += im;
          }
        }
      }
    }

    transform(real, imaginary, inverse = false) {
      const n = this.size;
      if (real.length !== n * n || imaginary.length !== n * n) throw new Error("Wrong FFT buffer size.");
      for (let row = 0; row < n; row++) this.line(real, imaginary, row * n, 1, inverse);
      for (let col = 0; col < n; col++) this.line(real, imaginary, col, n, inverse);
      if (inverse) {
        const scale = 1 / (n * n);
        for (let i = 0; i < real.length; i++) { real[i] *= scale; imaginary[i] *= scale; }
      }
    }
  }

  function createOptics(size, na, wavelengthNm, pixelNm) {
    const fft = new FFTGrid(size), real = new Float64Array(size * size);
    const imaginary = new Float64Array(real.length);
    const pupilRadius = na / wavelengthNm * size * pixelNm;
    const immersionIndex = 1.518;
    for (let y = 0; y < size; y++) {
      const ky = y < size / 2 ? y : y - size;
      for (let x = 0; x < size; x++) {
        const kx = x < size / 2 ? x : x - size;
        const radiusSquared = kx * kx + ky * ky;
        if (radiusSquared <= pupilRadius * pupilRadius) {
          const sineSquared = radiusSquared * (wavelengthNm / (size * pixelNm * immersionIndex)) ** 2;
          real[y * size + x] = (1 - sineSquared) ** -0.25;
        }
      }
    }
    fft.transform(real, imaginary, true);
    let flux = 0;
    const psf = new Float64Array(real.length);
    for (let i = 0; i < psf.length; i++) { psf[i] = real[i] ** 2 + imaginary[i] ** 2; flux += psf[i]; }
    for (let i = 0; i < psf.length; i++) psf[i] /= flux;
    real.set(psf); imaginary.fill(0);
    fft.transform(real, imaginary);
    // Original pyOTF samples the camera pixel at five equally spaced points
    // per axis, centered by rolling the fine PSF before binning. Apply that
    // same averaging in frequency space: the optical PSF is already sampled
    // above Nyquist, so no 5×-larger spatial array is needed. See the independent
    // oversample/roll/bin NumPy comparison in scripts/check_deconvolution_model.py.
    const pixelTransfer = new Float64Array(size);
    for (let x = 0; x < size; x++) {
      const frequency = (x < size / 2 ? x : x - size) / size;
      pixelTransfer[x] = (1 + 2 * Math.cos(2 * Math.PI * frequency / 5) + 2 * Math.cos(4 * Math.PI * frequency / 5)) / 5;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x, transfer = pixelTransfer[x] * pixelTransfer[y];
        real[index] *= transfer; imaginary[index] *= transfer;
      }
    }
    const spatialReal = new Float64Array(real), spatialImaginary = new Float64Array(imaginary);
    fft.transform(spatialReal, spatialImaginary, true);
    for (let i = 0; i < psf.length; i++) psf[i] = Math.max(0, spatialReal[i]);
    return { fft, psf, real, imaginary };
  }

  function convolve(input, optics, adjoint = false, output = new Float64Array(input.length), scratch) {
    const real = scratch?.real || new Float64Array(input.length);
    const imaginary = scratch?.imaginary || new Float64Array(input.length);
    real.set(input); imaginary.fill(0);
    optics.fft.transform(real, imaginary);
    for (let i = 0; i < real.length; i++) {
      const kr = optics.real[i], ki = adjoint ? -optics.imaginary[i] : optics.imaginary[i];
      const re = real[i] * kr - imaginary[i] * ki;
      imaginary[i] = real[i] * ki + imaginary[i] * kr; real[i] = re;
    }
    optics.fft.transform(real, imaginary, true);
    // Roundoff can make mathematically zero values slightly negative.
    for (let i = 0; i < output.length; i++) output[i] = Math.max(0, real[i]);
    return output;
  }

  function richardsonLucy(observed, optics, iterations, background = 0) {
    const estimate = new Float64Array(observed.length);
    const scratch = { real: new Float64Array(estimate.length), imaginary: new Float64Array(estimate.length) };
    const work = new Float64Array(estimate.length);
    // The published simulation explicitly chooses init="mean". A uniform
    // positive estimate also avoids zero-locking from noisy image pixels.
    let mean = 0;
    for (const value of observed) mean += Math.max(0, value - background) / estimate.length;
    if (mean === 0) return estimate;
    estimate.fill(mean);
    for (let iteration = 0; iteration < iterations; iteration++) {
      convolve(estimate, optics, false, work, scratch);
      for (let i = 0; i < work.length; i++) work[i] = observed[i] / Math.max(Number.EPSILON, work[i] + background);
      convolve(work, optics, true, work, scratch);
      for (let i = 0; i < estimate.length; i++) estimate[i] *= work[i];
    }
    return estimate;
  }

  function randomGenerator(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  const logFactorials = new Float64Array(256);
  for (let i = 2; i < logFactorials.length; i++) logFactorials[i] = logFactorials[i - 1] + Math.log(i);
  function logFactorial(k) {
    if (k < logFactorials.length) return logFactorials[k];
    return (k + 0.5) * Math.log(k) - k + 0.9189385332046727 + 1 / (12 * k) - 1 / (360 * k ** 3);
  }

  function poisson(mean, random) {
    if (!(mean >= 0) || !Number.isFinite(mean)) throw new Error("Invalid Poisson mean.");
    if (mean === 0) return 0;
    if (mean < 30) {
      const threshold = Math.exp(-mean);
      let product = 1, count = 0;
      do { count++; product *= random(); } while (product > threshold);
      return count - 1;
    }
    // Hörmann's transformed rejection method, rather than a Gaussian
    // approximation: integer Poisson counts at both low and high brightness.
    const b = 0.931 + 2.53 * Math.sqrt(mean), a = -0.059 + 0.02483 * b;
    const inverseAlpha = 1.1239 + 1.1328 / (b - 3.4), vR = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const u = random() - 0.5, v = random(), us = 0.5 - Math.abs(u);
      if (!us) continue;
      const k = Math.floor((2 * a / us + b) * u + mean + 0.43);
      if (us >= 0.07 && v <= vR) return k;
      if (k < 0 || (us < 0.013 && v > us)) continue;
      if (Math.log(v * inverseAlpha / (a / (us * us) + b)) <= -mean + k * Math.log(mean) - logFactorial(k)) return k;
    }
  }

  function makeObject(size, experiment) {
    const image = new Float64Array(size * size), center = size / 2;
    if (experiment === "point") image[center * size + center] = 1;
    else {
      // Three-bar motifs, not a digitized/reconstructed USAF chart. The bar
      // widths are 2, 3, and 4 pixels; at the default sampling: 80, 120, 160 nm.
      for (let group = 0; group < 3; group++) {
        const width = group + 2, cx = center + (group - 1) * 36;
        for (let row = 0; row < 2; row++) {
          const cy = center + (row ? 24 : -24);
          for (let bar = 0; bar < 3; bar++) {
            const start = Math.round(-2.5 * width) + 2 * bar * width;
            for (let across = start; across < start + width; across++) {
              for (let along = -12; along < 12; along++) {
                const x = cx + (row ? along : across), y = cy + (row ? across : along);
                image[y * size + x] = 1;
              }
            }
          }
        }
      }
    }
    return image;
  }

  function crop(input, fullSize, size, originCentered = false) {
    const result = new Float32Array(size * size), start = (fullSize - size) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sy = (y + start + (originCentered ? fullSize / 2 : 0)) % fullSize;
        const sx = (x + start + (originCentered ? fullSize / 2 : 0)) % fullSize;
        result[y * size + x] = input[sy * fullSize + sx];
      }
    }
    return result;
  }

  function frequencyData(input, fft, displaySize, pixelNm) {
    const real = new Float64Array(input), imaginary = new Float64Array(input.length), n = fft.size;
    fft.transform(real, imaginary);
    const dc = Math.max(Math.hypot(real[0], imaginary[0]), Number.EPSILON);
    const image = new Float32Array(displaySize * displaySize), step = n / displaySize;
    for (let y = 0; y < displaySize; y++) {
      for (let x = 0; x < displaySize; x++) {
        const index = ((y * step + n / 2) % n) * n + ((x * step + n / 2) % n);
        image[y * displaySize + x] = Math.hypot(real[index], imaginary[index]) / dc;
      }
    }
    const profile = new Float32Array(n / 2 + 1), frequencyPerUm = new Float32Array(profile.length);
    for (let x = 0; x <= n / 2; x++) {
      profile[x] = Math.hypot(real[x], imaginary[x]) / dc;
      frequencyPerUm[x] = x * 1000 / (n * pixelNm);
    }
    return { image, profile, frequencyPerUm };
  }

  function maximum(values) { let result = 0; for (const value of values) result = Math.max(result, value); return result; }
  function sum(values) { let result = 0; for (const value of values) result += value; return result; }

  function fwhm(profile, pixelNm) {
    const center = profile.length / 2, half = profile[center] / 2;
    if (half <= 0) return null;
    let left = center, right = center;
    while (left > 0 && profile[left] > half) left--;
    while (right < profile.length - 1 && profile[right] > half) right++;
    if (!left || right === profile.length - 1) return null;
    const l = left + (half - profile[left]) / (profile[left + 1] - profile[left]);
    const r = right - (half - profile[right]) / (profile[right - 1] - profile[right]);
    return (r - l) * pixelNm / 1000;
  }

  function simulate(input = {}) {
    const p = parameters(input), n = 2 * p.size;
    const started = typeof performance === "object" ? performance.now() : Date.now();
    const optics = createOptics(n, p.na, p.wavelengthNm, p.pixelNm);
    const truth = makeObject(n, p.experiment), noiseless = convolve(truth, optics);
    const countScale = p.photons / maximum(noiseless), background = p.background / countScale;
    const random = randomGenerator(p.seed), observed = new Float64Array(truth.length);
    for (let i = 0; i < observed.length; i++) {
      const mean = noiseless[i] * countScale + p.background;
      observed[i] = p.noise ? poisson(mean, random) / countScale : mean / countScale;
    }
    const restored = richardsonLucy(observed, optics, p.iterations, background);
    const images = { truth: crop(truth, n, p.size), observed: crop(observed, n, p.size), restored: crop(restored, n, p.size) };
    const spectra = {}, profiles = { positionUm: new Float32Array(p.size) }, maxima = {};
    const profileY = p.experiment === "point" ? p.size / 2 : p.size / 2 - 24;
    for (let x = 0; x < p.size; x++) profiles.positionUm[x] = (x - p.size / 2) * p.pixelNm / 1000;
    const frequencyResults = {};
    for (const [key, full] of Object.entries({ truth, observed, restored })) {
      frequencyResults[key] = frequencyData(full, optics.fft, p.size, p.pixelNm);
      spectra[key] = frequencyResults[key].image;
      maxima[key] = maximum(images[key]);
      profiles[key] = images[key].slice(profileY * p.size, (profileY + 1) * p.size);
    }
    const centeredPsf = crop(optics.psf, n, p.size, true);
    const originalOtf = frequencyData(optics.psf, optics.fft, p.size, p.pixelNm);
    const cutoffPerUm = 2000 * p.na / p.wavelengthNm;
    return { params: p, experiment: p.experiment, noise: p.noise, iterations: p.iterations,
      ...images, size: p.size, gridSize: n, pixelNm: p.pixelNm,
      extentUm: p.size * p.pixelNm / 1000, cutoffPerUm,
      nyquistPerUm: 500 / p.pixelNm, spectrumSize: p.size,
      spectrumPixelPerUm: 1000 / (p.size * p.pixelNm), spectrumGridPixelPerUm: 1000 / (n * p.pixelNm),
      psf: centeredPsf, spectra, profiles, maxima, profileYUm: (profileY - p.size / 2) * p.pixelNm / 1000,
      otf: { frequencyPerUm: originalOtf.frequencyPerUm, original: originalOtf.profile,
        observed: frequencyResults.observed.profile, restored: frequencyResults.restored.profile },
      metrics: { diffractionPeriodNm: p.wavelengthNm / (2 * p.na),
        observedFwhmUm: p.experiment === "point" ? fwhm(profiles.observed, p.pixelNm) : null,
        restoredFwhmUm: p.experiment === "point" ? fwhm(profiles.restored, p.pixelNm) : null,
        truthFlux: sum(truth), observedFlux: sum(observed), restoredFlux: sum(restored),
        noise: p.noise ? "Poisson shot noise" : "No noise", peakPhotons: p.photons,
        milliseconds: (typeof performance === "object" ? performance.now() : Date.now()) - started },
      modelDescription: "Illustrative 2D scalar Hanser pupil with sine apodization, oil index 1.518, " +
        "and five-sample pixel integration; Poisson shot noise only. Mean-initialized Richardson–Lucy. " +
        `${n} × ${n} periodic FFT grid, central ${p.size} × ${p.size} image crop; spectra use the full grid. ` +
        "Image intensities share object units. Photon count sets the expected peak signal per pixel. " +
        "Three-bar target widths are 2, 3, and 4 pixels; this is not the published USAF image." };
  }

  globalThis.DeconvolutionModel = Object.freeze({ defaults: DEFAULTS, simulate,
    numerics: Object.freeze({ FFTGrid, createOptics, convolve, richardsonLucy, randomGenerator, poisson, makeObject }) });
})();
