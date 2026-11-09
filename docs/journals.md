# Bundled city journals

The existing root manifest already declares `city`, label
**Neverwinter: City Map · RU / UA**, type `JournalEntry`, at `packs/city-v17`.
Its collection ID is `neverwinter-atlas.city`. That declaration and the
existing content are preserved; a duplicate pack is unnecessary.

## Sources and identity

`data/places.json` is the editable canonical source (60 locations, RU and UA).
`tools/build-pack.mjs` generates **Невервинтер · 1492 ЛД** and
**Невервінтер · 1492 ЛД**, with 60 text pages each. The two lore supplements
append ten pages per language while preserving the original page identities
and order. Each location has a short summary in RU and UA.
Journal IDs use SHA-256(language), and
page IDs use SHA-256(language/location ID), truncated to 16 hexadecimal
characters. Editing prose does not change identity. Preserve location IDs and
array order when editing. `@UUID` links already address the final collection,
journal and page IDs; the compiled database is compared to these canonical
rows on every verification.

Six uploaded animated pin images were copied byte-for-byte from
`worlds/koban/neverwinter-icons/` into `assets/journals/pins/`: castle, knowledge,
beached, mask, shard and chasm-rift. A verified independent snapshot of the
world settings supplied only the location/media associations; source settings
and files were not modified. `data/pin-media-provenance.json` records original
paths, sizes and SHA-256 hashes. The six `asset` fields in `data/places.json`
use portable module paths. Each corresponding text page embeds its GIF in both
languages (12 embedded references total), without changing page IDs or order.
The same assets are the atlas's default pin images, including for existing
location records without an image; an explicit empty image remains a removal.
All existing module assets, including the atlas maps, remain in the ZIP.

Version 0.18.0 also captures authored point coordinates/styles and ruler
calibration. `defaults.mjs` provides portable map defaults, while existing world
settings override them. Each compiled page carries its canonical location data
in `flags.neverwinter-atlas.location`; journal flags carry the map defaults.
This preserves authored map data in the compendium without a startup world
import. The successful authoring baseline is recorded separately in
`data/atlas-sync-baseline.json` and is excluded from the installable ZIP.

The repository has no separate exported journal dataset requiring a world or
another PC. This build does not discover or silently include campaign journals.
To add such content later, supply each journal's Foundry **Export Data JSON**
with `_id` and full `pages` (including each page's `_id`, `sort`, `type`, rich
text and type-specific fields), plus every referenced image/audio/video/PDF
file at its exact original path/case. Also export the target journals/pages of
world `@UUID` links, or identify links that must remain dependencies. If an
export is unavailable, use a stopped, disposable copy of the world's full
`data/journal/` database (including its WAL and MANIFEST files), world manifest,
and referenced media tree. Never read a running world's database in place.
An export import/mapping pipeline would need to preserve these IDs, copy files
under `assets/journals/`, and rewrite references before compiling; it is not
needed or claimed for the current generated city source.

## Reproducible build and verification

Use Node 24.x and the pinned lockfile:

```sh
npm ci --ignore-scripts
npm test
npm run build -- build/my-journal-build
npm run verify -- build/my-journal-build
npm run package
```

`build/my-journal-build` must be NEW. The existing LevelDB builder writes only
under `build/`; it never opens or rebuilds installed packs. `npm run package`
creates another new build and a local ZIP with the original manifest version,
without release URLs or a claimed tag commit. Its provenance records file
checksums. The GitHub release builder retains its existing tag/version and
publication rules and runs the same pack audit before producing release assets.

`tools/journal-audit.mjs` checks compiled journal/page relationships, page types,
all explicit `@UUID` links, page media fields, HTML media attributes, `srcset`,
CSS URLs and local media hyperlinks. Missing files, case mismatches, unsafe
paths, unbundled media and unresolved document dependencies fail verification.
Portable media paths must be `modules/neverwinter-atlas/assets/...`.
Verification opens a temporary copy of the built/archived database, not the
input database, and compares every row to the canonical source.

Ordinary external citation hyperlinks are preserved and reported separately.
There are 75 distinct citation URLs, including the linked Volo book PDF; that
PDF is an external bibliography link, not an embedded PDF page. Following these
citations requires Internet access and their continued availability is not
verified. Reading the bundled journals and following their 392 internal links
requires no external content or other module.

## Automated Foundry ZIP scenario

With the licensed Foundry 14.370 / dnd5e 6.0.6 environment and pinned Playwright
1.62.1 used by the retained repository browser tests:

```sh
npm run test:foundry:journals -- build/local-<unique>/module.zip
```

The test uses the sibling GEM harness's environment/library discovery and login
helpers. `GEM_PLAYWRIGHT_PATH`, `GEM_BROWSER_EXECUTABLE`, `GEM_FOUNDRY_APP`,
`GEM_DND5E_SYSTEM`, `GEM_FOUNDRY_LICENSE` and `GEM_TEST_PORT` override local defaults.
It extracts the validated ZIP into an owned temporary data directory, copies the
system without opening source packs (checking source/copy hashes), creates a new
empty world, and launches a separate localhost server. It enables the module,
compares every title/page ID/order/type/HTML against the source, resolves every
internal link, opens the pack and a journal through the Compendium sidebar, and
rechecks content and pack opening after reload. It asserts there are no imported
world journals. Media HTTP checks apply when the source includes media; the
current city sources include six distinct animated GIFs. The test also checks
image rendering in a journal sheet and all six atlas pins in an empty world,
plus inherited defaults and explicit image removal on existing records.
All source campaigns remain untouched.
The server stops and disposable world/system/module/license copies are removed
in cleanup. Results go to ignored `tests/journals-latest.json`; copy a successful
report into `docs/testing/` when retaining release evidence.

The existing `tests/access.mjs` and `tests/city.mjs` scenarios remain intact.
