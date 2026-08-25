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
  awards: PayoutAcknowledgmentAward[];
}

export interface PayoutAcknowledgmentAward {
  text: string;
  img?: string;
  icon?: string;
}

interface InboxData {
  pendingRolls: Array<PendingHumanityRoll & { actionLabel: string }>;
  acknowledgments: PayoutAcknowledgment[];
  hasItems: boolean;
  isGM: boolean;
  gmActionsEnabled: boolean;
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
  void pruneResolvedAcknowledgments()
    .catch(() =>
      ui.notifications.warn("Older Inbox entries could not be cleaned up."),
    )
    .finally(() => {
      if (!payoutInbox?.rendered) payoutInbox = new PayoutInbox();
      payoutInbox.render(true);
    });
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
      const retainedEntries = entries.filter(
        ({ acknowledgedAt }) => !acknowledgedAt,
      );
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
  #gmActionsEnabled = false;

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
    const isGM = Boolean(game.user?.isGM);
    const pendingRolls = collectPendingRolls().map((roll) => ({
      ...roll,
      actionLabel:
        roll.reward === "humanityGain" ? "Gain Humanity" : "Lose Humanity",
    }));
    const acknowledgments = collectAcknowledgments()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
    return {
      pendingRolls,
      acknowledgments,
      hasItems: pendingRolls.length + acknowledgments.length > 0,
      isGM,
      gmActionsEnabled: this.#gmActionsEnabled,
    };
  }

  override activateListeners(html: FoundryHtml): void {
    super.activateListeners(html);
    const root = html[0];
    if (!root) return;
    const gmActionsToggle = root.querySelector<HTMLInputElement>(
      "[data-enable-gm-actions]",
    );
    const playerActionButtons = root.querySelectorAll<HTMLButtonElement>(
      "[data-player-inbox-action]",
    );
    if (game.user?.isGM)
      playerActionButtons.forEach((button) => {
        button.disabled = !this.#gmActionsEnabled;
      });
    if (gmActionsToggle) {
      gmActionsToggle.checked = this.#gmActionsEnabled;
      gmActionsToggle.addEventListener("change", (event) => {
        this.#gmActionsEnabled = (
          event.currentTarget as HTMLInputElement
        ).checked;
        playerActionButtons.forEach((button) => {
          button.disabled = !this.#gmActionsEnabled;
        });
      });
    }
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
    if (!this.#playerActionAllowed()) return;
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
    if (!this.#playerActionAllowed()) return;
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
      [`flags.${MODULE_ID}.payoutAcknowledgments`]: entries.filter(
        ({ id, acknowledgedAt }) => id !== acknowledgmentId && !acknowledgedAt,
      ),
    });
    ui.notifications.info("Payout acknowledged.");
    this.render(true);
  }

  #playerActionAllowed(): boolean {
    if (!game.user?.isGM || this.#gmActionsEnabled) return true;
    ui.notifications.warn(
      "Enable GM controls at the top of the Inbox to act for a player.",
    );
    return false;
  }
}

function collectPendingRolls(): PendingHumanityRoll[] {
  return Array.from(game.actors).flatMap((actor) =>
    getPendingHumanityRolls(actor).filter(
      ({ userId }) => game.user?.isGM || game.user?.id === userId,
    ),
  );
}

function collectAcknowledgments(): PayoutAcknowledgment[] {
  return Array.from(game.users).flatMap((user) => {
    if (!game.user?.isGM && game.user?.id !== user.id) return [];
    return getAcknowledgments(user).filter(
      ({ acknowledgedAt }) => !acknowledgedAt,
    );
  });
}

async function pruneResolvedAcknowledgments(): Promise<void> {
  const users = game.user?.isGM
    ? Array.from(game.users)
    : game.user
      ? [game.user]
      : [];
  await Promise.all(
    users.map(async (user) => {
      const entries = getAcknowledgments(user);
      const pending = entries.filter(({ acknowledgedAt }) => !acknowledgedAt);
      if (pending.length === entries.length) return;
      await user.update({
        [`flags.${MODULE_ID}.payoutAcknowledgments`]: pending,
      });
    }),
  );
}

function getAcknowledgments(user: FoundryUser): PayoutAcknowledgment[] {
  const value = user.getFlag(MODULE_ID, "payoutAcknowledgments");
  return Array.isArray(value)
    ? value.filter(isAcknowledgment).map((entry) => ({
        ...structuredClone(entry),
        awards: Array.isArray(entry.awards)
          ? entry.awards.map((award) =>
              typeof award === "string"
                ? { text: award, icon: iconForAwardText(award) }
                : isAcknowledgmentAward(award)
                  ? {
                      ...structuredClone(award),
                      icon:
                        award.icon ??
                        (award.img ? undefined : iconForAwardText(award.text)),
                    }
                  : { text: "Payout detail unavailable." },
            )
          : [
              {
                text: "Payout details unavailable for this older acknowledgment.",
              },
            ],
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

function isAcknowledgmentAward(
  value: unknown,
): value is PayoutAcknowledgmentAward {
  if (typeof value !== "object" || value === null) return false;
  const award = value as Record<string, unknown>;
  return (
    typeof award.text === "string" &&
    (award.img === undefined || typeof award.img === "string") &&
    (award.icon === undefined || typeof award.icon === "string")
  );
}

function formatPayoutChange(
  change: PayoutPlan["changes"][number],
): PayoutAcknowledgmentAward {
  const labels: Record<string, string> = {
    money: "Money",
    ip: "IP",
    hqIp: "HQ IP",
    humanityGain: "Humanity Gain",
    humanityLoss: "Humanity Loss",
    reputation: "Reputation",
    factionReputation: "Specific Reputation",
    item: "Item",
    downtime: "Downtime",
  };
  const faction = String(change.details?.faction ?? "").trim();
  const description = String(change.details?.description ?? "").trim();
  const result =
    change.reward === "item"
      ? `×${change.amount}`
      : change.reward === "downtime"
        ? `${change.amount} ${Math.abs(change.amount) === 1 ? "day" : "days"}`
        : change.details?.pendingPlayerRoll
          ? `${String(change.details.formula)} — pending roll`
          : `${change.previousValue} → ${change.newValue} (${change.amount >= 0 ? "+" : ""}${change.amount})`;
  const label =
    change.reward === "item"
      ? `Item: ${String(change.details?.itemName ?? "Unknown")}`
      : `${labels[change.reward] ?? change.reward}${faction ? ` (${faction})` : ""}`;
  return {
    text: `${label}: ${result}${description ? ` — ${description}` : ""}`,
    ...(change.reward === "item" && typeof change.details?.img === "string"
      ? { img: change.details.img }
      : { icon: iconForReward(change.reward) }),
  };
}

function iconForReward(reward: string): string {
  return (
    {
      money: "fas fa-coins",
      ip: "fas fa-star",
      hqIp: "fas fa-building",
      humanityGain: "fas fa-heart",
      humanityLoss: "fas fa-heart-crack",
      reputation: "fas fa-medal",
      factionReputation: "fas fa-flag",
      downtime: "fas fa-clock",
      item: "fas fa-box-open",
    }[reward] ?? "fas fa-circle"
  );
}

function iconForAwardText(text: string): string {
  const label = text.split(":", 1)[0]?.trim().toLowerCase() ?? "";
  if (label.startsWith("money")) return iconForReward("money");
  if (label.startsWith("hq ip")) return iconForReward("hqIp");
  if (label === "ip") return iconForReward("ip");
  if (label.startsWith("humanity gain")) return iconForReward("humanityGain");
  if (label.startsWith("humanity loss")) return iconForReward("humanityLoss");
  if (label.startsWith("specific reputation"))
    return iconForReward("factionReputation");
  if (label.startsWith("reputation")) return iconForReward("reputation");
  if (label.startsWith("downtime")) return iconForReward("downtime");
  if (label.startsWith("item")) return iconForReward("item");
  return "fas fa-circle";
}
