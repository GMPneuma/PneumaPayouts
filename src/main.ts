import "./styles/pneuma-payouts.css";
import { pneumaPayoutsApi } from "./api";
import { MODULE_ID } from "./constants";
import { registerPayoutLedger } from "./payout-ledger";
import { registerPayoutWindowControl } from "./window-controls";

// Foundry v12 requests scene controls before the init hook fires, so this
// listener must be registered as soon as the module script is evaluated.
registerPayoutWindowControl();

Hooks.once("init", () => {
  console.info(`${MODULE_ID} | Initializing`);

  registerPayoutLedger();

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = pneumaPayoutsApi;
});

Hooks.once("ready", () => {
  console.info(`${MODULE_ID} | Ready`);
});
