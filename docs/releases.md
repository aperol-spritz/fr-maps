# GitHub releases

## Current mode: GitHub only

The workflow intentionally runs the publisher with `--github-only`. It creates
GitHub releases with `module.json` and `module.zip`; it does **not** call Foundry,
read a Foundry secret, or create Foundry submission receipts. This remains true
if a Foundry token is configured in the repository. No Foundry package
registration or release token is needed for the current workflow. Users can
install using the public GitHub manifest URL.

## Repository and one-time setup

Repository: **https://github.com/aperol-spritz/fr-maps**.
Foundry package ID: **`neverwinter-atlas`**; title: **Neverwinter: City Map**.
Compatibility is copied exactly from `module.json` (currently minimum `14`,
verified `14.370`). Development/build runtime is Node **24.x**.

At the initial bootstrap inspection on 2026-11-09, the remote was public and empty, with default branch
`main`, no refs, releases or workflows. The local module directory had no Git
metadata. It was initialized on `main` with that remote as `origin`; at that
inspection phase no initial commit, push or live publication had been made.
There was no existing Publish Release UI workflow to preserve.

After the maintainer authorized GitHub-only publication and completed Git sign-in,
the initial commit and `v0.17.0` tag were pushed. The first
[release run](https://github.com/aperol-spritz/fr-maps/actions/runs/42666541051)
passed both jobs and published
[v0.17.0](https://github.com/aperol-spritz/fr-maps/releases/tag/v0.17.0).
The public assets were downloaded and independently verified; see
[the live verification record](testing/release-live-2026-11-09.json).
No Foundry directory submission was made.

Version [0.18.0](https://github.com/aperol-spritz/fr-maps/releases/tag/v0.18.0)
was published through the existing GitHub-only
[workflow](https://github.com/aperol-spritz/fr-maps/actions/runs/42704457837).
It bundles the authored map positions/styles/calibration, six animated pin GIFs
and the prepared 60-location RU/UA lore expansion. The downloaded public ZIP was
verified against the exact tag commit and passed the disposable Foundry 14.370
browser scenario. See [release notes](releases/0.18.0.md) and
[public-asset/runtime evidence](testing/0.18.0-live-2026-11-09.json).

Version [0.18.1](https://github.com/aperol-spritz/fr-maps/releases/tag/v0.18.1)
publishes the accumulated runtime/UI fixes and revised journal prose through
the existing [workflow](https://github.com/aperol-spritz/fr-maps/actions/runs/42822058272).
All 26 portable tests passed. The downloaded public ZIP matches the release
commit and passed the disposable Foundry 14.370 scenario. The stable manifest
was independently confirmed to return 0.18.1. See
[release notes](releases/0.18.1.md) and
[public verification](testing/0.18.1-live-2026-11-10.json).
`data/module-release-baseline.json` records successful publication separately
from the world-authoring baseline.

The immutable-release settings endpoint returned HTTP 401 without authenticated
administration read access. Its setting is **unknown**, not assumed disabled.
The workflow probes it read-only and warns if unavailable; its asset strategy is
safe for either setting and never disables immutability. A maintainer can check
GitHub Settings → General → Releases before the first publication.

Maintainer setup:

1. Initial bootstrap is complete for this repository. For a new clone/fork,
   review the source, `.gitignore`, and asset/source notes. Make the initial
   commit and push `main` when ready. The workflow and its tag validator must be
   on the default branch before a manual Actions run is available. Both must
   also be present in tags to be built. Example bootstrap commands:

   ```sh
   git status --short
   git add .
   git commit -m "Bootstrap Neverwinter City Map and release automation"
   git push -u origin main
   ```

2. Enable Actions for the repository if needed. No personal access token is
   required for release publication. The build job has `contents: read`; only
   the publish job has `contents: write`. `GITHUB_TOKEN` is built in;
   do not create a repository secret with that name.

Foundry registration/token setup is deferred. The publisher retains the tested
optional API implementation for a later, explicitly authorized configuration
change; it is not reachable from the current GitHub-only workflow.

## Normal stable release

Run local checks first using Node 24:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run verify
```

The output directory must be new. For another build, choose a fresh directory:
`npm run build -- build/my-next-run`, then `node tools/verify.mjs build/my-next-run`.
Installed `packs/` are never cleared or rebuilt by this command.

Commit the intended source/release notes and push the branch. Then, only when
publication is authorized, create and push an existing commit's stable tag:

```sh
git tag -a v0.17.1 -m "Neverwinter: City Map 0.17.1"
git push origin v0.17.1
```

Use a new `vMAJOR.MINOR.PATCH` tag each time. Leading zeros, prerelease/build
suffixes, branch names and nonexistent tags are rejected before running the
tag's build. The tag is resolved through `refs/tags/…^{commit}`; checkout uses
that exact commit SHA. A branch with the same name is not accepted as a tag.

The workflow runs `npm ci --ignore-scripts`, `npm test`, `npm run build`, and
`npm run verify`, then generates release artifacts. Its manifest copy receives
the version from the tag; source `module.json`, package ID, title and all
compatibility values remain intact. Repository URLs come from Actions'
`GITHUB_REPOSITORY` context, not a hardcoded owner:

- Update manifest: `https://github.com/OWNER/REPO/releases/latest/download/module.json`
- Download: `https://github.com/OWNER/REPO/releases/download/TAG/module.zip`
- Foundry submission manifest: `https://github.com/OWNER/REPO/releases/download/TAG/module.json`
- Foundry release notes: `https://github.com/OWNER/REPO/releases/tag/TAG`

## What ships

`module.json` is at the ZIP root, byte-for-byte identical to the separate release
asset. The package includes root runtime `.mjs` files, `atlas.css`, `assets/`,
`lang/`, `data/places.json`, README/source notices, `docs/journals.md`, and the freshly built city
compendium at the path declared in the manifest. Existing/local databases are
not copied. A small `release-provenance.json` records the tag commit and hashes.

The validator checks runtime imports, CSS assets, manifest references, expected
map/dictionary files, the LevelDB file set, root layout, provenance and checksums.
The build verification reads back all journal rows from the actual new database.
It also audits all journal media and UUID links against case-sensitive archive
paths and the final collection IDs. Citation hyperlinks are retained and listed
as external references; embedded remote media or missing module media fails the
check. `npm run package` produces a verified local installable ZIP in a new
`build/local-*` directory without a tag or publication. See [journal packaging](journals.md).
It excludes development dependencies, tooling, tests, evidence, audit captures,
the unconfirmed sewer reference, old packs, Git metadata, worlds and licences.

## Release creation, duplicate events and recovery

One workflow contains both jobs, connected by `needs: build`. It does not rely on
`release.published`: events generated using `GITHUB_TOKEN` do not start another
release workflow. See [GitHub's trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Runs for the same tag are serialized with `cancel-in-progress: false`. The
publisher independently checks that the remote tag still resolves to the build
commit. It creates new releases as automation-marked drafts, attaches both
assets, downloads and verifies their server-side bytes, then publishes. This
follows [GitHub's immutable-release guidance](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

Existing release titles/notes are retained. Existing assets are downloaded and
verified, never deleted or uploaded with clobber. Complete immutable releases
are reused. An incomplete mutable draft/release can receive missing matching
assets. An incomplete immutable release requires a new version; the workflow
fails with an explicit explanation rather than attempting replacement. Fresh
LevelDB bytes may differ across builds, so a valid original archive is retained
after checking the tag commit, manifest, file hashes and unchanged runtime.

An automation-marked interrupted draft can be completed on retry. A human-created
draft stays a draft, and a prerelease stays a prerelease: neither is submitted
to Foundry. If you intentionally publish such a draft through GitHub's UI,
dispatch this workflow again for its tag afterward.

For retry/backfill, open **Actions → Release Neverwinter City Map → Run workflow**,
select `main`, enter the exact **existing tag** in the required `tag` field, and
run. This rebuilds the tag and reuses its release/notes/assets safely. A backfill
older than the current stable release does not replace `latest`. Do not move an
already released tag or delete its immutable release to try to reuse the name.

After assets are publicly available, the active workflow finishes with an
intentional notice that Foundry publication is disabled. Drafts and prereleases
also remain ineligible for Foundry submission. Re-running the same tag keeps its
notes and matching assets.

To enable Foundry directory publication in the future, register the exact package
ID `neverwinter-atlas`, copy the package edit page's Package Release Token, and
add it as `FOUNDRYVTT_RELEASE_TOKEN` under GitHub Settings → Secrets and variables
→ Actions. Then explicitly review/enable the token environment, remove the
`--github-only` flag, and restore the receipt upload step and `actions: read`
permission. The optional implementation uses the version-specific manifest and
release notes URLs and preserves all compatibility values. See the [official
API](https://foundryvtt.com/article/package-release-api/). Merely adding a secret
does not enable submission.

The optional Foundry implementation writes a token-free receipt after confirmed
success; its former Actions retention was 90 days. If re-enabled, receipt lookup
must be paired with receipt upload. External API submission and artifact upload
cannot form an atomic transaction; ambiguous/duplicate API responses need
maintainer review rather than being silently accepted.

## Verification scope

Portable tests run the real builder, real temporary Git tag operations, archive
validation, and publication behavior against localhost-only mock HTTP services.
They need no GitHub/Foundry secrets. The retained full Foundry UI tests require
the licensed local environment and sibling GEM harness; they are not part of the
GitHub-hosted release gate. Their historical results do not replace current
release-tool checks. Live results are recorded separately in docs/testing/. No Foundry publication
is performed in the current mode.
