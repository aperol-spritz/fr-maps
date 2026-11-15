# Journal stacking regression — 2026-11-15

Fixed native atlas window raising in window.mjs. Foundry ApplicationV2 bringToFront caches frontApp and ui.activeWindow. Raising a native dialog incremented ApplicationV2._maxZ but left the previously front journal as ui.activeWindow; reopening that journal could reuse its old z-index. Native raise now clears ui.activeWindow, so Foundry correctly allocates a new front z-index on the next bringToFront. No arbitrary always-on-top CSS or delays.

Regression coverage: test repeats atlas header pointerdown followed by the already-rendered journal title click three times. Each repetition asserts the journal has a higher computed z-index and that document.elementFromPoint in the overlap belongs to the journal. Existing exact-page double-click, permissions, player-reader and revocation checks remain.

Validation: 41/41 portable tests passed. ZIP build/pack verification passed. Foundry 14.370 / dnd5e 6.1.0 targeted journal/location panel profile passed, including the repeated stacking regression and independent player clients. Profile command: node tests/journals.mjs build/local-rUhYQM/module.zip --location-panel-only. Normal full-run defaults retain all scenarios.

Full browser suite also reached and passed journal stacking and subsequent lore/list/access checks, but failed the design geometry assertion (.nw-stage.x -91 -> -258); see full-foundry-report.json. Do not report the full suite as passing. An earlier stale territory-checkbox selector in tests/lore-beggars-nest.mjs was corrected to operate in the territory manager.

Artifact: build/local-rUhYQM/module.zip; SHA256 cfd22fc5029d795b0c59f2a755582a840d785447e0db8fb0980a9d4a1b5098b8. Concurrent edits in other task areas were preserved. Installed packs and campaign data were not modified; no publication performed.
