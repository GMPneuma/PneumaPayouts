# Changelog

## 0.1.1 - 2026-08-23

- Fixed the GM payout button not appearing in Foundry v12 by registering the
  scene-control hook before the `init` lifecycle event.

## 0.1.0 - 2026-08-23

- Added a GM-only payout window in the Token scene controls.
- Added session labels and payout notes.
- Added discovery of player accounts, assigned Actors, and all owned character
  Actors.
- Added active-player defaults, multi-Actor selection, and shared-Actor
  deduplication.
- Added a versioned world payout ledger and module API foundation.
