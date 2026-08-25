# Pneuma's Payouts Roadmap

## Goal

Give a GM one window for selecting session participants, distributing Cyberpunk
RED rewards, and retaining a useful record of each payout.

## Recommended execution order

The order below accounts for both difficulty and dependencies. A later item may
be mechanically easy but appears later because it relies on the shared payout
and persistence layers.

Status key: `[x]` complete, `[~]` usable but incomplete, `[ ]` not implemented.

### Milestone 1: Foundation

- [x] **1. Define payout records and module storage** — Easy
  - Establish one data shape for a payout event.
  - Record timestamp, GM, session label, notes, selected players/Actors, and all
    applied changes.
  - Decide which data belongs in world settings, Actor flags, or a journal.
- [x] **2. Discover player accounts and associated Actors** — Easy
  - Read non-GM users, their assigned Actor, and all owned character Actors.
  - Handle players with no assigned Actor and Actors shared by multiple users.
  - Present active/inactive status without excluding offline players.
- [x] **3. Build the GM payout window and participant selector** — Easy–Medium
  - Open from an appropriate Foundry control or settings button.
  - Select attendees and default sensibly from active users.
  - Restrict payout execution to GMs.
- [x] **4. Add validation, preview, and transactional execution** — Medium
  - Show exactly what will change before applying a payout.
  - Reject invalid amounts and missing/unsupported Actors.
  - Avoid partial payouts when an update fails.
  - Prevent accidental double submission.

### Milestone 2: Core character payouts

- [x] **5. Primary Money and IP payouts** — Medium
  - Give every selected character the same Money and/or IP adjustment.
  - Support positive, zero, and intentionally negative adjustments where valid.
- [x] **6. Primary Humanity Gain and Humanity Loss** — Medium
  - Expose gain and loss as clear, separate inputs.
  - Apply the Cyberpunk RED system's Humanity rules and limits correctly.
- [x] **7. Additional individual payouts in the same window** — Medium–Hard
  - Add per-character overrides or bonuses alongside group values.
  - Support Money, IP, Humanity Gain, Humanity Loss, and Reputation.
  - Preview the combined group and individual result for each character.
- [x] **8. Standard Reputation payouts** — Medium
  - Apply character Reputation changes through the individual payout section.
  - Include the old value, adjustment, and new value in the payout record.

### Milestone 3: Shared and persistent rewards

- [x] **9. Communal Money payout to a Container Actor** — Medium
  - Configure a Default Payout Container in module settings without
    automatically creating an Actor.
  - Override the Payout Container for an individual payout.
  - Require a valid Cyberpunk RED Container Actor when Communal Money or Items
    are present.
  - Apply and record Communal Money with Preview, Discord, ledger, Payout Log,
    and transactional rollback support.
- [x] **10. Attendance and sessions-played tally** — Medium–Hard
  - Derive attendance from the selected payout participants.
  - Maintain an ongoing per-player sessions-played total.
  - Record the most recent session name for each player.
  - Store attendance by Foundry player account rather than Actor.
- [~] **11. HQ IP pool** — Medium–Hard
  - Maintain HQ IP at the world/group level instead of on a character.
  - Record gains from Communal Payouts in the editable HQ journal.
  - Allow GM-entered negative spending adjustments.
  - Display a recalculated Current HQ IP total on the HQ journal page.
  - Remaining: display the available balance in the Payout window and add a
    structured spending workflow if manual journal rows prove insufficient.
- [~] **12. Faction-specific Reputation journal** — Hard
  - Track faction Reputation separately from normal Actor Reputation.
  - Write structured Actor, Reputation, Faction, and Reason rows to the Payouts
    journal.
  - Replace the current value when the same Actor and faction receive another
    Specific Reputation payout.
  - Remaining: optional faction definitions and correction/rename handling.

### Milestone 4: Completion and safety

- [x] **13. Payout history log** — Medium
  - Every completed payout receives a permanent page in the GM-only Payout Log
    journal.
  - The internal versioned payout ledger retains structured records.
  - The journal is intentionally a reference-only log; a separate history
    browser, filtering UI, and payout-history editor are not required.
- [~] **14. Automated tests and migration handling** — Hard
  - Stored payout records are versioned and legacy journal markup has targeted
    migration handling.
  - Type checking, production builds, formatting, and package validation run
    before releases.
  - Remaining: automated unit/integration coverage.
  - Test reward calculations, permissions, malformed Actors, and partial-failure
    behavior.

### Milestone 5: Player communication and external summaries

- [x] **15. Persistent player Payout Inbox** — Medium
  - Show each player all Primary and individual rewards that apply to them.
  - Track acknowledgment separately for each payout and remove acknowledged
    items from the active Inbox.
  - Keep multiple Humanity rolls independently identifiable and actionable.
  - Allow GMs to review pending actions while requiring an explicit opt-in
    before rolling or acknowledging on a player's behalf.
- [x] **16. Player-controlled Humanity rolls** — Medium–Hard
  - Create targeted chat prompts and persistent Inbox actions for fixed payout
    roll formulas from 1d6 through 4d6.
  - Apply the result to Humanity and EMP exactly once.
- [x] **17. Discord-compatible payout summary** — Medium
  - Put Communal and Primary awards first and individual rewards afterward.
  - Support Discord User IDs, per-player Role IDs, and a whole-crew Role ID.
  - Allow the Discord output dialog to be disabled in module settings.
- [x] **18. Self-maintaining Foundry journals** — Medium
  - Create module-owned Payouts and Payout Log journals without adopting
    unrelated journals that share those names.
  - Give GMs ownership of both journals, players read-only access to Payouts,
    and no player access to Payout Log.

### Milestone 6: Inventory payouts

- [~] **19. Item document payouts** — Medium–Hard
  - Accept any Foundry Item document in Communal and individual payouts only,
    including compendium, world-directory, custom, and embedded Items.
  - Deliver individual Items to the selected Actor with transactional rollback.
    Stackable Cyberpunk RED Items use one correctly sized `system.amount` stack;
    non-stackable Items use separate copies when quantity is greater than one.
  - Include item names, quantities, descriptions, and source UUIDs in
    Preview, Inbox, Discord output, the structured ledger, and Payout Log.
  - Deliver Communal Items to the selected Payout Container.
  - Remaining: test Cyberpunk RED Item types in-world and decide whether new
    stacks should ever merge into matching Items already owned by the Actor.
- [x] **20. Display-only Primary Downtime payouts** — Easy
  - Keep Downtime visible alongside Primary Money and IP with a day count and
    description.
  - Include Downtime in Preview, recipient acknowledgments, Discord Markdown,
    the structured ledger, and Payout Log without modifying Actors or the
    Payouts journal.

## Current release state

Version `0.5.1` completes the core character payout workflow and provides usable
attendance, HQ IP, faction Reputation, player acknowledgment, Discord summary,
and audit-log features. Current unreleased development adds individual Item
delivery and a configurable Payout Container for Communal Money and Items.
It also adds display-only Primary Downtime awards. Correction workflows and
automated tests remain future work.

## Next recommended work

1. Test individual and communal Item delivery across Cyberpunk RED Item types,
   particularly stackable Items and customized embedded Items.
2. Show the current HQ IP balance in the Payout window and decide whether HQ
   spending needs a dedicated form.
3. Add payout correction/reversal semantics so attendance and audit history stay
   accurate when a GM fixes a completed payout.
4. Add automated calculation and transaction rollback tests.

## Decisions to make while implementing

- Whether negative Money/IP values are permitted or must use a separate spending
  workflow.
- Whether corrected payouts should reverse and replace the original or create an
  explicit adjustment record.
- Whether factions remain free-text or become a managed list.
- Whether HQ spending remains an editable journal workflow or gets dedicated UI.

## Resolved design decisions

- Each selected player can have only one Actor in a payout; shared Actor IDs are
  deduplicated.
- Attendance is keyed by Foundry player account, not Actor.
- Session Name is required; In-Game Date and Notes are retained with the payout.
- The most recently entered In-Game Date becomes the next payout's default.
- Humanity dice are rolled by the owning player rather than by the GM by default.
- Module journals are identified by stored IDs and are never adopted by name.
- Foundry v12 remains the supported target while Cyberpunk RED requires it. A
  future v13 migration may use Foundry's world calendar APIs when available; the
  module will not build a custom calendar UI.
