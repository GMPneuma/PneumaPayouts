import { appendPayoutRecord } from "./payout-ledger";
import { createHumanityPrompt, type HumanityPrompt } from "./humanity-prompts";
import {
  createPayoutRecord,
  type PayoutChange,
  type PayoutParticipant,
  type PayoutRewardType,
} from "./payout-record";

export type CharacterReward =
  "money" | "ip" | "humanityGain" | "humanityLoss" | "reputation";

export interface RewardEntry {
  reward: CharacterReward;
  amount: number;
  description: string;
  setValue?: boolean;
  formula?: string;
}

export interface PayoutActorInput {
  actor: FoundryActor;
  participant: PayoutParticipant;
  entries: RewardEntry[];
}

export interface PayoutPlan {
  sessionLabel: string;
  notes: string;
  actors: PayoutActorInput[];
  changes: PayoutChange[];
  humanityPrompts: HumanityPrompt[];
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
      },
    });
  }
  return changes;
}

export async function executePayoutPlan(plan: PayoutPlan): Promise<void> {
  if (!game.user?.isGM) throw new Error("Only a GM can apply payouts.");
  const snapshots = plan.actors.map(createSnapshot);
  const updated: ActorSnapshot[] = [];
  const promptMessages: FoundryChatMessage[] = [];
  try {
    for (const prompt of plan.humanityPrompts)
      promptMessages.push(await createHumanityPrompt(prompt));
    for (const actorInput of plan.actors) {
      const changes = plan.changes.filter(
        ({ targetId }) => targetId === actorInput.actor.id,
      );
      await actorInput.actor.update(
        buildActorUpdate(actorInput.actor, changes),
      );
      const snapshot = snapshots.find(
        ({ actor }) => actor === actorInput.actor,
      );
      if (snapshot) updated.push(snapshot);
    }
    await appendPayoutRecord(
      createPayoutRecord({
        createdByUserId: game.user.id,
        createdByUserName: game.user.name,
        sessionLabel: plan.sessionLabel,
        notes: plan.notes,
        participants: plan.actors.map(({ participant }) => participant),
        changes: plan.changes,
      }),
    );
  } catch (error) {
    await Promise.allSettled(
      updated.map(({ actor, update }) => actor.update(update)),
    );
    await Promise.allSettled(promptMessages.map((message) => message.delete()));
    throw error;
  }
}

function buildActorUpdate(
  actor: FoundryActor,
  changes: PayoutChange[],
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
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
      );
      transactions.push([
        `${related.amount >= 0 ? "Increased" : "Decreased"} ${path} by ${Math.abs(related.amount)} (total ${related.newValue})`,
        description,
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
