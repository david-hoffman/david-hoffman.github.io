# David P. Hoffman — personal website

A buildless résumé, publications, and scientific writing site. Edit the HTML directly.
The complete public website lives in `site/`; there is no Hugo theme, application
framework, dependency installation, or generated build directory to maintain.

## Preview locally

Python 3.9 or newer is the only local tooling requirement. From the repository root:

```sh
python3 scripts/preview.py
```

Open <http://127.0.0.1:8000/>. The server binds to your computer's loopback address,
serves only `site/`, and disables caching so refreshing shows edits. Stop it with
Ctrl+C. If port 8000 is occupied, use `python3 scripts/preview.py --port 8001`.

## Edit and check

| Location | Purpose |
| --- | --- |
| `site/index.html` | Résumé homepage and selected work |
| `site/assets/site.css` | Shared visual styles |
| `site/assets/archive.css` | Article, publication, and index layouts |
| `site/post/` | Scientific writing and its original figures |
| `site/publication/` | Publications and abstracts |
| `site/tags/`, `site/categories/`, `site/authors/`, `site/publication_types/` | Existing browsing routes |
| `site/img/`, `site/files/` | Local images and downloadable files |
| `site/index.json`, `site/index.xml`, `site/sitemap.xml` | Search, feed, and sitemap data |
| `AGENTS.md`, `skills/maintain-website/SKILL.md` | Instructions for future agent-assisted edits |

Run the checks before considering an edit complete:

```sh
python3 scripts/check.py
```

The checker validates page titles, language declarations, main landmarks, duplicate
IDs, local links and fragments, HTML/CSS asset paths, search/feed/sitemap routes,
and JSON/XML syntax. It does
not fetch external URLs or execute JavaScript. Inspect changed pages in a browser,
including a narrow mobile viewport. For scientific articles, inspect equations and
figures as well as the text.

The [repository maintenance skill](skills/maintain-website/SKILL.md) gives agents
the site-specific editing workflow. It is versioned here and linked from
`AGENTS.md`; no global skill installation is needed.

## Migration scope

The starting point is published commit `d045391b76e9766a70b8e11341f833488c020ddf`
(April 3, 2022). Website files moved under `site/`; their public URL paths remain the
same. The migration replaces the Hugo/Academia page structure while preserving
published scientific content, assets, and downloads. Original source remains in
the separate private `portfolio-page` repository; unpublished drafts were not imported.

Employment dates and claims come from the published site. In particular, the
“April 2022–Present” role was not independently updated or verified during the
migration. Review those facts with David before a future publication.

## GitHub Actions and hosting

**Nothing in this branch deploys the website.** The Actions workflow runs the local
checker for pull requests or manual invocations. It has read-only repository
permission and contains no upload or deployment step.

When publication is explicitly requested, GitHub Pages can publish `site/` through
an artifact-based Actions workflow. Upload only `site/`, use the official Pages
actions, and configure the Pages publishing source to GitHub Actions. The site
itself needs no build step. Do not switch the current live site's settings as part
of local preview work.

Images and PDFs stay in this repository. Keep ordinary commit history for rollback;
consider history cleanup only when size becomes a practical problem.
