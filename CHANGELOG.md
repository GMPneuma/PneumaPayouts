# Changelog

## 0.5.3 - 2026-08-25

- Added compact reward-type icons to every Payout Inbox award.
- Preserved actual Item artwork for Item awards.
- Added icon inference for acknowledgments created by earlier module versions.

## 0.5.2 - 2026-08-25

- Added configurable Payout Container support with functional Communal Money
  and communal Item delivery.
- Added drag-and-drop Item payouts for Communal and individual awards, including
  stack-aware quantities, previews, logs, Discord summaries, and Inbox icons.
- Configured Items are safely flattened: weapons arrive unloaded, installed
  Items arrive separately and uninstalled, and loaded rounds arrive as a
  separate ammunition stack.
- Added always-visible Primary Downtime awards throughout payout records and
  summaries without changing Actor or journal data.
- Improved the native Foundry interface with clearer section accents,
  collapsible recipient previews, scope coloring, and responsive form sizing.
- Updated the roadmap to reflect the module's current implementation state.

## 0.5.1 - 2026-08-25

- Added a running Current HQ IP total that recalculates from positive and
  negative HQ journal adjustments, including manually edited rows.
- Disabled GM acknowledgment and Humanity-roll actions by default, with an
  explicit per-window control for acting on a player's behalf.
- Made Actor links visibly underlined and changed the Communal and Primary
  payout section accents to blue and green.

## 0.5.0 - 2026-08-25

- Added separate Communal and Primary payout sections, including HQ IP tracking.
- Added a permanent GM-only Payout Log while keeping player Inboxes limited to
  pending rolls and acknowledgments.
- Improved payout descriptions across Preview, Discord, journals, Inbox, and
  Actor Money/IP transactions; Actor transactions now include the session name.
- Added actor-sheet links, remembered in-game dates, and attendance Last Session
  tracking.
- Improved Discord Markdown structure and Discord user, individual-role, and
  whole-crew-role mappings.
- Refined Humanity roll handling, compact amount controls, and payout
  acknowledgments.
- Refreshed the native Foundry-style interface with muted red accents and subtle
  section shading.

## 0.1.11 - 2026-08-25

- Added group HQ IP payouts with Preview, Discord, ledger, and HQ journal
  integration.
- Added Last Session to attendance tracking and fixed payout descriptions across
  Preview, Discord, journals, Actor transactions, Humanity prompts, and Inbox.
- Redesigned Participants and Payout as compact two-column forms and increased
  the default window height.
- Added a remembered free-text in-game date to payout records and summaries.
- Made individual descriptions fill available space and restricted Humanity and
  Reputation amounts to compact two-digit fields.
- Improved Humanity dice-mode behavior by clearing and disabling the fixed
  amount field.

## 0.1.10 - 2026-08-25

- Expanded payout acknowledgments to show every applicable group and individual
  award for the recipient.
- Fixed duplicated journal page titles and incorrect first-data-row header
  styling, including a safe migration for the editable HQ page.
- Set the Payouts journal permissions to Owner for GMs and Assistant GMs and
  read-only for Players and Trusted Players.
- Stopped adopting unrelated journals solely because they are named Payouts.

## 0.1.9 - 2026-08-25

- Fixed recipient cards shrinking and overlapping in the payout Preview.
- Reworked Discord Markdown into shared group awards followed by compact
  mention-led individual payout bullets.
- Added Discord User ID, individual Role ID, and whole-crew Role ID mappings.
- Added a setting to enable or disable the post-payout Discord Markdown dialog.
- Added a persistent player/GM Payout Inbox backed by Actor and User flags.
- Added uniquely tracked Humanity rolls shared between chat and the Inbox.
- Added optional player payout acknowledgments with GM-visible status.

## 0.1.8 - 2026-08-25

- Fixed reopening the payout window after completing an earlier payout.
- Made player Humanity-roll prompts visible to GMs for oversight.
- Improved Preview readability with aligned values and per-recipient result cards.
- Added world-level Discord user links and a copy-ready Discord Markdown summary.
- Added the self-maintaining Payouts journal with HQ, Player Reputation, and
  Attendance pages.
- Connected faction-specific Reputation and per-player attendance to completed
  payouts.

## 0.1.7 - 2026-08-24

- Restricted each selected player to one payout Actor and reduced UI whitespace.
- Added repeatable group and individual payout entries with separate Humanity
  Gain and Humanity Loss choices.
- Added fixed or player-rolled 1d6–4d6 Humanity payouts through private chat
  prompts.
- Added an old-to-new payout preview and transactional Actor updates with
  rollback protection.
- Added Money, IP, Humanity, EMP, and standard Reputation execution plus payout
  ledger records.

## 0.1.6 - 2026-08-24

- Compressed the session and target summary into a single compact row.
- Added descriptions to the primary Money and IP payouts.
- Added repeatable Money, IP, and signed Humanity adjustments with descriptions.
- Consolidated Humanity Gain and Loss into one signed adjustment field.

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
