MathJax 3.2.2 — local SVG equation renderer for the scientific article archive.

Distribution: https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js
Project: https://github.com/mathjax/MathJax/tree/3.2.2
License: Apache License 2.0 (see LICENSE in this directory).

config.js is site-owned configuration. tex-svg.js is the unmodified upstream
bundle. The configured packages are included in the bundle; font paths render
as SVG, so equations do not require a remote font service.

The context menu retains source viewing/copying, zoom, scale, and the bundled
assistive MathML. CHTML, the expression explorer, and equation collapsing are
disabled because their components are not included locally. The site-owned
MenuClass also repairs saved preferences for those unavailable components before
MathJax applies them; other reader preferences are preserved.

The startup.ready and MenuClass hooks are documented for this pinned version:
https://docs.mathjax.org/en/v3.2/options/startup/startup.html
https://docs.mathjax.org/en/v3.2/options/menu.html

When upgrading MathJax, verify both a fresh browser and one with saved CHTML or
explorer settings. Equations must render as SVG after reloading, unavailable menu
items must remain disabled, and no additional component requests should occur.
