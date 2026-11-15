#!/usr/bin/env python3
"""Verify the browser deconvolution engine against independent NumPy calculations.

Requires NumPy and Node.js in development only. No dependencies are used by the
website. This checks the stated reduced-grid model, not the published figure
pixels or the original sCMOS simulation. Pixel integration is compared with the
original Hanser model's literal 5× oversample, two-pixel roll, and 5×5 binning.
"""

import argparse
import json
from pathlib import Path
import shutil
import subprocess

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "site/post/dont-deconvolve-your-psf/deconvolution-model.js"


def javascript(node):
    code = r"""
require(process.argv[1]);
const assert = require('node:assert/strict');
const {FFTGrid,createOptics,convolve,richardsonLucy,randomGenerator,poisson} = DeconvolutionModel.numerics;
const maximum = values => Math.max(...values);
const sum = values => values.reduce((a,b)=>a+b,0);
const difference = (a,b) => maximum(Array.from(a,(x,i)=>Math.abs(x-b[i])));
let fftError=0, convolutionError=0;
for(const n of [2,8,32]) {
  const random=randomGenerator(n), grid=new FFTGrid(n);
  const re=Float64Array.from({length:n*n},()=>random()-.5);
  const im=Float64Array.from({length:n*n},()=>random()-.5);
  const originalRe=re.slice(), originalIm=im.slice();
  grid.transform(re,im); grid.transform(re,im,true);
  fftError=Math.max(fftError,difference(re,originalRe),difference(im,originalIm));
}
assert(fftError<1e-12,'FFT roundtrip');
{
  const n=8, grid=new FFTGrid(n), random=randomGenerator(18);
  const input=Float64Array.from({length:n*n},()=>random());
  const kernel=Float64Array.from({length:n*n},()=>random());
  const flux=sum(kernel); for(let i=0;i<kernel.length;i++) kernel[i]/=flux;
  const re=kernel.slice(), im=new Float64Array(n*n); grid.transform(re,im);
  const optics={fft:grid,real:re,imaginary:im};
  const actual=convolve(input,optics), expected=new Float64Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++)
    for(let ky=0;ky<n;ky++) for(let kx=0;kx<n;kx++)
      expected[y*n+x]+=kernel[ky*n+kx]*input[((y-ky+n)%n)*n+(x-kx+n)%n];
  convolutionError=difference(actual,expected);
  assert(convolutionError<1e-12,'FFT versus direct circular convolution');
  assert(Math.abs(sum(actual)-sum(input))<1e-12,'Convolution conserves flux');
  const other=Float64Array.from({length:n*n},()=>random());
  const adjoint=convolve(other,optics,true);
  const dot1=sum(actual.map((v,i)=>v*other[i])),dot2=sum(input.map((v,i)=>v*adjoint[i]));
  assert(Math.abs(dot1-dot2)<1e-12,'Convolution adjoint identity');
  const identity={fft:grid,real:new Float64Array(n*n).fill(1),imaginary:new Float64Array(n*n)};
  for(const iterations of [1,10]) assert(difference(richardsonLucy(input,identity,iterations),input)<1e-12,'RL identity PSF');
  const constant=new Float64Array(n*n).fill(5);
  assert(difference(richardsonLucy(constant,optics,10,2),new Float64Array(n*n).fill(3))<1e-12,'Known background fixed point');
  let previous=Infinity;
  for(const iterations of [0,1,3,10]) {
    const estimate=richardsonLucy(input,optics,iterations);
    assert(estimate.every(x=>Number.isFinite(x)&&x>=0),'RL positivity and finite values');
    assert(Math.abs(sum(estimate)-sum(input))<1e-10,'RL conserves signal flux');
    const predicted=convolve(estimate,optics);
    const objective=sum(predicted.map((v,i)=>v-input[i]*Math.log(Math.max(1e-15,v))));
    assert(objective<=previous+1e-10,'Poisson negative log likelihood decreases'); previous=objective;
  }
}
const poissonStatistics=[];
for(const mean of [.01,.5,5,29,30,100,1000]) {
  const random=randomGenerator(373), repeat=randomGenerator(373), count=100000;
  let s=0,ss=0;
  for(let i=0;i<count;i++) {
    const value=poisson(mean,random);
    assert(Number.isInteger(value)&&value>=0,'Poisson nonnegative integer');
    assert.equal(value,poisson(mean,repeat),'Seed reproducibility');
    s+=value;ss+=value*value;
  }
  const measuredMean=s/count,variance=ss/count-measuredMean**2;
  assert(Math.abs(measuredMean-mean)<6*Math.sqrt(mean/count),'Poisson mean');
  assert(Math.abs(variance-mean)<6*Math.sqrt((mean+2*mean*mean)/count),'Poisson variance');
  poissonStatistics.push({mean,measuredMean,variance});
}
const fixtures=[];
for(const [n,na,wavelengthNm,pixelNm] of [[32,1.46,525,40],[64,.5,750,40],[64,1.49,400,40]]) {
  const optics=createOptics(n,na,wavelengthNm,pixelNm);
  const random=randomGenerator(9), observed=Float64Array.from({length:n*n},()=>random());
  fixtures.push({n,na,wavelengthNm,pixelNm,psf:Array.from(optics.psf),observed:Array.from(observed),
    restored:Array.from(richardsonLucy(observed,optics,10))});
}
const timings=[];
for(const experiment of ['point','target']) for(const iterations of [10,40]) {
  const result=DeconvolutionModel.simulate({experiment,iterations,noise:false});
  assert(result.truth.length===128**2&&result.spectra.truth.length===128**2,'Display shapes');
  assert(result.restored.every(x=>Number.isFinite(x)&&x>=0),'Simulation positivity');
  assert(Math.abs(result.metrics.truthFlux-result.metrics.observedFlux)<1e-8,'Noiseless forward flux');
  let outside=0;
  for(let y=0;y<result.size;y++) for(let x=0;x<result.size;x++) {
    const frequency=Math.hypot(x-result.size/2,y-result.size/2)*result.spectrumPixelPerUm;
    if(frequency>result.cutoffPerUm+1e-10) outside=Math.max(outside,result.spectra.observed[y*result.size+x]);
  }
  assert(outside<1e-12,'Noiseless observed spectrum ends at diffraction cutoff');
  timings.push({experiment,iterations,milliseconds:result.metrics.milliseconds,maximumOutsideCutoff:outside});
}
for(const noise of [false,true]) {
  const input={experiment:'target',noise,photons:10,iterations:4,background:5,seed:10};
  const a=DeconvolutionModel.simulate(input),b=DeconvolutionModel.simulate(input);
  assert.equal(difference(a.observed,b.observed),0,'Repeat simulation');
  assert.equal(difference(a.restored,b.restored),0,'Repeat reconstruction');
  assert(a.restored.every(x=>Number.isFinite(x)&&x>=0),'Background simulation');
}
for(const input of [{na:NaN},{na:0},{wavelengthNm:0},{pixelNm:100,na:1.49,wavelengthNm:400},
    {iterations:-1},{iterations:1.5},{noise:'yes'},{photons:0},{background:-1},{size:100}]) {
  assert.throws(()=>DeconvolutionModel.simulate(input),'Invalid input rejected');
}
console.log(JSON.stringify({fixtures,fftError,convolutionError,poissonStatistics,timings}));
"""
    return json.loads(subprocess.check_output([node, "-e", code, str(MODEL)], text=True))


def literal_hanser_pixel_integration(fixture):
    """Scalar z=0, sine condition, n=1.518; literal original fivefold binning."""
    n, na, wavelength, pixel = (fixture[key] for key in ("n", "na", "wavelengthNm", "pixelNm"))
    fine_size = n * 5
    frequency = np.fft.fftfreq(fine_size, d=pixel / 5)
    radial_squared = frequency[:, None] ** 2 + frequency[None, :] ** 2
    mask = radial_squared <= (na / wavelength) ** 2
    pupil = np.zeros_like(radial_squared)
    pupil[mask] = (1 - radial_squared[mask] * (wavelength / 1.518) ** 2) ** -0.25
    psf = np.fft.fftshift(abs(np.fft.ifft2(pupil)) ** 2)
    psf = np.roll(psf, (2, 2), axis=(0, 1))
    psf = psf.reshape(n, 5, n, 5).mean(axis=(1, 3))
    psf /= psf.sum()
    return np.fft.ifftshift(psf)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=shutil.which("node"), help="Node.js executable")
    args = parser.parse_args()
    if not args.node:
        parser.error("Node.js is required; provide --node PATH.")
    result = javascript(args.node)
    psf_error = rl_error = 0
    for fixture in result["fixtures"]:
        n = fixture["n"]
        expected = literal_hanser_pixel_integration(fixture)
        actual = np.array(fixture["psf"]).reshape(n, n)
        error = abs(expected - actual).max()
        psf_error = max(psf_error, error)
        assert error < 2e-14, ("Fivefold pixel integration", fixture["na"], error)
        assert np.min(actual) >= 0 and abs(np.sum(actual) - 1) < 1e-12
        observed = np.array(fixture["observed"]).reshape(n, n)
        otf = np.fft.fft2(expected)
        estimate = np.full_like(observed, observed.mean())
        for _ in range(10):
            predicted = np.maximum(0, np.fft.ifft2(np.fft.fft2(estimate) * otf).real)
            ratio = observed / np.maximum(np.finfo(float).eps, predicted)
            correction = np.maximum(0, np.fft.ifft2(np.fft.fft2(ratio) * np.conj(otf)).real)
            estimate *= correction
        error = abs(estimate - np.array(fixture["restored"]).reshape(n, n)).max()
        rl_error = max(rl_error, error)
        assert error < 1e-11, ("Richardson–Lucy versus NumPy", error)
    print(f"PASS: FFT roundtrip error {result['fftError']:.3g}; direct convolution error {result['convolutionError']:.3g}.")
    print(f"PASS: Literal 5× Hanser pixel integration error {psf_error:.3g}; 10-step NumPy RL error {rl_error:.3g}.")
    print("PASS: Diffraction cutoff, adjoint, flux, positivity, RL identities/likelihood, known background, input bounds.")
    print("PASS: Seed reproducibility and Poisson mean/variance at seven count levels (100,000 samples each).")
    for item in result["timings"]:
        print(f"{item['experiment']}: {item['iterations']} iterations, {item['milliseconds']:.0f} ms; "
              f"maximum normalized signal outside cutoff {item['maximumOutsideCutoff']:.3g}.")


if __name__ == "__main__":
    main()
