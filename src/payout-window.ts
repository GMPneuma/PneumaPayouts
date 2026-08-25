import { MODULE_ID } from "./constants";
import {
  buildDiscordMarkdown,
  getDiscordLinks,
  showDiscordSummary,
} from "./discord-summary";
import {
  executePayoutPlan,
  planActorChanges,
  type CharacterReward,
  type PayoutPlan,
  type RewardEntry,
} from "./payout-execution";
import { getPayoutJournalData } from "./payout-journal";
import type { PayoutChange } from "./payout-record";
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
  #additionalEntryIndex = 0;
  #individualEntryIndex = 0;
  #plan: PayoutPlan | null = null;
  #submitting = false;

  static override get defaultOptions(): ApplicationOptions {
    return {
      ...super.defaultOptions,
      id: `${MODULE_ID}-window`,
      classes: [...(super.defaultOptions.classes ?? []), MODULE_ID],
      title: "Pneuma's Payouts",
      template: `modules/${MODULE_ID}/templates/payout-window.hbs`,
      width: 900,
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
          if (input.checked) {
            this.#selectOnlyActorInRow(input);
            this.#deduplicateActor(root, input);
          }
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
      .querySelector<HTMLButtonElement>("[data-preview-step]")
      ?.addEventListener("click", () => void this.#goToPreview(root));
    root
      .querySelector<HTMLButtonElement>("[data-preview-back]")
      ?.addEventListener("click", () => this.#showStep(root, "rewards"));
    root
      .querySelector<HTMLButtonElement>("[data-apply-payout]")
      ?.addEventListener("click", () => void this.#applyPayout(root));

    root.addEventListener("input", () => {
      this.#plan = null;
    });

    root
      .querySelector<HTMLButtonElement>("[data-add-entry]")
      ?.addEventListener("click", () => this.#addAdditionalEntry(root));
    root
      .querySelector<HTMLElement>("[data-additional-entries]")
      ?.addEventListener("click", (event) => this.#removeEntry(event));
    root
      .querySelector<HTMLElement>("[data-additional-entries]")
      ?.addEventListener("change", (event) => this.#syncEntryControls(event));

    root
      .querySelector<HTMLElement>("[data-individual-payouts]")
      ?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const addButton = target.closest<HTMLButtonElement>(
          "[data-add-individual-entry]",
        );
        if (addButton) this.#addIndividualEntry(root, addButton);
        else this.#removeEntry(event);
      });
    root
      .querySelector<HTMLElement>("[data-individual-payouts]")
      ?.addEventListener("change", (event) => this.#syncEntryControls(event));

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

    if (selectedActors.length !== selectedPlayers) {
      ui.notifications.warn(
        "Every selected player must have exactly one Actor selected.",
      );
      return;
    }

    const sessionSummary = root.querySelector<HTMLElement>(
      "[data-session-summary]",
    );
    if (sessionSummary) sessionSummary.textContent = sessionLabel.value.trim();

    const recipients = root.querySelector<HTMLElement>("[data-recipient-list]");
    if (recipients)
      recipients.textContent = selectedActors
        .map((actor) => actor.dataset.actorName ?? actor.value)
        .join(", ");

    this.#populateIndividualPayouts(root, selectedActors);

    this.#showStep(root, "rewards");
  }

  #populateIndividualPayouts(
    root: HTMLElement,
    selectedActors: HTMLInputElement[],
  ): void {
    const container = root.querySelector<HTMLElement>(
      "[data-individual-payouts]",
    );
    const template = root.querySelector<HTMLTemplateElement>(
      "[data-individual-row-template]",
    );
    if (!container || !template) return;

    const existingRows = new Map(
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-individual-row]"),
      ).map((row) => [row.dataset.actorId, row]),
    );

    const rows = selectedActors.flatMap((actor) => {
      const actorId = actor.dataset.actorId;
      if (!actorId) return [];

      const existing = existingRows.get(actorId);
      if (existing) return [existing];

      const row = template.content.firstElementChild?.cloneNode(
        true,
      ) as HTMLElement | null;
      if (!row) return [];

      row.dataset.actorId = actorId;
      const actorName = actor.dataset.actorName ?? actorId;
      const heading = row.querySelector<HTMLElement>(
        "[data-individual-actor-name]",
      );
      if (heading) heading.textContent = actorName;

      return [row];
    });

    container.replaceChildren(...rows);
  }

  #addAdditionalEntry(root: HTMLElement): void {
    const container = root.querySelector<HTMLElement>(
      "[data-additional-entries]",
    );
    const template = root.querySelector<HTMLTemplateElement>(
      "[data-additional-entry-template]",
    );
    if (!container || !template) return;

    const entry = template.content.firstElementChild?.cloneNode(
      true,
    ) as HTMLElement | null;
    if (!entry) return;

    const index = this.#additionalEntryIndex++;
    entry
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-additional-field]",
      )
      .forEach((field) => {
        const name = field.dataset.additionalField;
        if (name) field.name = `additional.${index}.${name}`;
      });

    container.append(entry);
  }

  #addIndividualEntry(root: HTMLElement, button: HTMLButtonElement): void {
    const row = button.closest<HTMLElement>("[data-individual-row]");
    const container = row?.querySelector<HTMLElement>(
      "[data-individual-entries]",
    );
    const template = root.querySelector<HTMLTemplateElement>(
      "[data-individual-entry-template]",
    );
    const actorId = row?.dataset.actorId;
    if (!container || !template || !actorId) return;

    const entry = template.content.firstElementChild?.cloneNode(
      true,
    ) as HTMLElement | null;
    if (!entry) return;

    const index = this.#individualEntryIndex++;
    entry
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-entry-field]",
      )
      .forEach((field) => {
        const name = field.dataset.entryField;
        if (name) field.name = `individual.${actorId}.${index}.${name}`;
      });
    container.append(entry);
  }

  #removeEntry(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    target
      .closest<HTMLButtonElement>("[data-remove-entry]")
      ?.closest<HTMLElement>("[data-payout-entry]")
      ?.remove();
  }

  #syncEntryControls(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const entry = target.closest<HTMLElement>("[data-payout-entry]");
    if (!entry) return;

    const type = entry.querySelector<HTMLSelectElement>("[data-entry-type]");
    const mode = entry.querySelector<HTMLSelectElement>("[data-entry-mode]");
    const amount = entry.querySelector<HTMLInputElement>("[data-entry-amount]");
    const faction = entry.querySelector<HTMLInputElement>(
      "[data-entry-faction]",
    );
    if (!type || !mode || !amount) return;

    const humanity =
      type.value === "humanityGain" || type.value === "humanityLoss";
    mode.hidden = !humanity;
    mode.disabled = !humanity;
    amount.disabled = humanity && mode.value !== "fixed";
    amount.placeholder = humanity && mode.value !== "fixed" ? "Dice" : "Amount";
    if (faction) {
      const specificReputation = type.value === "specificReputation";
      faction.hidden = !specificReputation;
      faction.disabled = !specificReputation;
    }
  }

  async #goToPreview(root: HTMLElement): Promise<void> {
    try {
      this.#plan = await this.#buildPlan(root);
    } catch (error) {
      ui.notifications.warn(this.#errorMessage(error));
      return;
    }
    const sessionLabel = root.querySelector<HTMLInputElement>(
      '[name="sessionLabel"]',
    );
    const notes = root.querySelector<HTMLTextAreaElement>('[name="notes"]');
    const selectedActors = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        "[data-actor-toggle]:checked:not(:disabled)",
      ),
    );

    this.#setText(root, "[data-preview-session]", sessionLabel?.value.trim());
    this.#setText(
      root,
      "[data-preview-recipients]",
      selectedActors
        .map((actor) => actor.dataset.actorName ?? actor.value)
        .join(", "),
    );
    this.#setText(root, "[data-preview-notes]", notes?.value.trim() || "None");

    const groupList = root.querySelector<HTMLElement>("[data-preview-group]");
    if (groupList) {
      const items: HTMLElement[] = [];
      const primaryFields = [
        ["Money", "groupMoney", "groupMoneyDescription"],
        ["IP", "groupIp", "groupIpDescription"],
      ] as const;
      for (const [label, amountName, descriptionName] of primaryFields) {
        const amount = root.querySelector<HTMLInputElement>(
          `[name="${amountName}"]`,
        )?.value;
        const description = root.querySelector<HTMLInputElement>(
          `[name="${descriptionName}"]`,
        )?.value;
        if (Number(amount) !== 0)
          items.push(
            this.#createPreviewItem(label, amount ?? "0", description),
          );
      }
      root
        .querySelectorAll<HTMLElement>(
          "[data-additional-entries] [data-payout-entry]",
        )
        .forEach((entry) => items.push(this.#previewItemFromEntry(entry)));
      groupList.replaceChildren(...items);
      groupList.classList.toggle("preview-list--empty", items.length === 0);
      if (items.length === 0)
        groupList.textContent = "No group payouts entered.";
    }

    const individualPreview = root.querySelector<HTMLElement>(
      "[data-preview-individual]",
    );
    if (individualPreview) {
      const cards = this.#plan.actors.flatMap(({ actor }) => {
        const changes = this.#plan?.changes.filter(
          ({ targetId }) => targetId === actor.id,
        );
        if (!changes?.length) return [];
        const card = document.createElement("article");
        card.className = "preview-recipient";
        const heading = document.createElement("strong");
        const icon = document.createElement("i");
        icon.className = "fas fa-user";
        heading.append(icon, ` ${actor.name}`);
        const list = document.createElement("ul");
        list.className = "preview-list";
        list.append(
          ...changes.map((change) =>
            this.#createPreviewItem(
              this.#rewardLabel(change.reward),
              change.details?.pendingPlayerRoll
                ? `${String(change.details.formula)} — pending player roll`
                : `${change.previousValue} → ${change.newValue}`,
              String(change.details?.description ?? ""),
            ),
          ),
        );
        card.append(heading, list);
        return [card];
      });
      individualPreview.replaceChildren(...cards);
      individualPreview.classList.toggle(
        "preview-list--empty",
        cards.length === 0,
      );
      if (cards.length === 0)
        individualPreview.textContent = "No individual payouts entered.";
    }

    this.#showStep(root, "preview");
  }

  async #buildPlan(root: HTMLElement): Promise<PayoutPlan> {
    const journalData = getPayoutJournalData();
    const sessionLabel = root
      .querySelector<HTMLInputElement>('[name="sessionLabel"]')
      ?.value.trim();
    if (!sessionLabel) throw new Error("A session label is required.");

    const groupEntries: RewardEntry[] = [];
    const primary = [
      ["money", "groupMoney", "groupMoneyDescription"],
      ["ip", "groupIp", "groupIpDescription"],
    ] as const;
    for (const [reward, amountName, descriptionName] of primary) {
      const amount = Number(
        root.querySelector<HTMLInputElement>(`[name="${amountName}"]`)?.value,
      );
      if (!Number.isSafeInteger(amount))
        throw new Error(`${reward} must be a whole number.`);
      if (amount !== 0)
        groupEntries.push({
          reward,
          amount,
          description:
            root.querySelector<HTMLInputElement>(`[name="${descriptionName}"]`)
              ?.value ?? "",
        });
    }
    for (const entry of root.querySelectorAll<HTMLElement>(
      "[data-additional-entries] [data-payout-entry]",
    ))
      groupEntries.push(this.#readRewardEntry(entry));

    const actors: PayoutPlan["actors"] = [];
    const humanityPrompts: PayoutPlan["humanityPrompts"] = [];
    const factionReputations: PayoutPlan["factionReputations"] = [];
    const journalChanges: PayoutChange[] = [];
    for (const selected of root.querySelectorAll<HTMLInputElement>(
      "[data-actor-toggle]:checked:not(:disabled)",
    )) {
      const actorId = selected.dataset.actorId;
      const actor = actorId ? game.actors.get(actorId) : undefined;
      const playerRow = selected.closest<HTMLElement>("[data-player-row]");
      const userId = playerRow?.dataset.userId;
      const user = Array.from(game.users).find(({ id }) => id === userId);
      if (!actor || actor.type !== "character" || !user)
        throw new Error("A selected recipient is missing or unsupported.");
      const row = Array.from(
        root.querySelectorAll<HTMLElement>("[data-individual-row]"),
      ).find(({ dataset }) => dataset.actorId === actor.id);
      const individualEntries = Array.from(
        row?.querySelectorAll<HTMLElement>("[data-payout-entry]") ?? [],
      ).map((entry) => this.#readRewardEntry(entry));
      const entries = [...groupEntries, ...individualEntries];
      actors.push({
        actor,
        participant: {
          userId: user.id,
          userName: user.name,
          actorId: actor.id,
          actorName: actor.name,
        },
        entries,
      });
      for (const entry of entries) {
        if (entry.reward === "factionReputation") {
          const faction = entry.faction ?? "";
          const previous = journalData.factionReputations.find(
            (record) =>
              record.actorId === actor.id &&
              record.faction.toLocaleLowerCase() ===
                faction.toLocaleLowerCase(),
          );
          factionReputations.push({
            actorId: actor.id,
            actorName: actor.name,
            reputation: entry.amount,
            faction,
            reason: entry.description,
          });
          journalChanges.push({
            reward: "factionReputation",
            targetType: "journal",
            targetId: actor.id,
            targetName: actor.name,
            amount: entry.amount - (previous?.reputation ?? 0),
            previousValue: previous?.reputation ?? 0,
            newValue: entry.amount,
            details: { faction, description: entry.description },
          });
          continue;
        }
        if (!entry.formula) continue;
        if (entry.reward !== "humanityGain" && entry.reward !== "humanityLoss")
          throw new Error("Only Humanity entries can use dice.");
        humanityPrompts.push({
          actorId: actor.id,
          actorName: actor.name,
          userId: user.id,
          reward: entry.reward,
          formula: entry.formula,
          description: entry.description,
        });
      }
    }
    if (!actors.length) throw new Error("Select at least one recipient.");
    for (const { participant } of actors) {
      const previous =
        journalData.attendance.find(
          ({ userId }) => userId === participant.userId,
        )?.sessions ?? 0;
      journalChanges.push({
        reward: "attendance",
        targetType: "user",
        targetId: participant.userId,
        targetName: participant.userName,
        amount: 1,
        previousValue: previous,
        newValue: previous + 1,
      });
    }
    return {
      sessionLabel,
      notes:
        root.querySelector<HTMLTextAreaElement>('[name="notes"]')?.value ?? "",
      actors,
      changes: [...actors.flatMap(planActorChanges), ...journalChanges],
      humanityPrompts,
      factionReputations,
    };
  }

  #readRewardEntry(entry: HTMLElement): RewardEntry {
    const type =
      entry.querySelector<HTMLSelectElement>("[data-entry-type]")?.value;
    const reward =
      type === "newReputation"
        ? "reputation"
        : type === "specificReputation"
          ? "factionReputation"
          : type;
    if (!this.#isCharacterReward(reward))
      throw new Error("Invalid reward type.");
    const mode = entry.querySelector<HTMLSelectElement>("[data-entry-mode]");
    const formula =
      mode && !mode.disabled && mode.value !== "fixed" ? mode.value : undefined;
    const amount = Number(
      entry.querySelector<HTMLInputElement>("[data-entry-amount]")?.value,
    );
    if (!formula && !Number.isSafeInteger(amount))
      throw new Error(`${this.#rewardLabel(reward)} must be a whole number.`);
    if ((reward === "humanityGain" || reward === "humanityLoss") && amount < 0)
      throw new Error("Humanity amounts cannot be negative.");
    if (reward === "reputation" && amount < 0)
      throw new Error("New Reputation cannot be negative.");
    const faction = entry
      .querySelector<HTMLInputElement>("[data-entry-faction]")
      ?.value.trim();
    if (reward === "factionReputation" && !faction)
      throw new Error("Specific Reputation requires a faction name.");
    return {
      reward,
      amount: formula ? 0 : amount,
      formula,
      faction,
      setValue: reward === "reputation",
      description:
        entry.querySelector<HTMLInputElement>('input[type="text"]')?.value ??
        "",
    };
  }

  async #applyPayout(root: HTMLElement): Promise<void> {
    if (this.#submitting) {
      ui.notifications.warn(
        "This payout is already being applied. Wait for it to finish before trying again.",
      );
      return;
    }
    if (!this.#plan) {
      ui.notifications.warn("Preview the payout again before applying it.");
      return;
    }
    const button = root.querySelector<HTMLButtonElement>("[data-apply-payout]");
    this.#submitting = true;
    if (button) button.disabled = true;
    try {
      const plan = this.#plan;
      const discordLinks = getDiscordLinks();
      await executePayoutPlan(plan);
      ui.notifications.info("Payout applied and recorded successfully.");
      await this.close();
      showDiscordSummary(buildDiscordMarkdown(plan, discordLinks));
    } catch (error) {
      ui.notifications.error(
        `Payout failed and was rolled back: ${this.#errorMessage(error)}`,
      );
      this.#submitting = false;
      if (button) button.disabled = false;
    }
  }

  #isCharacterReward(value: unknown): value is CharacterReward {
    return [
      "money",
      "ip",
      "humanityGain",
      "humanityLoss",
      "reputation",
      "factionReputation",
    ].includes(String(value));
  }

  #rewardLabel(reward: string): string {
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

  #errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  #previewItemFromEntry(entry: HTMLElement): HTMLLIElement {
    const type = entry.querySelector<HTMLSelectElement>("[data-entry-type]");
    const amount = entry.querySelector<HTMLInputElement>("[data-entry-amount]");
    const mode = entry.querySelector<HTMLSelectElement>("[data-entry-mode]");
    const description =
      entry.querySelector<HTMLInputElement>('input[type="text"]');
    const amountText =
      mode && !mode.disabled && mode.value !== "fixed"
        ? mode.value
        : amount?.value || "0";
    return this.#createPreviewItem(
      type?.selectedOptions[0]?.textContent ?? "Payout",
      amountText,
      description?.value,
    );
  }

  #createPreviewItem(
    label: string,
    amount: string,
    description?: string,
  ): HTMLLIElement {
    const item = document.createElement("li");
    const labelElement = document.createElement("span");
    labelElement.className = "preview-item-label";
    labelElement.textContent = label;
    const amountElement = document.createElement("strong");
    amountElement.className = "preview-item-amount";
    amountElement.textContent = amount;
    const descriptionElement = document.createElement("span");
    descriptionElement.className = "preview-item-description";
    descriptionElement.textContent = description?.trim() || "No description";
    item.append(labelElement, amountElement, descriptionElement);
    return item;
  }

  #setText(root: HTMLElement, selector: string, value?: string): void {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value ?? "";
  }

  #showStep(
    root: HTMLElement,
    step: "participants" | "rewards" | "preview",
  ): void {
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

  #selectOnlyActorInRow(selected: HTMLInputElement): void {
    selected
      .closest<HTMLElement>("[data-player-row]")
      ?.querySelectorAll<HTMLInputElement>("[data-actor-toggle]")
      .forEach((actor) => {
        if (actor !== selected) actor.checked = false;
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
