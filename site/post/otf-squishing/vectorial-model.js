/* On-axis vectorial diffraction from the article's accompanying Python notebook.
 * Distances and vacuum wavelengths are in micrometres. No browser APIs required.
 */
(() => {
  "use strict";

  const TAU = 2 * Math.PI;
  const LIMITS = Object.freeze({
    n1: [1, 1.8], n2: [1, 1.8], na: [0.1, 1.8],
    excitation: [0.35, 0.9], emission: [0.35, 0.9],
    nominal: [-50, 50], depthScale: [0.1, 2], maxDepth: [1, 20],
  });
  const DEFAULTS = Object.freeze({
    // Keep the positional arguments in the published code, including its NA.
    oil: { n1: 1.518, n2: 1.47, na: 1.33, excitation: 0.514, emission: 0.59, nominal: -15 },
    glycerol: { n1: 1.518, n2: 1.473, na: 1.3, excitation: 0.514, emission: 0.59, depthScale: 1 },
    water: { n1: 1.33, n2: 1.473, na: 1.3, excitation: 0.514, emission: 0.59, depthScale: 1 },
    ice: { n1: 1, n2: 1.3, na: 0.85, excitation: 0.52, emission: null, depthScale: 1 },
    comparison: { n1: 1, n2: 1.3, na: 0.85, excitation: 0.52, emission: null, maxDepth: 8 },
    difference: { n1: 1, n2: 1.3, na: 0.85, excitation: 0.52, emission: null, maxDepth: 8 },
  });
  Object.values(DEFAULTS).forEach(Object.freeze);

  function defaults(kind) {
    if (!DEFAULTS[kind]) throw new RangeError("Unknown vectorial plot.");
    return { ...DEFAULTS[kind] };
  }

  function validate(params) {
    for (const key of ["n1", "n2", "na", "excitation"]) {
      if (!Number.isFinite(params[key])) throw new RangeError(`${key} must be a finite number.`);
    }
    for (const [key, range] of Object.entries(LIMITS)) {
      const value = params[key];
      if (value == null && key === "emission") continue;
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
        throw new RangeError(`${key} must be between ${range[0]} and ${range[1]}.`);
      }
    }
    if (params.na > Math.min(params.n1, params.n2)) {
      throw new RangeError("NA must not exceed either refractive index in this propagating-ray model.");
    }
    return params;
  }

  // Rationalized form of (n1 − sqrt(n1² − NA²))/(n2 − sqrt(n2² − NA²)).
  function otfRatio(n1, n2, na) {
    return (n2 + Math.sqrt(Math.max(0, n2 * n2 - na * na))) /
      (n1 + Math.sqrt(Math.max(0, n1 * n1 - na * na)));
  }

  const rules = new Map();
  function gaussLegendre(count) {
    if (rules.has(count)) return rules.get(count);
    const nodes = new Float64Array(count);
    const weights = new Float64Array(count);
    for (let i = 0; i < Math.ceil(count / 2); i += 1) {
      let root = Math.cos(Math.PI * (i + 0.75) / (count + 0.5));
      let derivative;
      for (let iteration = 0; iteration < 20; iteration += 1) {
        let previous = 0;
        let polynomial = 1;
        for (let degree = 1; degree <= count; degree += 1) {
          const next = ((2 * degree - 1) * root * polynomial - (degree - 1) * previous) / degree;
          previous = polynomial;
          polynomial = next;
        }
        derivative = count * (root * polynomial - previous) / (root * root - 1);
        const correction = polynomial / derivative;
        root -= correction;
        if (Math.abs(correction) < 2e-15) break;
      }
      const weight = 2 / ((1 - root * root) * derivative * derivative);
      nodes[i] = -root;
      nodes[count - 1 - i] = root;
      weights[i] = weight;
      weights[count - 1 - i] = weight;
    }
    const rule = { nodes, weights };
    rules.set(count, rule);
    return rule;
  }

  function createModel(input) {
    const params = { ...validate(input) };
    const { n1, n2, na, excitation, emission } = params;
    const cos1Edge = Math.sqrt(Math.max(0, 1 - (na / n1) ** 2));
    const cos2Edge = Math.sqrt(Math.max(0, 1 - (na / n2) ** 2));
    const geometricalRatio = otfRatio(n1, n2, na);
    const axialWidth = Math.min(excitation, emission || excitation) /
      (na * na / (n2 * (1 + cos2Edge)));
    const grids = new Map();

    function grid(count) {
      if (grids.has(count)) return grids.get(count);
      const { nodes, weights } = gaussLegendre(count);
      // q = sqrt(cos(theta)) in the lower-index medium. The Jacobian
      // removes the endpoint square root at grazing incidence.
      const lower = Math.pow(Math.max(0, 1 - (na / Math.min(n1, n2)) ** 2), 0.25);
      const half = (1 - lower) / 2;
      const center = (1 + lower) / 2;
      const c1 = new Float64Array(count);
      const c2 = new Float64Array(count);
      const amplitude = new Float64Array(count);
      for (let i = 0; i < count; i += 1) {
        const q = center + half * nodes[i];
        let jacobian;
        if (n1 <= n2) {
          c1[i] = q * q;
          c2[i] = Math.sqrt(Math.max(0, 1 - (n1 / n2) ** 2 * (1 - q ** 4)));
          jacobian = 2 * q * q;
        } else {
          c2[i] = q * q;
          c1[i] = Math.sqrt(Math.max(0, 1 - (n2 / n1) ** 2 * (1 - q ** 4)));
          jacobian = 2 * (n2 / n1) ** 2 * q ** 3 / Math.sqrt(c1[i]);
        }
        // Algebraically identical to the notebook's sine formulas, without
        // the removable 0/0 at theta=0 or at equal refractive indices.
        const ts = 2 * n1 * c1[i] / (n1 * c1[i] + n2 * c2[i]);
        const tp = 2 * n1 * c1[i] / (n2 * c1[i] + n1 * c2[i]);
        amplitude[i] = weights[i] * half * jacobian * (ts + tp * c2[i]);
      }
      const result = { c1, c2, amplitude };
      grids.set(count, result);
      return result;
    }

    function quadratureCount(relative, nominal, wavelength) {
      const actual = nominal + relative;
      const values = [actual * n2 - nominal * n1,
        actual * n2 * cos2Edge - nominal * n1 * cos1Edge];
      // The phase has at most one internal stationary point. Include it in
      // the variation estimate so cancellation of endpoint phases is safe.
      if (nominal !== 0 && actual / nominal > 0 && n1 !== n2) {
        const ratio = n1 / n2;
        const slope = actual * n1 / (nominal * n2);
        const cos1Squared = (1 - ratio * ratio) / (slope * slope - ratio * ratio);
        if (cos1Squared > cos1Edge ** 2 && cos1Squared < 1) {
          values.push(-nominal * n1 * Math.sqrt(cos1Squared) + actual * n2 *
            Math.sqrt(Math.max(0, 1 - ratio * ratio * (1 - cos1Squared))));
        }
      }
      const phaseSpan = TAU / wavelength * (Math.max(...values) - Math.min(...values));
      let count = 64;
      while (count < 48 + phaseSpan && count < 2048) count *= 2;
      return count;
    }

    function field(relative, nominal, wavelength = excitation) {
      if (![relative, nominal, wavelength].every(Number.isFinite) || wavelength <= 0) {
        throw new RangeError("Field coordinates and wavelength must be finite; wavelength must be positive.");
      }
      const { c1, c2, amplitude } = grid(quadratureCount(relative, nominal, wavelength));
      const k = TAU / wavelength;
      let real = 0;
      let imaginary = 0;
      for (let i = 0; i < amplitude.length; i += 1) {
        const phase = k * (-nominal * n1 * c1[i] + (nominal + relative) * n2 * c2[i]);
        real += amplitude[i] * Math.cos(phase);
        imaginary += amplitude[i] * Math.sin(phase);
      }
      return { real, imaginary };
    }

    function intensity(relative, nominal, mode = emission ? "confocal" : "excitation") {
      const wavelength = mode === "emission" ? emission : excitation;
      if (!wavelength) throw new RangeError("An emission wavelength is required.");
      const a = field(relative, nominal, wavelength);
      const first = a.real * a.real + a.imaginary * a.imaginary;
      if (mode !== "confocal") return first;
      if (!emission) throw new RangeError("An emission wavelength is required for confocal intensity.");
      const b = field(relative, nominal, emission);
      return first * (b.real * b.real + b.imaginary * b.imaginary);
    }

    function refineMaximum(nominal, mode, left, right) {
      const fraction = (Math.sqrt(5) - 1) / 2;
      let a = right - fraction * (right - left);
      let b = left + fraction * (right - left);
      let ya = intensity(a, nominal, mode);
      let yb = intensity(b, nominal, mode);
      for (let iteration = 0; iteration < 60 && right - left > 1e-8; iteration += 1) {
        if (ya > yb) {
          right = b;
          b = a;
          yb = ya;
          a = right - fraction * (right - left);
          ya = intensity(a, nominal, mode);
        } else {
          left = a;
          a = b;
          ya = yb;
          b = left + fraction * (right - left);
          yb = intensity(b, nominal, mode);
        }
      }
      return ya > yb ? { relative: a, intensity: ya } : { relative: b, intensity: yb };
    }

    function findFocus(nominal, mode = emission ? "confocal" : "excitation") {
      if (!Number.isFinite(nominal) || Math.abs(nominal) > 100) {
        throw new RangeError("Nominal focal position must be within ±100 µm.");
      }
      if (nominal === 0 || n1 === n2) {
        return { nominal, actual: nominal, relative: 0, intensity: intensity(0, nominal, mode) };
      }
      const paraxial = nominal * (n2 / n1 - 1);
      const geometric = nominal * (geometricalRatio - 1);
      const padding = 4 * axialWidth + Math.abs(geometric - paraxial);
      let left = Math.min(paraxial, geometric) - padding;
      let right = Math.max(paraxial, geometric) + padding;
      let best;
      // Resolve the whole interval, refine every local peak, and expand if a
      // boundary is still appreciable. This avoids the notebook's dependence
      // on a single low-resolution sample and adjacent array indices.
      for (let pass = 0; pass < 4; pass += 1) {
        const count = Math.max(96, Math.ceil((right - left) / (axialWidth / 10)));
        const step = (right - left) / count;
        const samples = new Float64Array(count + 1);
        let maximumIndex = 0;
        for (let i = 0; i <= count; i += 1) {
          samples[i] = intensity(left + i * step, nominal, mode);
          if (samples[i] > samples[maximumIndex]) maximumIndex = i;
        }
        best = { relative: left + maximumIndex * step, intensity: samples[maximumIndex] };
        for (let i = 1; i < count; i += 1) {
          if (samples[i] >= samples[i - 1] && samples[i] >= samples[i + 1] &&
              samples[i] >= best.intensity * 0.8) {
            const peak = refineMaximum(nominal, mode, left + (i - 1) * step, left + (i + 1) * step);
            if (peak.intensity > best.intensity) best = peak;
          }
        }
        const expandLeft = maximumIndex < 2 || samples[0] > best.intensity * 0.05;
        const expandRight = maximumIndex > count - 2 || samples[count] > best.intensity * 0.05;
        if (!expandLeft && !expandRight) break;
        const width = right - left;
        if (expandLeft) left -= width / 2;
        if (expandRight) right += width / 2;
      }
      return { nominal, actual: nominal + best.relative, ...best };
    }

    return { params, field, intensity, findFocus, geometricalRatio, axialWidth };
  }

  function linspace(start, stop, count) {
    return Array.from({ length: count }, (_, index) => start + (stop - start) * index / (count - 1));
  }

  function calculate(kind, input = {}) {
    const params = validate({ ...defaults(kind), ...input });
    if ((kind === "glycerol" || kind === "water") && params.depthScale > 1) {
      throw new RangeError("This depth series is limited to 50 µm (depth scale at most 1).");
    }
    const model = createModel(params);
    const { geometricalRatio } = model;
    const result = { kind, params, geometricalRatio, series: [], peaks: [] };

    if (kind === "oil") {
      const modes = ["excitation", "emission", "confocal"];
      const labels = ["Excitation PSF", "Emission PSF", "Confocal PSF"];
      result.peaks = modes.map((mode, index) => ({ id: mode, label: labels[index], ...model.findFocus(params.nominal, mode) }));
      const positions = result.peaks.map(peak => peak.relative);
      result.xDomain = [Math.min(-2, ...positions.map(x => x - model.axialWidth)),
        Math.max(2, ...positions.map(x => x + model.axialWidth))];
      const x = linspace(...result.xDomain, 401);
      result.series = modes.map((mode, index) => ({
        id: mode, label: labels[index], x, y: x.map(z => model.intensity(z, params.nominal, mode)),
      }));
      return result;
    }

    if (kind === "comparison" || kind === "difference") {
      const x = linspace(0, params.maxDepth, 50);
      result.peaks = x.map(nominal => model.findFocus(nominal));
      const y = result.peaks.map(peak => peak.actual);
      const geometric = x.map(nominal => nominal * geometricalRatio);
      result.series = [
        { id: "vectorial", label: "Vectorial", x, y },
        { id: "geometrical", label: "Geometrical", x, y: geometric },
      ];
      result.differences = {
        absolute: { id: "absolute", label: "Vectorial − geometrical", x, y: y.map((actual, i) => actual - geometric[i]) },
        percent: { id: "percent", label: "Difference / vectorial (%)", x: x.slice(1),
          y: y.slice(1).map((actual, i) => 100 * (actual - geometric[i + 1]) / actual) },
      };
      result.slopeRatio = y.slice(1).reduce((sum, actual, i) => sum + actual / x[i + 1], 0) /
        (x.length - 1) / geometricalRatio;
      result.xDomain = [0, params.maxDepth];
      return result;
    }

    const nominalPositions = kind === "ice" ? [-8, -4, 0, 4, 8] : [0, 5, 10, 15, 20, 25, 30, 50];
    const width = kind === "glycerol" ? 2 : kind === "water" ? 15 : 5;
    result.series = nominalPositions.map((position, index) => {
      const nominal = position * params.depthScale;
      const center = nominal * (geometricalRatio - 1);
      const peak = model.findFocus(nominal);
      const halfWidth = Math.max(width, 2 * model.axialWidth, Math.abs(peak.relative - center) + model.axialWidth);
      const x = linspace(center - halfWidth, center + halfWidth, 321);
      const id = `depth-${index}`;
      const label = `${Number(nominal.toFixed(3))} µm`;
      result.peaks.push({ id, label, ...peak });
      return { id, label, x, y: x.map(z => model.intensity(z, nominal)) };
    });
    result.xDomain = [Math.min(...result.series.map(series => series.x[0])),
      Math.max(...result.series.map(series => series.x[series.x.length - 1]))];
    // The water notebook deliberately clips its plotted curves to this window.
    // Expand only if a changed parameter moves a principal peak outside it.
    if (kind === "water") result.xDomain = [
      Math.min(-5, ...result.peaks.map(peak => peak.relative - model.axialWidth)),
      Math.max(15, ...result.peaks.map(peak => peak.relative + model.axialWidth)),
    ];
    return result;
  }

  globalThis.OTFModel = Object.freeze({ DEFAULTS, LIMITS, defaults, validate, otfRatio, createModel, calculate });
})();
