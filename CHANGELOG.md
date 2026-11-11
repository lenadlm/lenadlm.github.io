# Changelog

## 2026-11-03

### Added
- `validator.html`: KRA XML validator page. Validates one or many files against `SA01-LoadSeaSD.xsd` entirely in the browser (no upload). Reports line number, element path, TD bill code and the problem per error; CSV export.
- `assets/js/kra-validator.js`: schema-driven validator that reads the XSD at runtime (sequences, occurrence limits, patterns, length, decimal digits, date/dateTime, attributes, stray text).
- `assets/js/validator-ui.js`, `assets/css/validator.css`: page behaviour and styling.
- `assets/xsd/SA01-LoadSeaSD.xsd`: schema served with the site. Replace this file to change the rules; no code change needed.
- Nav link to the validator on all pages.

### Fixed
- Mobile nav: links were hidden below 640px with no replacement. Links now stay visible and the clock is hidden instead.
