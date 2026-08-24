import { appendPayoutRecord, getPayoutLedger } from "./payout-ledger";
import { createPayoutRecord } from "./payout-record";
import { discoverPlayerAccounts } from "./player-discovery";
import { openPayoutWindow } from "./window-controls";

export const pneumaPayoutsApi = Object.freeze({
  createPayoutRecord,
  getPayoutLedger,
  appendPayoutRecord,
  discoverPlayerAccounts,
  openPayoutWindow,
});

export type PneumaPayoutsApi = typeof pneumaPayoutsApi;
