'use strict';

importScripts('deconvolution-model.js');

self.onmessage = event => {
  const { id, params } = event.data;
  try {
    const result = DeconvolutionModel.simulate(params);
    const buffers = new Set();
    function collect(value) {
      if (ArrayBuffer.isView(value)) buffers.add(value.buffer);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    }
    collect(result);
    self.postMessage({ id, result }, [...buffers]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Calculation failed.' });
  }
};
