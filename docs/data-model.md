# Data model

## Payout ledger

Completed payouts are retained in the hidden, world-scoped Foundry setting
`pneuma-payouts.payoutLedger`. The ledger is versioned so later releases can
migrate old records.

Each payout record captures:

- a stable UUID and creation timestamp;
- the GM who created it;
- a required session label and optional notes;
- snapshots of the selected Foundry users and their associated Actors;
- every applied change, including its target, amount, previous value, and new
  value; and
- an optional reference to a record that it corrects.

Names are stored alongside Foundry IDs so history remains readable if a User or
Actor is later renamed or deleted. IDs remain the canonical references.

## Storage responsibilities

- Character balances remain canonical Cyberpunk RED Actor system data. The
  module records snapshots of changes; it does not duplicate current balances.
- The payout ledger and future HQ IP pool are world-level module data.
- Attendance is keyed by Foundry User and may retain the associated Actor ID for
  session context.
- Faction Reputation will be world-level structured module data. A journal will
  be a readable projection of that data rather than the canonical database.
- Actor flags are reserved for genuinely Actor-specific module state and are not
  used for the global payout history.

## Corrections

Records are append-only. A correction creates a new payout record whose
`correctsRecordId` refers to the earlier record. Existing history is never edited
in place.
