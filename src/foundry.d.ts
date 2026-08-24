/** Minimal globals used by this starter. Add full Foundry typings as the module grows. */
declare const Hooks: {
  on(
    event: "getSceneControlButtons",
    callback: (controls: SceneControl[]) => void,
  ): number;
  once(event: "init" | "ready", callback: () => void | Promise<void>): number;
};

interface ApplicationOptions {
  id?: string;
  classes?: string[];
  title?: string;
  template?: string;
  width?: number;
  height?: number | "auto";
  resizable?: boolean;
  closeOnSubmit?: boolean;
  submitOnChange?: boolean;
}

interface FoundryHtml {
  0?: HTMLElement;
}

declare abstract class FormApplication {
  static get defaultOptions(): ApplicationOptions;
  render(force?: boolean): this;
  getData(): object;
  activateListeners(html: FoundryHtml): void;
  protected abstract _updateObject(
    event: Event,
    formData: Record<string, unknown>,
  ): Promise<void>;
}

interface SceneControlTool {
  name: string;
  title: string;
  icon: string;
  button: boolean;
  visible: boolean;
  onClick: () => void;
}

interface SceneControl {
  name: string;
  tools: SceneControlTool[];
}

interface FoundrySettingConfig {
  name: string;
  hint?: string;
  scope: "client" | "world";
  config: boolean;
  type: ObjectConstructor;
  default: object;
}

interface FoundryModule {
  api?: unknown;
}

interface FoundryActor {
  id: string;
  name: string;
  type: string;
  testUserPermission(user: FoundryUser, permission: "OWNER"): boolean;
}

interface FoundryUser {
  id: string;
  name: string;
  isGM: boolean;
  active: boolean;
  character: FoundryActor | null;
}

declare const game: {
  user: FoundryUser | null;
  users: Iterable<FoundryUser>;
  actors: Iterable<FoundryActor>;
  modules: Map<string, FoundryModule>;
  settings: {
    register(
      namespace: string,
      key: string,
      config: FoundrySettingConfig,
    ): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  };
};

declare const ui: {
  notifications: {
    warn(message: string): void;
  };
};
