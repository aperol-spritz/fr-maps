# Neverwinter: City Map

This directory is independent of sibling GEM. Package ID `neverwinter-atlas`,
title `Neverwinter: City Map`; `module.json` is authoritative for compatibility.
Use Node 24.x and the pinned package-lock. Never rebuild or open installed packs
in place. `npm run build` writes only to a NEW directory under `build/`.

Run `npm test`, `npm run build` and `npm run verify` for release-tool changes.
Add behavioral release tests under `tests/node/` using disposable Git repositories
and mock HTTP services. No live GitHub/Foundry mutation during tests. Retain the
existing Foundry browser scenarios; do not substitute a manual installed-world
walkthrough for automated checks. Runtime changes require the appropriate
Foundry behavior tests in addition to portable checks.

Read `docs/releases.md` before changing release automation. Preserve notes and
existing assets; never use clobber on release recovery. Do not publish a tag,
GitHub release or Foundry listing without explicit user authorization.

Current verified Atlas test baseline (2026-11-15): Foundry 14.370 / dnd5e
6.1.0. `tests/environment.mjs` owns the current system version for the isolated
ZIP/journal suite. See `docs/testing/dnd5e-6.1.0-2026-11-15/README.md` for evidence
and scope. Older reports remain historical; sibling GEM has an independent baseline.

Current baseline 6.1.0 does not exclude dnd5e 6.0.6. The Atlas test matrix supports both versions; use separate copied systems for compatibility runs.
