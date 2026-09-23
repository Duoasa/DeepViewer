# ADR-0011 — Stable channel data roots

Status: Accepted
Date: 2026-09-22
Specification: DV-0031

Application bundles and versioned runtime distributions contain executable resources only. Persistent data uses one stable Application Support directory per channel: DeepViewer or DeepViewer Dev. Neither application semver nor DSH semver may enter this path. An explicit development test override remains isolated and disables legacy discovery.

Desktop profile layout has an independent numbered migration ledger. Migration 1 imports legacy same-channel profiles using validated snapshots and a recoverable directory switch before starting DSH. Sources remain intact, target pre-migration data is retained, and conflicting alternatives remain in snapshots with a local report. Session directories are indivisible units; their logs are never combined or rewritten. Workspace registry v2 is merged by canonical path with unique session ownership. Unsupported registry formats fail closed rather than being guessed. Latest meaningful source data selects current configuration; other configurations remain recoverable.

After migration 1, ordinary upgrades only replace executables. They do not rediscover legacy profiles or restore deliberately deleted records. DSH owns its existing versioned session-format migrations. Desktop migration schema and DSH data schemas are independent of application version. Unknown newer desktop schema blocks startup instead of silently opening a fresh store.

The legacy directories are not removed: existing absolute attachment/workspace references must continue to resolve, and old releases must not be redirected to write the new store. Downgrades to releases before this policy can still write their old roots; importing those later edits is not automatic.
