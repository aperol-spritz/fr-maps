# Bulk marker access — 2026-11-13

Global map settings now offer No change / Hide / View / Owner for all location markers on the current layer. Saving applies one atomic map state update and replaces individual user grants. The unfiltered live location provider includes offscreen and search/category-hidden markers. Areas without markers, Actors, other layers and map access remain unchanged. Default No change and Cancel do not apply a bulk update. Russian and Ukrainian UI included.

Validation: Node 24.22.2, 26/26 portable tests; fresh ZIP build and verify; disposable Foundry 14.370 journal/browser suite passed. New tests exercise View/Owner/Hide, filtered-out markers, removal of named grants, unchanged other map data/map permission, badge colors, persistence after reopening, and cancellation. An initial test failed to reopen the atlas because keyboard focus remained in an input; the test now clears focus before KeyM, and the rerun passed.

Artifact: build/local-5uxbxC/module.zip. Evidence: tests/journals-latest.json, build/bulk-access-foundry.log, build/bulk-access-node.log, build/bulk-access-verify.log. Installed packs and campaign settings were not changed. No publication performed.
