# dnd5e 6.1.0 compatibility — 2026-11-15

Result: PASS for the tested Neverwinter Atlas snapshot on Foundry 14.370 / dnd5e 6.1.0 / Node 24.22.2.

Artifact: build/local-EZiLxo/module.zip, SHA256 df2bca5e782583397f0b464dca776a878fa46a367026a966aa8413200a68f01d.

Portable tests: 26/26. Fresh ZIP build and content verification passed. Disposable-world browser suite passed: 2 journals / 120 pages, local GIF assets, resolved UUID links, bilingual cards, sidebar controls, Actor search, prototype token image, marker drag tracking, real dnd5e character sheet opened from marker, and bulk marker access view/owner/hide with persistence/cancellation. No pageerror events.

Changes for this audit are test-only: tests/environment.mjs owns an Atlas matrix permitting dnd5e 6.0.6 and 6.1.0; journal world metadata and report use the actual installed version. The sibling GEM environment remains independently pinned to 6.0.6. Added character-sheet and image assertions to tests/lore-summaries.mjs. No runtime compatibility fix was required.

Official release notes reviewed: https://github.com/foundryvtt/dnd5e/releases/tag/release-6.1.0 . Removed formatText helper and changed price/crafting rounding are not used by the Atlas runtime.

Scope: only Atlas enabled in a new disposable world. Existing campaign migration, other modules/GEM, all dnd5e mechanics, and full multi-client city/access suites were not tested by this run. Source campaign and installed compendiums were not opened or mutated. Concurrent interface edits appeared in access.mjs/state.mjs during the run; these were preserved and are not claimed as verified unless present in the identified ZIP snapshot.
