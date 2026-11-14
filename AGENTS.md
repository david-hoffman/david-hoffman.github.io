# Website maintenance

This is David P. Hoffman's static résumé and scientific writing site. Read
[the maintenance skill](skills/maintain-website/SKILL.md) when editing its content,
design, or navigation. There is no generator: HTML under `site/` is the source.

- Serve and eventually publish only `site/`. Root documentation and scripts are not website files.
- Keep the site buildless: semantic HTML, shared CSS, and small JavaScript files for actual interactions. Use local assets and existing conventions.
- Preserve published URLs, article equations, figure references, publication metadata, and downloads. Keep private source drafts private.
- Use supplied facts for résumé edits. The migration preserves the 2022 employment record; “Present” is not evidence that a role remains current. Do not invent later positions, dates, metrics, or claims.
- Preserve David’s existing wording when changing the design. Rewrite copy only when he asks for a rewrite.
- Keep David’s email address out of visible homepage text. Preserve his supplied Formspree endpoint; the current endpoint includes the address in the HTML source. Do not change the CV as part of contact-form maintenance.
- Run `python3 scripts/check.py` after edits. Preview with `python3 scripts/preview.py` and inspect affected pages on desktop and mobile for design changes.
- Use a feature branch and pull request for changes to `master`; the `Validate website` check must pass before merging. Merging publishes `site/` automatically through `pages.yml`. Manual redeploys require `master` and the deployment confirmation input. Do not push, merge, deploy, change hosting settings, or rewrite history without authorization for that task.
- Use Superpowers only when explicitly invoked by the user.
