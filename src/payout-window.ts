import { MODULE_ID } from "./constants";
import {
  discoverPlayerAccounts,
  type PlayerAccount,
  type PlayerDiscoveryIssue,
} from "./player-discovery";

interface ActorOptionView {
  actorId: string;
  actorName: string;
  primary: boolean;
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
  defaultActor: ActorOptionView | null;
  otherActors: ActorOptionView[];
  hasOtherActors: boolean;
  warningText: string;
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

    root
      .querySelectorAll<HTMLButtonElement>("[data-show-other-actors]")
      .forEach((button) =>
        button.addEventListener("click", () => this.#toggleOtherActors(button)),
      );

    root
      .querySelector<HTMLButtonElement>("[data-next-step]")
      ?.addEventListener("click", () => this.#goToRewards(root));
    root
      .querySelector<HTMLButtonElement>("[data-previous-step]")
      ?.addEventListener("click", () => this.#showStep(root, "participants"));

    root
      .querySelectorAll<HTMLSelectElement>("[data-humanity-mode]")
      .forEach((select) => {
        this.#syncHumanityMode(select);
        select.addEventListener("change", () => this.#syncHumanityMode(select));
      });

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

    const selectedActorIds = new Set<string>();
    root
      .querySelectorAll<HTMLInputElement>("[data-actor-toggle]:checked")
      .forEach((actorToggle) => {
        const actorId = actorToggle.dataset.actorId;
        if (!actorId) return;
        if (selectedActorIds.has(actorId)) actorToggle.checked = false;
        else selectedActorIds.add(actorId);
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
        actorToggles.find((actor) => actor.dataset.primary === "true") ??
        actorToggles[0];
      if (defaultActor) defaultActor.checked = true;
    }
  }

  #toggleOtherActors(button: HTMLButtonElement): void {
    const row = button.closest<HTMLElement>("[data-player-row]");
    const otherActors = row?.querySelector<HTMLElement>("[data-other-actors]");
    if (!otherActors) return;

    otherActors.hidden = !otherActors.hidden;
    button.textContent = otherActors.hidden
      ? "Show other actors"
      : "Hide other actors";
    button.setAttribute("aria-expanded", String(!otherActors.hidden));
  }

  #goToRewards(root: HTMLElement): void {
    const sessionLabel = root.querySelector<HTMLInputElement>(
      '[name="sessionLabel"]',
    );
    const selectedActors = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        "[data-actor-toggle]:checked:not(:disabled)",
      ),
    );
    const selectedPlayers = root.querySelectorAll(
      "[data-user-toggle]:checked",
    ).length;

    if (!sessionLabel?.value.trim()) {
      ui.notifications.warn("Enter a session label before continuing.");
      sessionLabel?.focus();
      return;
    }

    if (selectedPlayers === 0 || selectedActors.length === 0) {
      ui.notifications.warn(
        "Select at least one player and one Actor before continuing.",
      );
      return;
    }

    const sessionSummary = root.querySelector<HTMLElement>(
      "[data-session-summary]",
    );
    if (sessionSummary) sessionSummary.textContent = sessionLabel.value.trim();

    const recipients = root.querySelector<HTMLUListElement>(
      "[data-recipient-list]",
    );
    if (recipients) {
      recipients.replaceChildren(
        ...selectedActors.map((actor) => {
          const item = document.createElement("li");
          item.textContent = actor.dataset.actorName ?? actor.value;
          return item;
        }),
      );
    }

    this.#showStep(root, "rewards");
  }

  #showStep(root: HTMLElement, step: "participants" | "rewards"): void {
    root.querySelectorAll<HTMLElement>("[data-step-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.stepPanel !== step;
    });
    root
      .querySelectorAll<HTMLElement>("[data-step-indicator]")
      .forEach((indicator) => {
        indicator.classList.toggle(
          "wizard-step--active",
          indicator.dataset.stepIndicator === step,
        );
      });
  }

  #syncHumanityMode(select: HTMLSelectElement): void {
    const field = select.closest<HTMLElement>("[data-humanity-field]");
    const manualInput = field?.querySelector<HTMLInputElement>(
      "[data-humanity-manual]",
    );
    if (!manualInput) return;

    manualInput.disabled = select.value !== "manual";
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
  const selected = account.eligible;
  const defaultActor =
    account.actors.find(({ assigned }) => assigned) ?? account.actors[0];
  const actorViews = account.actors.map((actor) => ({
    actorId: actor.actorId,
    actorName: actor.actorName,
    primary: actor.actorId === defaultActor?.actorId,
    selected: actor.actorId === defaultActor?.actorId,
    shared: actor.sharedWithUserIds.length > 0,
  }));
  const primaryActor =
    actorViews.find(({ actorId }) => actorId === defaultActor?.actorId) ?? null;
  const otherActors = actorViews.filter(({ primary }) => !primary);

  return {
    userId: account.userId,
    userName: account.userName,
    active: account.active,
    presenceClass: account.active ? "presence--active" : "",
    presenceLabel: account.active ? "Online" : "Offline",
    selected,
    eligible: account.eligible,
    eligibilityClass: account.eligible ? "" : "participant--ineligible",
    defaultActor: primaryActor,
    otherActors,
    hasOtherActors: otherActors.length > 0,
    warningText: account.issues.map((issue) => ISSUE_LABELS[issue]).join(" "),
  };
}
