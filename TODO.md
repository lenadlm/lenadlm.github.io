# TODO

## Tools page
- [x] `tools.html` with KRA Validator, IT-Tools, OmniTools, Postman Web, Resources
- [x] Nav + `aria-current="page"` on all pages, `sitemap.xml` including `tools.html`
- [ ] Add `robots.txt` with a `Sitemap:` line
- [x] `validator` hidden from nav; only linked from the tools page
- [ ] Add a skip-to-content link on `tools.html` (covered by the site-wide item below)
- [ ] Keep descriptions to one line; add a tool only if it is actually used

## Validator
- [x] Part shipments: containers shared by more than one TD, listed after the replacements table
- [x] Manifest totals table at the top: TDs, containers, 20 ft / 40 ft split, packages, gross weight
- [x] Optional "apply replacements" step (port of MAN.PS1) before validating, with a diff view
- [x] Download a corrected copy of a file after replacements
- [ ] Add a synthetic sample manifest button for demos
- [x] Show keyword review (TRANSHIPMENT, ZANZIBAR, CFS, CONSOLIDATION, SHIPPERS OWN) with TD bill codes
- [ ] Add "download all revised files" for multi-file batches
- [ ] Check bundled XSD against the current KRA release when a new version is issued

## Site (seen in the current repo snapshot, not changed in this pass)
- [ ] `og:url`, canonical and `og:site_name` on index/projects still point at lenadlm.github.io
- [ ] `og:image` is an SVG; export a 1200x630 PNG for social previews
- [ ] `<a href="mailto:">` in the contact row is empty; add a real address or remove it
- [ ] Font Awesome loads twice (cdnjs stylesheet and kit script); keep one
- [ ] `github-readme-streak-stats.herokuapp.com` on `index.html` is a third-party hosted badge that may no longer respond; replace or remove
- [ ] `assets/favicon/site.webmanifest` has empty `name`/`short_name`; icon paths are root-relative
- [ ] Delete duplicate `assets/images/site.webmanifest` and stray `assets/images/text.txt`
- [x] `sitemap.xml` (index, projects, validator, tools)
- [ ] Add `meta description` to index/projects and a `robots.txt`
- [ ] Add a skip-to-content link
