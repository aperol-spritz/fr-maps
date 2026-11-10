# Neverwinter: City Map

A Russian/Ukrainian Foundry VTT atlas for Neverwinter in 1492 DR. Package ID:
`neverwinter-atlas`. Minimum Foundry: **14**; verified: **14.370**.

Open with **M**. Includes the city map, the supplied Evernight map, a placeholder
for a future underground map, lore journals, custom locations, territories,
drawings, character markers, permissions and a distance/travel-time ruler.

Version 0.18.0 includes 60 locations, 120 RU/UA journal pages, six animated pin
images, and the authored location positions, styles and ruler calibration.

Version 0.18.1 packages the character-drag fix, journal-opening changes,
character search and compact sidebar controls, together with updated RU/UA prose.
See [the release notes](https://github.com/aperol-spritz/fr-maps/blob/main/docs/releases/0.18.1.md)
for verification scope and remaining coverage limits.

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

Create an installable local ZIP, without publishing or creating a tag:

```sh
npm run package
```

The command prints `build/local-<unique>/module.zip` and saves an adjacent
`verification.json`. Every invocation uses a new directory. The ZIP has
`module.json` at its root and includes the complete freshly compiled pack and
module assets. See [journal packaging](docs/journals.md) for sources, stable IDs,
the media/link audit and the disposable Foundry ZIP test.

Existing full Foundry browser scenarios remain in `tests/access.mjs` and
`tests/city.mjs`. They use the sibling GEM harness, a licensed local Foundry and
its system; see the historical reports in `docs/testing/`. They are separate from
the standalone release pipeline and are not claimed to run on GitHub-hosted
runners. The release tests exercise the actual builder, ZIP, Git tag resolution,
GitHub release recovery and Foundry submission against local mock HTTP services.

## Install in Foundry

Releases are published on GitHub only; Foundry package-directory submission is
intentionally disabled. In Foundry's **Add-on Modules → Install Module**, paste
this URL into **Manifest URL** and install:

```text
https://github.com/aperol-spritz/fr-maps/releases/latest/download/module.json
```

Enable **Neverwinter: City Map** in your world's module settings, then open it
with **M**. The stable manifest follows the latest release for future updates.
GMs can also open **Compendium Packs → Neverwinter: City Map · RU / UA**
(`neverwinter-atlas.city`) directly. It contains two journals with 50 pages each;
no world import or startup conversion is required. For a local ZIP, extract its
contents into `Data/modules/neverwinter-atlas/` in a separate test installation,
restart Foundry, and enable the module in the test world.
The first published version is [v0.17.0](https://github.com/aperol-spritz/fr-maps/releases/tag/v0.17.0).

The installation folder stays `neverwinter-atlas` even though the repository is
called `fr-maps`. See [asset/source notes](ASSET_NOTES.md); the repository does not
assign a new blanket licence to third-party maps or source material.
