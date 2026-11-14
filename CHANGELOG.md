# Changelog

## 2026-11-14

### Fixed
- Key words: rows could lose their TD bill code (`–`) because `keywordReport` and `partShipments` both stamped a `__kvKey` expando with independent counters. Running part shipments first left stale keys on the same nodes, two nodes collided on one key, the TD lookup missed, and the hit rendered without a code. Each scanner now keys its nodes with its own `WeakMap` (`makeKeyOf`), so a hit always resolves to its TD. On the supplied 134-TD manifest all 25 hits now show a bill code (10 were blank before); `billCodeOf` also falls back to a nested `*bill_code` descendant.

### Changed
- Part shipments: the criterion is now explicit — a container is reported when **2 or more** TDs declare it (`MIN_SHARED_TDS`), any number of TDs, not just pairs. Header reads `N container(s) shared by 2 or more TDs · M TD rows` and each group is labelled with its own `N TDs` count. TDs with no `<container_num>` fall back to their cargo lines' `<container_ref>`, so a shared box is still caught in exports that omit the `<ct>` block. Verified with 3-TD, 2-TD and ref-only fixtures.

### Fixed
- `validator-ui.js`: part-shipment rows for the second and later TD of a shared container no longer emit a placeholder cell. With the container cell row-spanned, that empty `<td>` pushed the TD bill code under the `Line` header and the line number into an unlabelled fourth column; the second row now starts at `TD bill code` and every value sits under its own header.

### Added
- `validator.html`: **part shipments** section, rendered after the replacements table. Groups every `<container_num>` that appears under more than one TD and lists `Container | TD bill code | Line`, with the container cell spanning its rows and labelled `N TDs`. Empty state explains that every container belongs to a single TD.
- `assets/js/edi-fixes.js`: `EdiFixes.partShipments(doc, lineMap)` — resolves each container to its nearest TD record, so the check works wherever the container element sits in the file.
- `validator.html`: manifest totals table at the top of the report — one row per uploaded file with TDs (`<td_bill_code>`), containers (`<container_num>`), 20 ft (ISO type `2xxx`), 40 ft (ISO type `4xxx`), packages (sum of `<decl_qty>`) and gross weight (sum of `<decl_gross_wgt>`), plus a `total` row when more than one file is loaded. A note appears if any container's ISO type is neither `2xxx` nor `4xxx`.
- `assets/js/edi-fixes.js`: `EdiFixes.summary(doc)` — DOM-only totals used by the page, so the counts never come from regenerated text.

### Fixed
- `assets/js/validator-ui.js`: every file's report is now expanded on render. A file with no schema errors and no replacement matches collapsed to a one-line summary, so the key-word review — the whole point of a clean file — was hidden until the row was clicked. The file header meta now also states the keyword match count (`162 TDs · no schema errors · 21 keyword matches`).
- Bumped the asset/build marker to `20261114a` so browsers reload the fixed bundle.

## 2026-11-13 (3)

### Removed
- Hits badge (`hits.seeyoufarm.com`) from the footer of `projects.html` and `tools.html` — a third-party image that may disappear without warning. `validator.html` and `index.html` have no footer badges.

## 2026-11-13 (2)

### Changed
- `validator` removed from the nav on every page; the validator is now reachable only from the KRA Validator panel on `tools.html`. `tools` added to the validator page nav so it still has a way back.

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
