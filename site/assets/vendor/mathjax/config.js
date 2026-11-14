// Local MathJax 3.2.2. Use the packages bundled in tex-svg.js; no remote loaders.
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    packages: ['base', 'ams', 'newcommand', 'noundefined', 'configmacros']
  },
  svg: { fontCache: 'local' },
  options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] }
};
