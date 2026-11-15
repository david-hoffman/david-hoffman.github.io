# David P. Hoffman — personal website

A buildless resume, publications, and scientific writing site. Edit the HTML directly.
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
| `site/index.html` | Resume homepage and selected work |
| `site/resume/index.html` | Complete HTML resume |
| `site/assets/resume.css` | Resume layout and print styles |
| `site/files/cv.pdf` | Current downloadable resume; preserve this public URL |
| `site/assets/site.css` | Shared visual styles |
| `site/assets/archive.css` | Article, publication, and index layouts |
| `site/assets/figures.css` | Research image frames, portrait layout, and image controls |
| `site/assets/image-viewer.js` | Progressive hero image zoom and pan |
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

## Visual conventions

Editorial headings and titles use sentence case. Keep scientific acronyms and
proper names intact, and retain formal paper titles in citation fields. Update
listings, search titles, feeds, and metadata when an editorial title changes.

Research images share the corner marks and small labels in `figures.css`. Each
label describes its image in a few words; do not repeat a generic label across
unrelated images.
Scientific plots retain their original pixels on a white background; existing
figure numbers remain tied to their captions. Portraits use CSS grayscale and
do not receive research frames.

Emoji add personality in the matching homepage/author interests and occasional
article punchlines. Keep editorial headings and resume details free of emoji,
avoid stacking redundant reactions, and preserve quotations verbatim. Article
edits must also reach the search index and relevant feeds.

Colors follow `prefers-color-scheme` automatically. Print uses the light palette.
The hero viewer supports mouse dragging, zoom buttons, and keyboard controls
(+/− to zoom, arrows to pan, 0 to reset). On touch screens, default page scrolling
is preserved at 100%; zoom in before dragging or pinching the image. Without
JavaScript, the image and research link remain available.

## Contact form

The homepage uses a native HTML POST form at `https://formspree.io/f/xaeoqzzn`,
using the form ID confirmed in David’s Formspree dashboard.
It requires a name, reply email, and message, and includes a hidden spam-trap field.
Formspree handles submission and the response page; no JavaScript library or build
step is needed. The recipient address is absent from both visible homepage text
and its HTML source. Resume updates are maintained separately from contact-form changes.

Check field validation and responsive layout locally. Sending a real message is a
separate end-to-end delivery check and requires explicit authorization.

## Migration scope

The starting point is published commit `d045391b76e9766a70b8e11341f833488c020ddf`
(April 3, 2022). Website files moved under `site/`; their public URL paths remain the
same. The migration replaces the Hugo/Academia page structure while preserving
published scientific content, assets, and downloads. Original source remains in
the separate private `portfolio-page` repository; unpublished drafts were not imported.

The migration initially retained the 2022 employment record. The November 14,
2026 resume update uses the approved general edition
`resume/editions/2026-11-14-base-v07/` from David’s separate resume repository.
Its `resume.pdf` is copied byte-for-byte to `site/files/cv.pdf` (SHA-256:
`c7518b9a3efb92242f1317d378bc2019c403cdabda281f897c1bb4db911752f3`).
The full HTML version at `/resume/`, homepage experience, and author biography
use that edition’s supplied facts and wording. The legacy `/files/cv.ps` remains
available at its existing URL as a historical download.

For future resume updates, use an approved general edition, not a tailored
application draft. Replace the PDF at its stable URL and update the HTML resume,
homepage, author profile, search data, author feed, and sitemap together. Preserve
formal citation titles and keep private source material outside `site/`.

## GitHub Actions and hosting

**Merging a pull request into `master` publishes the website.** Keep local edits
on a feature branch until publication is authorized. Do not push, merge, run a
remote deployment, or change GitHub settings as part of a local-only task.

- `.github/workflows/check.yml` validates pull requests and manual runs. It has
  read-only repository permission and does not deploy.
- `.github/workflows/pages.yml` validates the site, packages only `site/`, and
  deploys that artifact to GitHub Pages. It runs on pushes to `master`, including
  merged pull requests. Branch protection requires a pull request and the
  `Validate website` check before `master` can change, including for administrators.
  No second reviewer is required, so the repository owner can merge their own
  checked pull requests. Only squash merges are enabled, and `master` requires
  linear history. Force pushes and branch deletion are blocked.
- Manual redeploys are available through **Actions → Deploy GitHub Pages → Run
  workflow**. Select `master` and check **Publish the current master revision to
  the live website**. Other branches and unconfirmed manual runs cannot deploy.
- Validation must succeed before packaging and deployment. Only the deployment
  job receives Pages write and identity-token permissions. Deployments are
  serialized without cancelling one already in progress.

There is no build step, Jekyll processing, deployment branch, or custom secret.
The official Pages actions use the workflow’s automatically provided GitHub token.
Repository documentation and tooling stay outside the published artifact.

### Repository configuration

These GitHub settings complement the versioned workflows:

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions. The new
   website lives in `site/`, so the old branch/root publishing mode must stay off.
2. **Branch protection for `master`:** require a pull request, require the
   `Validate website` check from GitHub Actions, require the branch to be up to date,
   require linear history, apply the rules to administrators, and disallow force
   pushes and deletion.
   The required number of approving reviews is zero.
3. **Settings → General → Pull Requests:** allow squash merging; disable merge
   commits and rebase merging. These merge-method settings apply repository-wide.
4. **Environment `github-pages`:** allow deployments from protected branches only.
   The workflow further restricts deployment to `master`.

For a normal release, push a feature branch, open a pull request into `master`,
wait for `Validate website`, then squash-merge. Check **Deploy GitHub Pages** for the
deployment result and verify <https://david-hoffman.github.io/>. A merge creates
the push event used by the deployment workflow; ordinary feature-branch pushes
only update the proposed change.

This follows GitHub’s [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [publishing-source setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
Local checks validate the site and workflow syntax; GitHub permissions, environment
rules, and the deployment itself can only be verified during an authorized remote run.

Images and PDFs stay in this repository. Keep ordinary commit history for rollback;
consider history cleanup only when size becomes a practical problem.
