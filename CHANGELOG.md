# Changelog

## 0.1.5 - 2026-08-24

- Added a horizontal individual-payout row for every selected recipient.
- Added individual Money, IP, Humanity Gain, Humanity Loss, and New Reputation.
- Added reason fields for IP, Humanity changes, and Reputation.
- Preserved individual entries when navigating Back and returning to Rewards.

## 0.1.4 - 2026-08-24

- Split the Rewards screen vertically into session/recipients and payout fields.
- Changed recipients to a compact vertical list.
- Stacked Money, IP, Humanity Gain, and Humanity Loss vertically.
- Added manual or 1d6–4d6 modes for Humanity Gain and Humanity Loss.

## 0.1.3 - 2026-08-23

- Added a two-step Participants → Rewards wizard.
- Added validation for the session label and selected recipients.
- Added Back/Next navigation that preserves participant choices.
- Added the group payout UI for Money, IP, Humanity Gain, and Humanity Loss.

## 0.1.2 - 2026-08-23

- Styled the payout scene-control icon gold for easier identification.
- Preselected every eligible player's default Actor.
- Reworked participants into compact Player + Actor rows.
- Hid alternate Actors behind a per-player Show other actors button.

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
