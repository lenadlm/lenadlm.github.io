# TODO

## Validator
- [ ] Optional "apply replacements" step (port of MAN.PS1) before validating, with a diff view
- [ ] Download a corrected copy of a file after replacements
- [ ] Add a synthetic sample manifest button for demos
- [ ] Check bundled XSD against the current KRA release when a new version is issued

## Site (seen in the current repo snapshot, not changed in this pass)
- [ ] `og:url`, canonical and `og:site_name` on index/projects still point at lenadlm.github.io
- [ ] `og:image` is an SVG; export a 1200x630 PNG for social previews
- [ ] `<a href="mailto:">` in the contact row is empty; add a real address or remove it
- [ ] Font Awesome loads twice (cdnjs stylesheet and kit script); keep one
- [ ] `github-readme-streak-stats.herokuapp.com` and `hits.seeyoufarm.com` are third-party hosted badges that may no longer respond; replace or remove
- [ ] `assets/favicon/site.webmanifest` has empty `name`/`short_name`; icon paths are root-relative
- [ ] Delete duplicate `assets/images/site.webmanifest` and stray `assets/images/text.txt`
- [ ] Add `meta description`, `robots.txt` and `sitemap.xml` (include `validator.html`)
- [ ] Add a skip-to-content link
