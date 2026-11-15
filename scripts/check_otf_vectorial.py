#!/usr/bin/env python3
"""Check the live diffraction model against the published SciPy notebook.

Requires NumPy, SciPy, and Node.js in the development environment only.
Run with a Python environment containing SciPy, optionally passing --node PATH.
Neither these dependencies nor this script are needed by the website.
"""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time
import warnings

import numpy as np
import scipy.integrate
import scipy.optimize


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "site/post/otf-squishing/vectorial-model.js"
NOTEBOOK = ROOT / "site/files/Vectorial Estimation of focal shift.ipynb"


def original_functions():
    """Execute only the four original function-definition cells, without plots."""
    namespace = {name: getattr(np, name) for name in dir(np) if not name.startswith("_")}
    namespace.update({"np": np, "scipy": scipy})
    cells = json.loads(NOTEBOOK.read_text())["cells"]
    for index in (2, 3, 5, 6):
        exec("".join(cells[index]["source"]), namespace)
    original_quadrature = namespace["complex_quadrature"]

    def converged_quadrature(func, a, b, **kwargs):
        # Permit more subdivisions for the added critical-angle stress cases;
        # the notebook's integrand and optimization remain unchanged.
        return original_quadrature(func, a, b, limit=1000, epsabs=1e-10, epsrel=1e-10, **kwargs)

    namespace["complex_quadrature"] = converged_quadrature
    return namespace["i0"].pyfunc, namespace["_find_afp"]


def javascript(node):
    code = r"""
require(process.argv[1]);
const defaults = ['oil', 'glycerol', 'water', 'ice', 'comparison', 'difference'];
const started = performance.now();
const plots = defaults.map(kind => OTFModel.calculate(kind));
const samples = [];
for (const plot of plots.slice(0, 4)) {
  const model = OTFModel.createModel(plot.params);
  for (const peak of plot.peaks) {
    for (const relative of [-2, 0, 2, peak.relative]) {
      for (const wavelength of new Set([plot.params.excitation, plot.params.emission].filter(Boolean))) {
        samples.push({params:plot.params,relative,nominal:peak.nominal,wavelength,
          field:model.field(relative,peak.nominal,wavelength)});
      }
    }
  }
}
const edges = [
  {n1:1.3,n2:1.3,na:1.3,excitation:0.52,emission:null},
  {n1:1,n2:1.3,na:1,excitation:0.52,emission:0.59},
  {n1:1.518,n2:1.33,na:1.33,excitation:0.35,emission:0.9},
  {n1:1.3,n2:1.300001,na:1.3,excitation:0.52,emission:null},
  {n1:1.8,n2:1,na:0.1,excitation:0.9,emission:null},
];
for (const params of edges) {
  const model = OTFModel.createModel(params);
  for (const nominal of [-50,0,50]) {
    for (const relative of [-10,0,10]) {
      samples.push({params,relative,nominal,wavelength:params.excitation,
        field:model.field(relative,nominal)});
    }
  }
  const focus = model.findFocus(20);
  if (!Object.values(focus).every(Number.isFinite)) throw Error('Non-finite edge focus');
}
for (const n of [1,1.3,1.8]) {
  const model=OTFModel.createModel({n1:n,n2:n,na:n,excitation:0.52,emission:null});
  for (const nominal of [-50,0,50]) {
    if (model.findFocus(nominal).actual!==nominal) throw Error('Equal-index focus moved');
  }
}
for (const params of [
  {n1:1,n2:1.3,na:1.1,excitation:0.52},
  {n1:1.3,n2:1,na:1.1,excitation:0.52},
  {n1:NaN,n2:1.3,na:0.8,excitation:0.52},
  {n1:1,n2:1.3,na:0,excitation:0.52},
  {n1:1,n2:1.3,na:0.8,excitation:0},
]) {
  let rejected=false;
  try {OTFModel.createModel(params);} catch (_) {rejected=true;}
  if (!rejected) throw Error('Invalid physical parameters accepted');
}
console.log(JSON.stringify({plots,samples,milliseconds:performance.now()-started}));
"""
    return json.loads(subprocess.check_output([node, "-e", code, str(MODEL)], text=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=shutil.which("node"), help="Node.js executable")
    args = parser.parse_args()
    if not args.node:
        parser.error("Node.js is required; provide --node PATH if it is not on PATH.")
    started = time.monotonic()
    field, focus = original_functions()
    results = javascript(args.node)
    field_error = 0.0
    for sample in results["samples"]:
        p = sample["params"]
        expected = field(sample["relative"], sample["nominal"], p["n1"], p["n2"], p["na"], sample["wavelength"])
        actual = complex(sample["field"]["real"], sample["field"]["imaginary"])
        error = abs(actual - expected)
        field_error = max(field_error, error)
        assert error < 2e-7, ("Complex field differs from SciPy", sample, expected, error)

    focus_error = intensity_error = 0.0
    count = 0
    for plot in results["plots"]:
        if plot["kind"] == "difference":
            continue  # Its data comes from the same comparison calculation.
        p = plot["params"]
        for peak in plot["peaks"]:
            if plot["kind"] == "oil":
                excitation = p["emission"] if peak["id"] == "emission" else p["excitation"]
                emission = p["emission"] if peak["id"] == "confocal" else None
            else:
                excitation, emission = p["excitation"], p["emission"]
            options = {"res": 256, "width": 15} if plot["kind"] == "water" else {"res": 128, "width": 5}
            if plot["kind"] == "glycerol":
                options["width"] = 2
            actual, intensity = focus(peak["nominal"], p["n1"], p["n2"], p["na"], excitation, emission, **options)
            position_error = abs(actual - peak["actual"])
            relative_intensity_error = abs(intensity - peak["intensity"]) / intensity
            focus_error = max(focus_error, position_error)
            intensity_error = max(intensity_error, relative_intensity_error)
            assert position_error < 2e-6, (plot["kind"], peak, actual, position_error)
            assert relative_intensity_error < 2e-7, (plot["kind"], peak, intensity)
            count += 1

    comparison, difference = results["plots"][-2:]
    assert comparison["series"] == difference["series"]
    assert len(comparison["differences"]["percent"]["x"]) == 49
    for index, delta in enumerate(comparison["differences"]["absolute"]["y"]):
        expected = comparison["series"][0]["y"][index] - comparison["series"][1]["y"][index]
        assert abs(delta - expected) < 1e-12
    assert abs(comparison["slopeRatio"] - 0.9852) < 0.0001
    print(f"PASS: {len(results['samples'])} complex fields and {count} focal maxima match the original SciPy notebook.")
    print(f"Maximum field error: {field_error:.3g}; focal-position error: {focus_error:.3g} µm; relative peak-intensity error: {intensity_error:.3g}.")
    print(f"Equal-index/grazing/low-NA cases, input bounds, and difference data passed. JavaScript suite: {results['milliseconds']:.0f} ms; full check: {time.monotonic()-started:.1f} s.")


if __name__ == "__main__":
    # Fail rather than silently accepting unconverged reference quadrature.
    warnings.simplefilter("error", scipy.integrate.IntegrationWarning)
    main()
