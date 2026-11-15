---
name: maintain-website
description: Edit David P. Hoffman's static resume website, scientific articles, publications, and navigation in this repository, then check and preview the changed pages.
---

# Maintain this website

Work directly in the HTML under `site/`. Shared presentation lives in
`site/assets/site.css` and `site/assets/archive.css`. Python scripts are development
tools, not a publishing pipeline. Read `README.md` at the repository root for the
file map and current migration status.

## Choose the smallest coherent edit

- Resume updates belong in `site/resume/index.html`, `site/files/cv.pdf`, and the
  homepage summary in `site/index.html`. Keep the author profile, search data, and
  author feed aligned; see `README.md` for the approved source edition. Retain the user's facts and voice;
  request missing factual details rather than extrapolating employment dates or achievements.
- Articles and publications use directory URLs such as `/post/otf-squishing/`.
  Preserve these paths, existing heading IDs, relative figure paths, equations,
  and download links when rewriting page structure.
- Figure numbers are explicit caption text. Preserve their correspondence with
  references in the prose; do not rely on a theme or CSS counters to supply them.
- Header/footer HTML is intentionally repeated across pages. For a shared navigation
  change, search affected pages and update them together. Do not add a runtime
  templating dependency just to avoid this small duplication.
- For new or changed article titles, summaries, URLs, or publication dates, inspect
  the relevant list pages, `index.json`, feeds (`index.xml`), and `sitemap.xml`.
  Update only affected entries. Keep draft material out of `site/`.
- Use repository images and downloads. Prefer reasonably sized display copies;
  retain originals that existing published links still use.
- Follow the sentence-case and image-frame conventions documented in `README.md`.
  Preserve acronyms, proper names, published citation titles, and original figure
  numbers. Use CSS grayscale for portraits; keep scientific image colors intact.

## Validate the result

Run `python3 scripts/check.py` from the repository root. Resolve failures introduced
by the edit. The checker does not assess factual accuracy, external link health,
JavaScript execution, or appearance.

Use `python3 scripts/preview.py` for a local preview, or reuse the running server.
Inspect the changed page at desktop and mobile widths. Check navigation and focus
behavior for interaction changes, and inspect mathematical rendering and figures
for article changes. If browser tools are unavailable, report that limit rather
than claiming visual verification.

For shared visual changes, inspect both light and dark palettes. For hero viewer
changes, check pan bounds, zoom limits, keyboard reset, resize behavior, and that
touch scrolling remains available before image zoom is engaged.

Summarize the changed content, checks, and preview URL. Keep a preview server running
when the user asks to view it. Follow the user's existing deployment authorization;
this skill grants no permission to push or publish.
