import { MODULE_ID } from "./constants";

export interface HumanityPrompt {
  actorId: string;
  actorName: string;
  userId: string;
  reward: "humanityGain" | "humanityLoss";
  formula: string;
  description: string;
}

interface HumanityPromptFlags extends HumanityPrompt {
  resolved: boolean;
}

export function registerHumanityPromptHandler(): void {
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html[0];
    const button = root?.querySelector<HTMLButtonElement>(
      "[data-pneuma-humanity-roll]",
    );
    if (!button) return;
    const flags = message.getFlag(MODULE_ID, "humanityPrompt");
    if (
      !isPromptFlags(flags) ||
      flags.resolved ||
      game.user?.id !== flags.userId
    ) {
      button.disabled = true;
      return;
    }
    button.addEventListener(
      "click",
      () => void resolvePrompt(message, button, flags),
    );
  });
}

export async function createHumanityPrompt(
  prompt: HumanityPrompt,
): Promise<FoundryChatMessage> {
  const action = prompt.reward === "humanityGain" ? "gain" : "lose";
  const description = escapeHtml(prompt.description || "Pneuma payout");
  return ChatMessage.create({
    user: prompt.userId,
    whisper: [prompt.userId],
    content: `<div class="pneuma-humanity-prompt"><p><strong>${escapeHtml(prompt.actorName)}</strong> must roll <strong>${prompt.formula}</strong> to ${action} Humanity.</p><p>${description}</p><button type="button" data-pneuma-humanity-roll><i class="fas fa-dice-d6"></i> Roll Humanity</button></div>`,
    flags: {
      [MODULE_ID]: {
        humanityPrompt: { ...prompt, resolved: false },
      },
    },
  });
}

async function resolvePrompt(
  message: FoundryChatMessage,
  button: HTMLButtonElement,
  prompt: HumanityPromptFlags,
): Promise<void> {
  button.disabled = true;
  let updatedActor: FoundryActor | null = null;
  let previousHumanity: number | null = null;
  try {
    const actor = game.actors.get(prompt.actorId);
    if (!actor) throw new Error("The payout Actor no longer exists.");
    const roll = await new Roll(prompt.formula).evaluate();
    const humanity = readHumanity(actor);
    updatedActor = actor;
    previousHumanity = humanity.value;
    const signed = prompt.reward === "humanityGain" ? roll.total : -roll.total;
    const newValue = Math.min(humanity.max, humanity.value + signed);
    await actor.update({
      "system.derivedStats.humanity.value": newValue,
      "system.stats.emp.value": Math.floor(newValue / 10),
    });
    await message.update({
      content: `<div class="pneuma-humanity-prompt pneuma-humanity-prompt--resolved"><p><strong>${escapeHtml(actor.name)}</strong> rolled <strong>${roll.total}</strong> (${prompt.formula}).</p><p>Humanity: <strong>${humanity.value} → ${newValue}</strong></p><p>${escapeHtml(prompt.description)}</p></div>`,
      [`flags.${MODULE_ID}.humanityPrompt.resolved`]: true,
    });
  } catch (error) {
    if (updatedActor && previousHumanity !== null) {
      await updatedActor
        .update({
          "system.derivedStats.humanity.value": previousHumanity,
          "system.stats.emp.value": Math.floor(previousHumanity / 10),
        })
        .catch(() => undefined);
    }
    button.disabled = false;
    ui.notifications.error(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function readHumanity(actor: FoundryActor): { value: number; max: number } {
  const system = actor.system as Record<string, any>;
  const humanity = system.derivedStats?.humanity;
  if (
    !humanity ||
    !Number.isFinite(humanity.value) ||
    !Number.isFinite(humanity.max)
  )
    throw new Error("The Actor has invalid Humanity data.");
  return { value: humanity.value, max: humanity.max };
}

function isPromptFlags(value: unknown): value is HumanityPromptFlags {
  if (typeof value !== "object" || value === null) return false;
  const flags = value as Record<string, unknown>;
  return (
    typeof flags.actorId === "string" &&
    typeof flags.userId === "string" &&
    typeof flags.formula === "string" &&
    typeof flags.resolved === "boolean"
  );
}

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
