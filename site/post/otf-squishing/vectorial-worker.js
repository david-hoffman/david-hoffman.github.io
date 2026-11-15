/* Keep diffraction integration away from scrolling and keyboard interaction. */
"use strict";
importScripts("vectorial-model.js");
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ token: data.token, result: OTFModel.calculate(data.kind, data.params) });
  } catch (error) {
    self.postMessage({ token: data.token, error: error.message });
  }
};
