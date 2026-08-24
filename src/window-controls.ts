import { MODULE_ID } from "./constants";
import { PayoutWindow } from "./payout-window";

let payoutWindow: PayoutWindow | null = null;

export function openPayoutWindow(): void {
  if (!game.user?.isGM) {
    ui.notifications.warn("Only a GM can open Pneuma's Payouts.");
    return;
  }

  payoutWindow ??= new PayoutWindow();
  payoutWindow.render(true);
}

export function registerPayoutWindowControl(): void {
  Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
    if (!game.user?.isGM) return;

    const tokenControls = controls.find(({ name }) => name === "token");
    if (!tokenControls) return;

    tokenControls.tools.push({
      name: MODULE_ID,
      title: "Open Pneuma's Payouts",
      icon: "fas fa-coins",
      button: true,
      visible: true,
      onClick: openPayoutWindow,
    });
  });
}
