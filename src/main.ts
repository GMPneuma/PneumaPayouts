import "./styles/pneuma-payouts.css";
import { pneumaPayoutsApi } from "./api";
import { MODULE_ID } from "./constants";
import { registerPayoutLedger } from "./payout-ledger";
import { registerPayoutWindowControl } from "./window-controls";

Hooks.once("init", () => {
  console.info(`${MODULE_ID} | Initializing`);

  registerPayoutLedger();
  registerPayoutWindowControl();

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = pneumaPayoutsApi;
});

Hooks.once("ready", () => {
  console.info(`${MODULE_ID} | Ready`);
});
