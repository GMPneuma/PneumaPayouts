import {
  MODULE_ID,
  PAYOUT_JOURNAL_DATA_SETTING,
  PAYOUT_JOURNAL_ID_SETTING,
} from "./constants";
import type { PayoutPlan } from "./payout-execution";

export interface HqImprovement {
  name: string;
  ipSpent: number;
}

export interface HqIpTransaction {
  date: string;
  amount: number;
  reason: string;
}

export interface FactionReputationRecord {
  actorId: string;
  actorName: string;
  reputation: number;
  faction: string;
  reason: string;
}

export interface AttendanceRecord {
  userId: string;
  userName: string;
  sessions: number;
}

export interface PayoutJournalData {
  hqImprovements: HqImprovement[];
  hqIpTransactions: HqIpTransaction[];
  factionReputations: FactionReputationRecord[];
  attendance: AttendanceRecord[];
}

const EMPTY_DATA: PayoutJournalData = {
  hqImprovements: [],
  hqIpTransactions: [],
  factionReputations: [],
  attendance: [],
};

export function registerPayoutJournalSettings(): void {
  game.settings.register(MODULE_ID, PAYOUT_JOURNAL_ID_SETTING, {
    name: "Payout Journal ID",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings.register(MODULE_ID, PAYOUT_JOURNAL_DATA_SETTING, {
    name: "Payout Journal Data",
    scope: "world",
    config: false,
    type: Object,
    default: EMPTY_DATA,
  });
}

export function getPayoutJournalData(): PayoutJournalData {
  const value = game.settings.get(MODULE_ID, PAYOUT_JOURNAL_DATA_SETTING);
  if (!isJournalData(value)) return structuredClone(EMPTY_DATA);
  return structuredClone(value);
}

export async function ensurePayoutJournal(): Promise<FoundryJournalEntry> {
  const storedId = game.settings.get(MODULE_ID, PAYOUT_JOURNAL_ID_SETTING);
  let journal =
    typeof storedId === "string" && storedId
      ? game.journal.get(storedId)
      : undefined;
  journal ??= Array.from(game.journal).find(({ name }) => name === "Payouts");
  if (!journal) {
    journal = await JournalEntry.create({
      name: "Payouts",
      pages: [
        textPage("HQ", renderHqPage(EMPTY_DATA), 100000),
        textPage("Player Reputation", renderReputationPage(EMPTY_DATA), 200000),
        textPage("Attendance", renderAttendancePage(EMPTY_DATA), 300000),
      ],
    });
  }
  const existingPages = new Set(
    Array.from(journal.pages).map(({ name }) => name),
  );
  const missingPages = [
    ["HQ", renderHqPage(EMPTY_DATA), 100000],
    ["Player Reputation", renderReputationPage(EMPTY_DATA), 200000],
    ["Attendance", renderAttendancePage(EMPTY_DATA), 300000],
  ].flatMap(([name, content, sort]) =>
    existingPages.has(String(name))
      ? []
      : [textPage(String(name), String(content), Number(sort))],
  );
  if (missingPages.length)
    await journal.createEmbeddedDocuments("JournalEntryPage", missingPages);
  await game.settings.set(MODULE_ID, PAYOUT_JOURNAL_ID_SETTING, journal.id);
  await renderPayoutJournal(journal, getPayoutJournalData());
  return journal;
}

export async function applyPayoutToJournal(
  plan: PayoutPlan,
): Promise<() => Promise<void>> {
  const journal = await ensurePayoutJournal();
  const previous = getPayoutJournalData();
  const updated = structuredClone(previous);

  for (const { participant } of plan.actors) {
    const existing = updated.attendance.find(
      ({ userId }) => userId === participant.userId,
    );
    if (existing) {
      existing.sessions += 1;
      existing.userName = participant.userName;
    } else {
      updated.attendance.push({
        userId: participant.userId,
        userName: participant.userName,
        sessions: 1,
      });
    }
  }

  for (const reputation of plan.factionReputations) {
    const index = updated.factionReputations.findIndex(
      ({ actorId, faction }) =>
        actorId === reputation.actorId &&
        faction.toLocaleLowerCase() === reputation.faction.toLocaleLowerCase(),
    );
    if (index >= 0) updated.factionReputations[index] = reputation;
    else updated.factionReputations.push(reputation);
  }

  try {
    await saveAndRender(journal, updated);
  } catch (error) {
    await saveAndRender(journal, previous).catch(() => undefined);
    throw error;
  }
  return async () => saveAndRender(journal, previous);
}

async function saveAndRender(
  journal: FoundryJournalEntry,
  data: PayoutJournalData,
): Promise<void> {
  await game.settings.set(MODULE_ID, PAYOUT_JOURNAL_DATA_SETTING, data);
  await renderPayoutJournal(journal, data);
}

async function renderPayoutJournal(
  journal: FoundryJournalEntry,
  data: PayoutJournalData,
): Promise<void> {
  const pages = new Map(
    Array.from(journal.pages).map((page) => [page.name, page]),
  );
  await Promise.all([
    pages
      .get("Player Reputation")
      ?.update({ "text.content": renderReputationPage(data) }),
    pages
      .get("Attendance")
      ?.update({ "text.content": renderAttendancePage(data) }),
  ]);
}

function renderHqPage(data: PayoutJournalData): string {
  return `<h1>HQ</h1><h2>Purchased Improvements</h2>${table(
    ["Improvement", "IP Spent"],
    data.hqImprovements.map(({ name, ipSpent }) => [name, String(ipSpent)]),
  )}<h2>HQ IP Journal</h2>${table(
    ["Date", "Adjustment", "Reason"],
    data.hqIpTransactions.map(({ date, amount, reason }) => [
      date,
      amount >= 0 ? `+${amount}` : String(amount),
      reason,
    ]),
  )}`;
}

function renderReputationPage(data: PayoutJournalData): string {
  return `<h1>Player Reputation</h1>${table(
    ["Actor", "Reputation", "Faction", "Reason"],
    data.factionReputations.map(
      ({ actorName, reputation, faction, reason }) => [
        actorName,
        String(reputation),
        faction,
        reason,
      ],
    ),
  )}`;
}

function renderAttendancePage(data: PayoutJournalData): string {
  return `<h1>Attendance</h1>${table(
    ["Player", "Sessions Played"],
    [...data.attendance]
      .sort(
        (a, b) =>
          a.sessions - b.sessions || a.userName.localeCompare(b.userName),
      )
      .map(({ userName, sessions }) => [userName, String(sessions)]),
  )}`;
}

function table(headers: string[], rows: string[][]): string {
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${headers.length}"><em>No entries yet.</em></td></tr>`;
  return `<table><thead><tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr></thead><tbody>${body}</tbody></table>`;
}

function textPage(name: string, content: string, sort: number): object {
  return { name, type: "text", sort, text: { content, format: 1 } };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isJournalData(value: unknown): value is PayoutJournalData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    Array.isArray(data.hqImprovements) &&
    Array.isArray(data.hqIpTransactions) &&
    Array.isArray(data.factionReputations) &&
    Array.isArray(data.attendance)
  );
}
