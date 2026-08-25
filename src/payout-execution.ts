import { appendPayoutRecord } from "./payout-ledger";
import { MODULE_ID } from "./constants";
import {
  applyPayoutToJournal,
  type FactionReputationRecord,
  type HqIpTransaction,
} from "./payout-journal";
import {
  createHumanityPrompt,
  createPendingHumanityRoll,
  getPendingHumanityRolls,
  type HumanityPrompt,
  type PendingHumanityRoll,
} from "./humanity-prompts";
import { createPayoutAcknowledgments } from "./payout-inbox";
import { appendPayoutLog } from "./payout-log";
import {
  createPayoutRecord,
  type PayoutChange,
  type PayoutParticipant,
  type PayoutRewardType,
} from "./payout-record";

export type CharacterReward =
  | "money"
  | "ip"
  | "humanityGain"
  | "humanityLoss"
  | "reputation"
  | "factionReputation";

export interface RewardEntry {
  reward: CharacterReward;
  amount: number;
  description: string;
  setValue?: boolean;
  formula?: string;
  faction?: string;
  scope: "group" | "individual";
}

export interface PayoutActorInput {
  actor: FoundryActor;
  participant: PayoutParticipant;
  entries: RewardEntry[];
}

export interface PayoutPlan {
  sessionLabel: string;
  inGameDate: string;
  notes: string;
  actors: PayoutActorInput[];
  changes: PayoutChange[];
  humanityPrompts: HumanityPrompt[];
  factionReputations: FactionReputationRecord[];
  hqIpTransactions: HqIpTransaction[];
}

interface ActorSnapshot {
  actor: FoundryActor;
  update: Record<string, unknown>;
}

const PATHS = {
  money: "wealth",
  ip: "improvementPoints",
  reputation: "reputation",
} as const;

export function planActorChanges(input: PayoutActorInput): PayoutChange[] {
  const actor = input.actor;
  const values = {
    money: numberAt(actor.system, "wealth.value"),
    ip: numberAt(actor.system, "improvementPoints.value"),
    humanity: numberAt(actor.system, "derivedStats.humanity.value"),
    humanityMax: numberAt(actor.system, "derivedStats.humanity.max"),
    reputation: numberAt(actor.system, "reputation.value"),
  };
  const changes: PayoutChange[] = [];

  for (const entry of input.entries) {
    if (entry.reward === "factionReputation") continue;
    if (entry.formula) {
      changes.push({
        reward: entry.reward as PayoutRewardType,
        targetType: "actor",
        targetId: actor.id,
        targetName: actor.name,
        amount: 0,
        previousValue: null,
        newValue: null,
        details: {
          description: entry.description,
          formula: entry.formula,
          pendingPlayerRoll: true,
          scope: entry.scope,
        },
      });
      continue;
    }
    let previousValue: number;
    let newValue: number;
    if (entry.reward === "humanityGain" || entry.reward === "humanityLoss") {
      previousValue = values.humanity;
      const signed =
        entry.reward === "humanityGain" ? entry.amount : -entry.amount;
      newValue = Math.min(values.humanityMax, previousValue + signed);
      values.humanity = newValue;
    } else {
      const key = entry.reward;
      previousValue = values[key];
      newValue = entry.setValue ? entry.amount : previousValue + entry.amount;
      values[key] = newValue;
    }
    changes.push({
      reward: entry.reward as PayoutRewardType,
      targetType: "actor",
      targetId: actor.id,
      targetName: actor.name,
      amount: newValue - previousValue,
      previousValue,
      newValue,
      details: {
        description: entry.description,
        formula: entry.formula ?? "",
        requestedAmount: entry.amount,
        scope: entry.scope,
      },
    });
  }
  return changes;
}

export async function executePayoutPlan(plan: PayoutPlan): Promise<void> {
  if (!game.user?.isGM) throw new Error("Only a GM can apply payouts.");
  const record = createPayoutRecord({
    createdByUserId: game.user.id,
    createdByUserName: game.user.name,
    sessionLabel: plan.sessionLabel,
    inGameDate: plan.inGameDate,
    notes: plan.notes,
    participants: plan.actors.map(({ participant }) => participant),
    changes: plan.changes,
  });
  const pendingRolls = plan.humanityPrompts.map((prompt) =>
    createPendingHumanityRoll(prompt, record.id),
  );
  const snapshots = plan.actors.map(createSnapshot);
  const updated: ActorSnapshot[] = [];
  const promptMessages: FoundryChatMessage[] = [];
  let rollbackJournal: (() => Promise<void>) | null = null;
  let rollbackAcknowledgments: (() => Promise<void>) | null = null;
  let rollbackPayoutLog: (() => Promise<void>) | null = null;
  try {
    for (const actorInput of plan.actors) {
      const changes = plan.changes.filter(
        ({ targetId }) => targetId === actorInput.actor.id,
      );
      await actorInput.actor.update(
        buildActorUpdate(
          actorInput.actor,
          changes,
          pendingRolls.filter(({ actorId }) => actorId === actorInput.actor.id),
          plan.sessionLabel,
        ),
      );
      const snapshot = snapshots.find(
        ({ actor }) => actor === actorInput.actor,
      );
      if (snapshot) updated.push(snapshot);
    }
    for (const prompt of pendingRolls)
      promptMessages.push(await createHumanityPrompt(prompt));
    rollbackJournal = await applyPayoutToJournal(plan);
    rollbackAcknowledgments = await createPayoutAcknowledgments(
      record.id,
      plan,
    );
    rollbackPayoutLog = await appendPayoutLog(plan);
    await appendPayoutRecord(record);
  } catch (error) {
    await Promise.allSettled(
      updated.map(({ actor, update }) => actor.update(update)),
    );
    if (rollbackJournal) await rollbackJournal().catch(() => undefined);
    if (rollbackAcknowledgments)
      await rollbackAcknowledgments().catch(() => undefined);
    if (rollbackPayoutLog) await rollbackPayoutLog().catch(() => undefined);
    await Promise.allSettled(promptMessages.map((message) => message.delete()));
    throw error;
  }
}

function buildActorUpdate(
  actor: FoundryActor,
  changes: PayoutChange[],
  pendingRolls: PendingHumanityRoll[],
  sessionLabel: string,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    [`flags.${MODULE_ID}.pendingHumanityRolls`]: [
      ...getPendingHumanityRolls(actor),
      ...pendingRolls,
    ],
  };
  for (const change of changes) {
    if (change.newValue === null) continue;
    if (change.reward === "humanityGain" || change.reward === "humanityLoss") {
      update["system.derivedStats.humanity.value"] = change.newValue;
      update["system.stats.emp.value"] = Math.floor(change.newValue / 10);
      continue;
    }
    const path = PATHS[change.reward as keyof typeof PATHS];
    if (!path) continue;
    update[`system.${path}.value`] = change.newValue;
    const transactions = structuredClone(
      arrayAt(actor.system, `${path}.transactions`),
    );
    for (const related of changes.filter(
      (item) => item.reward === change.reward,
    )) {
      const description = String(
        related.details?.description ?? "Pneuma payout",
      ).trim();
      const transactionDescription = `${sessionLabel.trim() || "Payout"} - ${description || "No description"}`;
      transactions.push([
        `${related.amount >= 0 ? "Increased" : "Decreased"} ${path} by ${Math.abs(related.amount)} (total ${related.newValue})`,
        transactionDescription,
      ]);
    }
    update[`system.${path}.transactions`] = transactions;
  }
  return update;
}

function createSnapshot(input: PayoutActorInput): ActorSnapshot {
  const actor = input.actor;
  return {
    actor,
    update: {
      "system.wealth": structuredClone(valueAt(actor.system, "wealth")),
      "system.improvementPoints": structuredClone(
        valueAt(actor.system, "improvementPoints"),
      ),
      "system.derivedStats.humanity": structuredClone(
        valueAt(actor.system, "derivedStats.humanity"),
      ),
      "system.stats.emp": structuredClone(valueAt(actor.system, "stats.emp")),
      "system.reputation": structuredClone(valueAt(actor.system, "reputation")),
      [`flags.${MODULE_ID}.pendingHumanityRolls`]:
        getPendingHumanityRolls(actor),
    },
  };
}

function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function numberAt(value: unknown, path: string): number {
  const result = valueAt(value, path);
  if (typeof result !== "number" || !Number.isFinite(result))
    throw new Error(`Actor is missing numeric system.${path}.`);
  return result;
}

function arrayAt(value: unknown, path: string): unknown[] {
  const result = valueAt(value, path);
  if (!Array.isArray(result))
    throw new Error(`Actor is missing system.${path}.`);
  return result;
}
