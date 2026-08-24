# Pneuma's Payouts Roadmap

## Goal

Give a GM one window for selecting session participants, distributing Cyberpunk
RED rewards, and retaining a useful record of each payout.

## Recommended execution order

The order below accounts for both difficulty and dependencies. A later item may
be mechanically easy but appears later because it relies on the shared payout
and persistence layers.

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
- [ ] **4. Add validation, preview, and transactional execution** — Medium
  - Show exactly what will change before applying a payout.
  - Reject invalid amounts and missing/unsupported Actors.
  - Avoid partial payouts when an update fails.
  - Prevent accidental double submission.

### Milestone 2: Core character payouts

- [ ] **5. Group Money and IP payouts** — Medium
  - Give every selected character the same Money and/or IP adjustment.
  - Support positive, zero, and intentionally negative adjustments where valid.
- [ ] **6. Group Humanity Gain and Humanity Loss** — Medium
  - Expose gain and loss as clear, separate inputs.
  - Apply the Cyberpunk RED system's Humanity rules and limits correctly.
- [ ] **7. Additional individual payouts in the same window** — Medium–Hard
  - Add per-character overrides or bonuses alongside group values.
  - Support Money, IP, Humanity Gain, Humanity Loss, and Reputation.
  - Preview the combined group and individual result for each character.
- [ ] **8. Standard Reputation payouts** — Medium
  - Apply character Reputation changes through the individual payout section.
  - Include the old value, adjustment, and new value in the payout record.

### Milestone 3: Shared and persistent rewards

- [ ] **9. Communal Money payout to a Container Actor** — Medium
  - Select a compatible Container Actor as the communal account.
  - Apply and record the communal Money adjustment in the same payout event.
- [ ] **10. Attendance and sessions-played tally** — Medium–Hard
  - Derive attendance from the selected payout participants.
  - Append one attendance entry per completed session payout.
  - Maintain an ongoing per-player sessions-played total.
  - Prevent duplicate attendance when correcting or resubmitting a payout.
- [ ] **11. HQ IP pool** — Medium–Hard
  - Maintain HQ IP at the world/group level instead of on a character.
  - Allow gains and spending with an auditable balance history.
  - Display the current pool in the payout window.
- [ ] **12. Faction-specific Reputation journal** — Hard
  - Define factions and associate Reputation entries with them.
  - Track faction Reputation separately from normal Actor Reputation.
  - Write readable, structured entries to a designated Foundry journal.
  - Support renames, deleted factions, and corrected payouts without losing
    history.

### Milestone 4: Completion and safety

- [ ] **13. Payout history and review UI** — Hard
  - Browse prior payout records from the module window.
  - Filter by session, player, Actor, or reward type.
  - Clearly distinguish original payouts from later corrections.
- [ ] **14. Automated tests and migration handling** — Hard
  - Test reward calculations, permissions, malformed Actors, and partial-failure
    behavior.
  - Version stored module data so future releases can migrate it safely.

## Suggested first release

Version `0.1.0` should cover items 1–8: player/Actor discovery, participant
selection, preview, safe execution, group payouts, and individual character
payouts. Communal and persistent world-level features can follow once the core
transaction model has been exercised in real sessions.

## Decisions to make while implementing

- Players may select more than one eligible character in a session; Actor IDs
  are deduplicated before payout execution.
- Whether negative Money/IP values are permitted or must use a separate spending
  workflow.
- What session metadata is mandatory beyond date, label, and notes.
- Whether corrected payouts should reverse and replace the original or create an
  explicit adjustment record.
- Whether attendance is keyed by Foundry user, Actor, or both.
- Whether faction definitions live in module settings or in a designated journal.
