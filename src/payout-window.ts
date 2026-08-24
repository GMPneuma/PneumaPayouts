import { MODULE_ID } from "./constants";
import {
  discoverPlayerAccounts,
  type PlayerAccount,
  type PlayerDiscoveryIssue,
} from "./player-discovery";

interface ActorOptionView {
  actorId: string;
  actorName: string;
  assigned: boolean;
  selected: boolean;
  shared: boolean;
}

interface PlayerView {
  userId: string;
  userName: string;
  active: boolean;
  presenceClass: string;
  presenceLabel: string;
  selected: boolean;
  eligible: boolean;
  eligibilityClass: string;
  actors: ActorOptionView[];
  warnings: string[];
}

interface PayoutWindowData {
  players: PlayerView[];
  playerCount: number;
  activePlayerCount: number;
}

const ISSUE_LABELS: Record<PlayerDiscoveryIssue, string> = {
  noAssignedActor: "No default character assigned.",
  noEligibleActors: "No owned character Actors are eligible for payout.",
  unsupportedAssignedActorType:
    "The assigned Actor is not a Cyberpunk RED character.",
  sharedActor: "One or more Actors are shared with another player.",
};

export class PayoutWindow extends FormApplication {
  static override get defaultOptions(): ApplicationOptions {
    return {
      ...super.defaultOptions,
      id: `${MODULE_ID}-window`,
      classes: [...(super.defaultOptions.classes ?? []), MODULE_ID],
      title: "Pneuma's Payouts",
      template: `modules/${MODULE_ID}/templates/payout-window.hbs`,
      width: 720,
      height: "auto",
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
    };
  }

  override getData(): PayoutWindowData {
    const accounts = discoverPlayerAccounts();

    return {
      players: accounts.map(toPlayerView),
      playerCount: accounts.length,
      activePlayerCount: accounts.filter(({ active }) => active).length,
    };
  }

  override activateListeners(html: FoundryHtml): void {
    super.activateListeners(html);

    const root = html[0];
    if (!root) return;

    this.#initializeSelection(root);

    root
      .querySelectorAll<HTMLInputElement>("[data-user-toggle]")
      .forEach((input) =>
        input.addEventListener("change", () => {
          this.#syncUserRow(input);
          this.#updateSelectionSummary(root);
        }),
      );

    root
      .querySelectorAll<HTMLInputElement>("[data-actor-toggle]")
      .forEach((input) =>
        input.addEventListener("change", () => {
          if (input.checked) this.#deduplicateActor(root, input);
          this.#updateSelectionSummary(root);
        }),
      );

    this.#updateSelectionSummary(root);
  }

  protected override async _updateObject(
    _event: Event,
    _formData: Record<string, unknown>,
  ): Promise<void> {
    // Reward fields and preview are introduced in the next roadmap items.
  }

  #initializeSelection(root: HTMLElement): void {
    root
      .querySelectorAll<HTMLInputElement>("[data-user-toggle]")
      .forEach((userToggle) => {
        userToggle.checked = userToggle.dataset.selected === "true";
        userToggle.disabled = userToggle.dataset.eligible !== "true";
      });

    root
      .querySelectorAll<HTMLInputElement>("[data-actor-toggle]")
      .forEach((actorToggle) => {
        actorToggle.checked = actorToggle.dataset.selected === "true";
        const row = actorToggle.closest<HTMLElement>("[data-player-row]");
        const userToggle =
          row?.querySelector<HTMLInputElement>("[data-user-toggle]");
        actorToggle.disabled = !userToggle?.checked;
      });
  }

  #syncUserRow(userToggle: HTMLInputElement): void {
    const row = userToggle.closest<HTMLElement>("[data-player-row]");
    if (!row) return;

    const actorToggles = Array.from(
      row.querySelectorAll<HTMLInputElement>("[data-actor-toggle]"),
    );

    for (const actorToggle of actorToggles) {
      actorToggle.disabled = !userToggle.checked;
    }

    if (userToggle.checked && !actorToggles.some(({ checked }) => checked)) {
      const defaultActor =
        actorToggles.find((actor) => actor.dataset.assigned === "true") ??
        actorToggles[0];
      if (defaultActor) defaultActor.checked = true;
    }
  }

  #deduplicateActor(root: HTMLElement, selected: HTMLInputElement): void {
    const actorId = selected.dataset.actorId;
    if (!actorId) return;

    root
      .querySelectorAll<HTMLInputElement>("[data-actor-toggle]")
      .forEach((actorToggle) => {
        if (
          actorToggle !== selected &&
          actorToggle.dataset.actorId === actorId
        ) {
          actorToggle.checked = false;
        }
      });
  }

  #updateSelectionSummary(root: HTMLElement): void {
    const selectedPlayers = root.querySelectorAll(
      "[data-user-toggle]:checked",
    ).length;
    const selectedActorIds = new Set(
      Array.from(
        root.querySelectorAll<HTMLInputElement>(
          "[data-actor-toggle]:checked:not(:disabled)",
        ),
      ).map(({ value }) => value),
    );
    const summary = root.querySelector<HTMLElement>("[data-selection-summary]");

    if (summary) {
      summary.textContent = `${selectedPlayers} player${selectedPlayers === 1 ? "" : "s"}, ${selectedActorIds.size} Actor${selectedActorIds.size === 1 ? "" : "s"} selected`;
    }
  }
}

function toPlayerView(account: PlayerAccount): PlayerView {
  const selected = account.active && account.eligible;
  const defaultActor =
    account.actors.find(({ assigned }) => assigned) ?? account.actors[0];

  return {
    userId: account.userId,
    userName: account.userName,
    active: account.active,
    presenceClass: account.active ? "presence--active" : "",
    presenceLabel: account.active ? "Online" : "Offline",
    selected,
    eligible: account.eligible,
    eligibilityClass: account.eligible ? "" : "participant--ineligible",
    actors: account.actors.map((actor) => ({
      actorId: actor.actorId,
      actorName: actor.actorName,
      assigned: actor.assigned,
      selected: selected && actor.actorId === defaultActor?.actorId,
      shared: actor.sharedWithUserIds.length > 0,
    })),
    warnings: account.issues.map((issue) => ISSUE_LABELS[issue]),
  };
}
