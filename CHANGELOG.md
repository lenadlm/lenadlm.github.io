# Changelog

## 2026-11-13

### Added
- `tools.html`: tools directory page with one panel per tool — KRA Validator (internal), IT-Tools, OmniTools, Postman Web and the resources list. Reuses `.panel`, `.project-feature`, `.section-head`, `.prompt-line` and `.reveal`; external links open with `target="_blank" rel="noopener"`.
- `sitemap.xml`: index, projects, validator and tools URLs on `https://www.lenadlm.dev`.
- Nav link to `tools` on index, projects and tools; the current page is marked with `aria-current="page"`.

### Changed
- `assets/css/styles.css`: `.tool-body` / `.tool-desc` / `.tool-link` styles, nav current-page underline, global `:focus-visible` outline, and a 420px breakpoint so the four nav links and pill buttons fit narrow screens.

## 2026-11-03

### Added
- `validator.html`: KRA XML validator page. Validates one or many files against `SA01-LoadSeaSD.xsd` entirely in the browser (no upload). Reports line number, element path, TD bill code and the problem per error; CSV export.
- `assets/js/kra-validator.js`: schema-driven validator that reads the XSD at runtime (sequences, occurrence limits, patterns, length, decimal digits, date/dateTime, attributes, stray text).
- `assets/js/validator-ui.js`, `assets/css/validator.css`: page behaviour and styling.
- `assets/xsd/SA01-LoadSeaSD.xsd`: schema served with the site. Replace this file to change the rules; no code change needed.
- Nav link to the validator on all pages.

### Fixed
- Mobile nav: links were hidden below 640px with no replacement. Links now stay visible and the clock is hidden instead.
