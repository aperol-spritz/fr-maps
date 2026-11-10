# Atlas UI cleanup — 2026-11-10

Final artifact: `build/local-JaFVc3/module.zip`.

Removed visible period/precision filters, precision controls and editorial caveats from new journals and cards. Source period/position metadata remains intact. Original localized editorial text was preserved in `docs/development/location-editorial-notes.json` (excluded from packaging). Six GIF locations have additional bilingual journal prose; GIF bytes and stable page IDs are preserved.

Added vertical sidebar toggle, clear cog icons, journal-opening location title, adjacent colored access eye, proportional pin badge, online assigned-character defaults (alphabetical first three) and search over all permitted characters. Character drag disables inherited CSS transitions during the gesture. Journal opening awaits render and calls bringToFront.

Validation: Node 24.22.2; 26/26 portable tests passed; fresh package build and standalone verify passed (2 journals, 120 pages). Disposable Foundry 14.370 ZIP test passed, including bilingual lore, media/links, sidebar toggle, search and pointer-step drag tracking. Evidence: tests/journals-latest.json, build/node-check.log, build/ui-check.log, build/verify-check.log. Full city/access suites were updated for changed controls but not rerun in this pass. Online three-character selection, access badge behavior at multiple zoom levels and intermittent journal stacking still merit broader browser coverage.

Installed packs and campaign worlds were not rewritten. Existing world journal copies retain authored content. No release, tag or Foundry listing was published.
