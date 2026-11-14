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
  checked pull requests. Force pushes and branch deletion are blocked.
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
   apply the rules to administrators, and disallow force pushes and deletion.
   The required number of approving reviews is zero.
3. **Environment `github-pages`:** allow deployments from protected branches only.
   The workflow further restricts deployment to `master`.

For a normal release, push a feature branch, open a pull request into `master`,
wait for `Validate website`, then merge. Check **Deploy GitHub Pages** for the
deployment result and verify <https://david-hoffman.github.io/>. A merge creates
the push event used by the deployment workflow; ordinary feature-branch pushes
only update the proposed change.

This follows GitHub’s [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [publishing-source setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
Local checks validate the site and workflow syntax; GitHub permissions, environment
rules, and the deployment itself can only be verified during an authorized remote run.

Images and PDFs stay in this repository. Keep ordinary commit history for rollback;
consider history cleanup only when size becomes a practical problem.
