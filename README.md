# Neverwinter: City Map

A Russian/Ukrainian Foundry VTT atlas for Neverwinter in 1492 DR. Package ID:
`neverwinter-atlas`. Minimum Foundry: **14**; verified: **14.370**.

Open with **M**. Includes the city map, the supplied Evernight map, a placeholder
for a future underground map, lore journals, custom locations, territories,
drawings, character markers, permissions and a distance/travel-time ruler.

See [map controls](https://github.com/aperol-spritz/fr-maps/blob/main/docs/map-controls.md), [lore sources](https://github.com/aperol-spritz/fr-maps/blob/main/docs/content-1492.md),
[location review](https://github.com/aperol-spritz/fr-maps/blob/main/docs/forgottenmaps-review.md), and [release setup](https://github.com/aperol-spritz/fr-maps/blob/main/docs/releases.md).

## Build and test

Use **Node 24.x** (`.node-version`). No Foundry licence is needed for the portable
build or release tests:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run verify
```

`build/release` must not exist before building. Build into another NEW directory
under `build/` with `npm run build -- build/my-run`. The builder never changes
installed compendiums. It compiles `data/places.json` into the manifest's city
LevelDB and copies the runtime files/assets. Generated packs, audit snapshots,
test outputs and dependencies are excluded from Git and release archives.

Existing full Foundry browser scenarios remain in `tests/access.mjs` and
`tests/city.mjs`. They use the sibling GEM harness, a licensed local Foundry and
its system; see the historical reports in `docs/testing/`. They are separate from
the standalone release pipeline and are not claimed to run on GitHub-hosted
runners. The release tests exercise the actual builder, ZIP, Git tag resolution,
GitHub release recovery and Foundry submission against local mock HTTP services.

## Install after publication

Releases are published on GitHub only; Foundry package-directory submission is
intentionally disabled. Once the first stable release exists, its update manifest
will be:
`https://github.com/aperol-spritz/fr-maps/releases/latest/download/module.json`.
There is no release at that URL until the maintainer publishes one.

The installation folder stays `neverwinter-atlas` even though the repository is
called `fr-maps`. See [asset/source notes](ASSET_NOTES.md); the repository does not
assign a new blanket licence to third-party maps or source material.
