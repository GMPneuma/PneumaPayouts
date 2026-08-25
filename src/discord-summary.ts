import { DISCORD_LINKS_SETTING, MODULE_ID } from "./constants";
import type { PayoutPlan } from "./payout-execution";

export type DiscordLinks = Record<string, string>;

export function registerDiscordLinks(): void {
  game.settings.register(MODULE_ID, DISCORD_LINKS_SETTING, {
    name: "Discord User Links",
    hint: "Maps Foundry users to Discord user IDs for payout summaries.",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });
  game.settings.registerMenu(MODULE_ID, "discordLinksMenu", {
    name: "Discord Links",
    label: "Configure Discord Links",
    hint: "Link Foundry player accounts to Discord user IDs for mention-ready payout summaries.",
    icon: "fab fa-discord",
    type: DiscordLinksConfig,
    restricted: true,
  });
}

interface DiscordLinksConfigData {
  players: Array<{ userId: string; userName: string; discordUserId: string }>;
}

class DiscordLinksConfig extends FormApplication {
  static override get defaultOptions(): ApplicationOptions {
    return {
      ...super.defaultOptions,
      id: `${MODULE_ID}-discord-links`,
      title: "Pneuma's Payouts: Discord Links",
      template: `modules/${MODULE_ID}/templates/discord-links.hbs`,
      width: 520,
      height: "auto",
      closeOnSubmit: true,
    };
  }

  override getData(): DiscordLinksConfigData {
    const links = getDiscordLinks();
    return {
      players: Array.from(game.users)
        .filter(({ isGM }) => !isGM)
        .map(({ id, name }) => ({
          userId: id,
          userName: name,
          discordUserId: links[id] ?? "",
        })),
    };
  }

  protected override async _updateObject(
    _event: Event,
    formData: Record<string, unknown>,
  ): Promise<void> {
    const nested = formData.links;
    const values =
      typeof nested === "object" && nested !== null
        ? (nested as Record<string, unknown>)
        : Object.fromEntries(
            Object.entries(formData)
              .filter(([key]) => key.startsWith("links."))
              .map(([key, value]) => [key.slice(6), value]),
          );
    const links: DiscordLinks = {};
    for (const [userId, rawValue] of Object.entries(values)) {
      const discordId = String(rawValue ?? "").trim();
      if (!discordId) continue;
      if (!/^\d{15,22}$/.test(discordId))
        throw new Error("Discord User IDs must contain 15–22 digits.");
      links[userId] = discordId;
    }
    await setDiscordLinks(links);
    ui.notifications.info("Discord links saved.");
  }
}

export function getDiscordLinks(): DiscordLinks {
  const value = game.settings.get(MODULE_ID, DISCORD_LINKS_SETTING);
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function setDiscordLinks(links: DiscordLinks): Promise<void> {
  await game.settings.set(MODULE_ID, DISCORD_LINKS_SETTING, links);
}

export function buildDiscordMarkdown(
  plan: PayoutPlan,
  links: DiscordLinks,
): string {
  const lines = [`## ${plan.sessionLabel}`, ""];
  if (plan.notes.trim()) lines.push(plan.notes.trim(), "");
  for (const { actor, participant } of plan.actors) {
    const mention = links[participant.userId]
      ? `<@${links[participant.userId]}>`
      : participant.userName;
    lines.push(`### ${mention} — ${actor.name}`);
    const changes = plan.changes.filter(
      ({ targetId }) => targetId === actor.id,
    );
    if (!changes.length) lines.push("- No character payout changes");
    for (const change of changes) {
      const description = String(change.details?.description ?? "").trim();
      const result = change.details?.pendingPlayerRoll
        ? `${String(change.details.formula)} (player roll pending)`
        : `${change.previousValue} → ${change.newValue} (${formatAdjustment(change.amount)})`;
      const faction = String(change.details?.faction ?? "").trim();
      lines.push(
        `- **${rewardLabel(change.reward)}${faction ? ` (${faction})` : ""}:** ${result}${description ? ` — ${description}` : ""}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function showDiscordSummary(markdown: string): void {
  const content = document.createElement("div");
  content.className = "discord-summary-dialog";
  const intro = document.createElement("p");
  intro.textContent = "Copy this summary into Discord:";
  const textarea = document.createElement("textarea");
  textarea.rows = 16;
  textarea.readOnly = true;
  textarea.value = markdown;
  textarea.textContent = markdown;
  content.append(intro, textarea);

  new Dialog({
    title: "Discord payout summary",
    content: content.outerHTML,
    buttons: {
      copy: {
        icon: '<i class="fas fa-copy"></i>',
        label: "Copy Markdown",
        callback: (html) => {
          const value =
            html[0]?.querySelector<HTMLTextAreaElement>("textarea")?.value;
          if (!value) return;
          void navigator.clipboard.writeText(value).then(
            () => ui.notifications.info("Discord payout summary copied."),
            () =>
              ui.notifications.warn(
                "Copy failed. Select the text and copy it manually.",
              ),
          );
        },
      },
    },
    default: "copy",
  }).render(true);
}

function formatAdjustment(amount: number): string {
  return amount >= 0 ? `+${amount}` : String(amount);
}

function rewardLabel(reward: string): string {
  return (
    (
      {
        money: "Money",
        ip: "IP",
        humanityGain: "Humanity Gain",
        humanityLoss: "Humanity Loss",
        reputation: "Reputation",
      } as Record<string, string>
    )[reward] ?? reward
  );
}
