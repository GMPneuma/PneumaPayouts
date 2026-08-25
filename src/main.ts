import "./styles/pneuma-payouts.css";
import { pneumaPayoutsApi } from "./api";
import { MODULE_ID } from "./constants";
import { registerDiscordLinks } from "./discord-summary";
import { registerPayoutLedger } from "./payout-ledger";
import {
  ensurePayoutJournal,
  registerPayoutJournalSettings,
} from "./payout-journal";
import { registerHumanityPromptHandler } from "./humanity-prompts";
import { registerPayoutWindowControl } from "./window-controls";

// Foundry v12 requests scene controls before the init hook fires, so this
// listener must be registered as soon as the module script is evaluated.
registerPayoutWindowControl();
registerHumanityPromptHandler();

Hooks.once("init", () => {
  console.info(`${MODULE_ID} | Initializing`);

  registerPayoutLedger();
  registerDiscordLinks();
  registerPayoutJournalSettings();

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = pneumaPayoutsApi;
});

Hooks.once("ready", () => {
  console.info(`${MODULE_ID} | Ready`);
  if (game.user?.isGM) void ensurePayoutJournal();
});
