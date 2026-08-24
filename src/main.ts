import "./styles/pneuma-payouts.css";

const MODULE_ID = "pneuma-payouts";

Hooks.once("init", () => {
  console.info(`${MODULE_ID} | Initializing`);
});

Hooks.once("ready", () => {
  console.info(`${MODULE_ID} | Ready`);
});
