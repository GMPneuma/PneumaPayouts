import { MODULE_ID, PAYOUT_LOG_JOURNAL_ID_SETTING } from "./constants";
import type { PayoutPlan, RewardEntry } from "./payout-execution";

const JOURNAL_NONE = 0;
const JOURNAL_OWNER = 3;

export function registerPayoutLogSettings(): void {
  game.settings.register(MODULE_ID, PAYOUT_LOG_JOURNAL_ID_SETTING, {
    name: "Payout Log Journal ID",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
}

export async function ensurePayoutLog(): Promise<FoundryJournalEntry> {
  const storedId = game.settings.get(MODULE_ID, PAYOUT_LOG_JOURNAL_ID_SETTING);
  let journal =
    typeof storedId === "string" && storedId
      ? game.journal.get(storedId)
      : undefined;
  if (!journal)
    journal = await JournalEntry.create({
      name: "Payout Log",
      ownership: payoutLogOwnership(),
      pages: [],
    });
  await journal.update({ ownership: payoutLogOwnership() });
  await game.settings.set(MODULE_ID, PAYOUT_LOG_JOURNAL_ID_SETTING, journal.id);
  return journal;
}

export async function appendPayoutLog(
  plan: PayoutPlan,
): Promise<() => Promise<void>> {
  const journal = await ensurePayoutLog();
  const created = await journal.createEmbeddedDocuments("JournalEntryPage", [
    {
      name: payoutPageName(plan),
      type: "text",
      sort: Array.from(journal.pages).length * 100000 + 100000,
      text: { content: renderPayoutPage(plan), format: 1 },
    },
  ]);
  const pageId = created[0]?.id;
  return async () => {
    if (pageId)
      await journal.deleteEmbeddedDocuments("JournalEntryPage", [pageId]);
  };
}

function payoutLogOwnership(): Record<string, number> {
  return Object.fromEntries([
    ["default", JOURNAL_NONE],
    ...Array.from(game.users).map(({ id, isGM }) => [
      id,
      isGM ? JOURNAL_OWNER : JOURNAL_NONE,
    ]),
  ]);
}

function payoutPageName(plan: PayoutPlan): string {
  return plan.inGameDate.trim()
    ? `${plan.sessionLabel} — ${plan.inGameDate.trim()}`
    : plan.sessionLabel;
}

function renderPayoutPage(plan: PayoutPlan): string {
  const recipients = plan.actors.map(({ actor }) => actor.name).join(", ");
  const communalRows = plan.hqIpTransactions.map(({ amount, reason }) => [
    "HQ IP",
    formatAmount(amount),
    reason,
  ]);
  const primaryRows =
    plan.actors[0]?.entries
      .filter(({ scope }) => scope === "group")
      .map((entry) => entryRow(entry)) ?? [];
  const individualRows = plan.actors.flatMap(({ actor, entries }) =>
    entries
      .filter(({ scope }) => scope === "individual")
      .map((entry) => [actor.name, ...entryRow(entry)]),
  );

  return [
    metadata("In-Game Date", plan.inGameDate || "Not specified"),
    metadata("Recipients", recipients),
    metadata("Notes", plan.notes || "None"),
    "<h2>Communal Payout</h2>",
    table(["Type", "Amount", "Description"], communalRows),
    "<h2>Primary Payout</h2>",
    table(["Type", "Amount", "Description"], primaryRows),
    "<h2>Individual Payouts</h2>",
    table(["Actor", "Type", "Amount", "Description"], individualRows),
  ].join("");
}

function entryRow(entry: RewardEntry): string[] {
  const faction = entry.faction?.trim();
  return [
    `${rewardLabel(entry.reward)}${faction ? ` (${faction})` : ""}`,
    entry.formula ?? formatAmount(entry.amount),
    entry.description,
  ];
}

function metadata(label: string, value: string): string {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function table(headers: string[], rows: string[][]): string {
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${headers.length}"><em>None</em></td></tr>`;
  return `<table><tbody><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr>${body}</tbody></table>`;
}

function rewardLabel(reward: string): string {
  return (
    (
      {
        money: "Money",
        ip: "IP",
        humanityGain: "Gain Humanity",
        humanityLoss: "Lose Humanity",
        reputation: "Reputation",
        factionReputation: "Specific Reputation",
      } as Record<string, string>
    )[reward] ?? reward
  );
}

function formatAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : String(amount);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
