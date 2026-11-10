# Neverwinter synchronization and release skill

On 2026-11-10 the maintainer expanded `$neverwinter-sync-compendiums` to review
all module changes since the last published release and publish a new version.
The installed skill lives in the user's Codex skills directory.

The workflow inventories committed changes, staged/unstaged edits and untracked
project files alongside the independent world-authoring snapshot. Runtime
bugfixes, CSS, UI behavior, prose, media, source/build tools, tests, workflows and
docs are considered even when `koban` has no new authoring data. It separates
shipped runtime, compiled-content effects and repo-only supporting changes.

Explicit invocation authorizes a version bump, tests/build, commit/push, new tag
and GitHub release, unless the request says audit/local only or forbids publishing.
Automatic skill selection alone does not grant publication permission for a
narrower coding request. Foundry listing submission and live-world installation
remain separately authorized actions.

The release path prepares and tests the intended source, uses a new semantic
version, monitors the existing GitHub-only workflow and verifies downloaded
public artifacts against the exact tag. Successful publication is recorded
separately from successful world capture. Published tags/assets are preserved;
failed checks are reported without a false completion claim.
