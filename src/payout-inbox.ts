import { MODULE_ID, PAYOUT_ACKNOWLEDGMENTS_ENABLED_SETTING } from "./constants";
import {
  getPendingHumanityRolls,
  resolvePendingHumanityRoll,
  resolvedContent,
  type PendingHumanityRoll,
} from "./humanity-prompts";
import type { PayoutPlan } from "./payout-execution";

export interface PayoutAcknowledgment {
  id: string;
  payoutRecordId: string;
  sessionLabel: string;
  userId: string;
  userName: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  acknowledgedAt: string | null;
  awards: string[];
}

interface InboxData {
  pendingRolls: Array<PendingHumanityRoll & { actionLabel: string }>;
  acknowledgments: Array<
    PayoutAcknowledgment & { pending: boolean; statusLabel: string }
  >;
  hasItems: boolean;
  isGM: boolean;
}

let payoutInbox: PayoutInbox | null = null;

export function registerPayoutInboxSettings(): void {
  game.settings.register(MODULE_ID, PAYOUT_ACKNOWLEDGMENTS_ENABLED_SETTING, {
    name: "Require payout acknowledgment",
    hint: "Add completed payouts to each recipient's Payout Inbox until they confirm receipt. Acknowledgment does not approve or alter the payout.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}

export function openPayoutInbox(): void {
  if (!payoutInbox?.rendered) payoutInbox = new PayoutInbox();
  payoutInbox.render(true);
}

export function hasInboxItemsForCurrentUser(): boolean {
  return (
    collectPendingRolls().length > 0 || collectAcknowledgments().length > 0
  );
}

export async function createPayoutAcknowledgments(
  payoutRecordId: string,
  plan: PayoutPlan,
): Promise<() => Promise<void>> {
  if (
    game.settings.get(MODULE_ID, PAYOUT_ACKNOWLEDGMENTS_ENABLED_SETTING) ===
    false
  )
    return async () => undefined;
  const snapshots: Array<{
    user: FoundryUser;
    entries: PayoutAcknowledgment[];
  }> = [];
  try {
    for (const { actor, participant } of plan.actors) {
      const user = Array.from(game.users).find(
        ({ id }) => id === participant.userId,
      );
      if (!user) continue;
      const entries = getAcknowledgments(user);
      snapshots.push({ user, entries });
      const retainedEntries = [
        ...entries.filter(({ acknowledgedAt }) => !acknowledgedAt),
        ...entries.filter(({ acknowledgedAt }) => acknowledgedAt).slice(-50),
      ];
      await user.update({
        [`flags.${MODULE_ID}.payoutAcknowledgments`]: [
          ...retainedEntries,
          {
            id: crypto.randomUUID(),
            payoutRecordId,
            sessionLabel: plan.sessionLabel,
            userId: user.id,
            userName: user.name,
            actorId: actor.id,
            actorName: actor.name,
            createdAt: new Date().toISOString(),
            acknowledgedAt: null,
            awards: plan.changes
              .filter(({ targetId }) => targetId === actor.id)
              .map(formatPayoutChange),
          } satisfies PayoutAcknowledgment,
        ],
      });
    }
  } catch (error) {
    await rollbackAcknowledgments(snapshots);
    throw error;
  }
  return async () => rollbackAcknowledgments(snapshots);
}

class PayoutInbox extends FormApplication {
  static override get defaultOptions(): ApplicationOptions {
    return {
      ...super.defaultOptions,
      id: `${MODULE_ID}-inbox`,
      classes: [...(super.defaultOptions.classes ?? []), MODULE_ID],
      title: "Payout Inbox",
      template: `modules/${MODULE_ID}/templates/payout-inbox.hbs`,
      width: 650,
      height: "auto",
      resizable: true,
    };
  }

  override getData(): InboxData {
    const pendingRolls = collectPendingRolls().map((roll) => ({
      ...roll,
      actionLabel:
        roll.reward === "humanityGain" ? "Gain Humanity" : "Lose Humanity",
    }));
    const acknowledgments = collectAcknowledgments(Boolean(game.user?.isGM))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map((entry) => ({
        ...entry,
        pending: !entry.acknowledgedAt,
        statusLabel: entry.acknowledgedAt ? "Acknowledged" : "Pending",
      }));
    return {
      pendingRolls,
      acknowledgments,
      hasItems: pendingRolls.length + acknowledgments.length > 0,
      isGM: Boolean(game.user?.isGM),
    };
  }

  override activateListeners(html: FoundryHtml): void {
    super.activateListeners(html);
    const root = html[0];
    if (!root) return;
    root
      .querySelectorAll<HTMLButtonElement>("[data-roll-id]")
      .forEach((button) =>
        button.addEventListener("click", () => void this.#rollHumanity(button)),
      );
    root
      .querySelectorAll<HTMLButtonElement>("[data-ack-id]")
      .forEach((button) =>
        button.addEventListener("click", () => void this.#acknowledge(button)),
      );
  }

  protected override async _updateObject(): Promise<void> {}

  async #rollHumanity(button: HTMLButtonElement): Promise<void> {
    const actorId = button.dataset.actorId;
    const rollId = button.dataset.rollId;
    if (!actorId || !rollId) return;
    button.disabled = true;
    try {
      const result = await resolvePendingHumanityRoll(actorId, rollId);
      await updateRelatedChatMessages(
        result.prompt.id,
        resolvedContent(result),
      );
      ui.notifications.info(
        `${result.prompt.actorName} Humanity: ${result.previousHumanity} → ${result.newHumanity}`,
      );
      this.render(true);
    } catch (error) {
      button.disabled = false;
      ui.notifications.error(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async #acknowledge(button: HTMLButtonElement): Promise<void> {
    const userId = button.dataset.userId;
    const acknowledgmentId = button.dataset.ackId;
    const user = userId
      ? Array.from(game.users).find(({ id }) => id === userId)
      : undefined;
    if (!user || !acknowledgmentId) return;
    if (!game.user?.isGM && game.user?.id !== user.id) {
      ui.notifications.error("This acknowledgment belongs to another player.");
      return;
    }
    const entries = getAcknowledgments(user);
    await user.update({
      [`flags.${MODULE_ID}.payoutAcknowledgments`]: entries.map((entry) =>
        entry.id === acknowledgmentId
          ? { ...entry, acknowledgedAt: new Date().toISOString() }
          : entry,
      ),
    });
    ui.notifications.info("Payout acknowledged.");
    this.render(true);
  }
}

function collectPendingRolls(): PendingHumanityRoll[] {
  return Array.from(game.actors).flatMap((actor) =>
    getPendingHumanityRolls(actor).filter(
      ({ userId }) => game.user?.isGM || game.user?.id === userId,
    ),
  );
}

function collectAcknowledgments(
  includeResolved = false,
): PayoutAcknowledgment[] {
  return Array.from(game.users).flatMap((user) => {
    if (!game.user?.isGM && game.user?.id !== user.id) return [];
    return getAcknowledgments(user).filter(
      ({ acknowledgedAt }) => includeResolved || !acknowledgedAt,
    );
  });
}

function getAcknowledgments(user: FoundryUser): PayoutAcknowledgment[] {
  const value = user.getFlag(MODULE_ID, "payoutAcknowledgments");
  return Array.isArray(value)
    ? value.filter(isAcknowledgment).map((entry) => ({
        ...structuredClone(entry),
        awards: Array.isArray(entry.awards)
          ? entry.awards
          : ["Payout details unavailable for this older acknowledgment."],
      }))
    : [];
}

async function rollbackAcknowledgments(
  snapshots: Array<{ user: FoundryUser; entries: PayoutAcknowledgment[] }>,
): Promise<void> {
  await Promise.allSettled(
    snapshots.map(({ user, entries }) =>
      user.update({ [`flags.${MODULE_ID}.payoutAcknowledgments`]: entries }),
    ),
  );
}

async function updateRelatedChatMessages(
  rollId: string,
  content: string,
): Promise<void> {
  const messages = Array.from(game.messages).filter((message) => {
    const prompt = message.getFlag(MODULE_ID, "humanityPrompt");
    return (
      typeof prompt === "object" &&
      prompt !== null &&
      (prompt as Record<string, unknown>).id === rollId
    );
  });
  await Promise.allSettled(
    messages.map((message) => message.update({ content })),
  );
}

function isAcknowledgment(value: unknown): value is PayoutAcknowledgment {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.payoutRecordId === "string" &&
    typeof entry.userId === "string" &&
    (entry.acknowledgedAt === null || typeof entry.acknowledgedAt === "string")
  );
}

function formatPayoutChange(change: PayoutPlan["changes"][number]): string {
  const labels: Record<string, string> = {
    money: "Money",
    ip: "IP",
    humanityGain: "Humanity Gain",
    humanityLoss: "Humanity Loss",
    reputation: "Reputation",
    factionReputation: "Specific Reputation",
  };
  const faction = String(change.details?.faction ?? "").trim();
  const description = String(change.details?.description ?? "").trim();
  const result = change.details?.pendingPlayerRoll
    ? `${String(change.details.formula)} — pending roll`
    : `${change.previousValue} → ${change.newValue} (${change.amount >= 0 ? "+" : ""}${change.amount})`;
  return `${labels[change.reward] ?? change.reward}${faction ? ` (${faction})` : ""}: ${result}${description ? ` — ${description}` : ""}`;
}
