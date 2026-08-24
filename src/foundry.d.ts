/** Minimal globals used by this starter. Add full Foundry typings as the module grows. */
declare const Hooks: {
  once(event: "init" | "ready", callback: () => void | Promise<void>): number;
};
