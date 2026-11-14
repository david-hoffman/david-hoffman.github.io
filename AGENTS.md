# Website maintenance

This is David P. Hoffman's static résumé and scientific writing site. Read
[the maintenance skill](skills/maintain-website/SKILL.md) when editing its content,
design, or navigation. There is no generator: HTML under `site/` is the source.

- Serve and eventually publish only `site/`. Root documentation and scripts are not website files.
- Keep the site buildless: semantic HTML, shared CSS, and small JavaScript files for actual interactions. Use local assets and existing conventions.
- Preserve published URLs, article equations, figure references, publication metadata, and downloads. Keep private source drafts private.
- Use supplied facts for résumé edits. The migration preserves the 2022 employment record; “Present” is not evidence that a role remains current. Do not invent later positions, dates, metrics, or claims.
- Preserve David’s existing wording when changing the design. Rewrite copy only when he asks for a rewrite.
- Run `python3 scripts/check.py` after edits. Preview with `python3 scripts/preview.py` and inspect affected pages on desktop and mobile for design changes.
- This migration is local-only. Do not push, deploy, change hosting settings, or rewrite history without a later user instruction authorizing that action. The checked-in Actions workflow validates only.
- Use Superpowers only when explicitly invoked by the user.
