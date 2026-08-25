/** Minimal globals used by this starter. Add full Foundry typings as the module grows. */
declare const Hooks: {
  on(
    event: "getSceneControlButtons",
    callback: (controls: SceneControl[]) => void,
  ): number;
  once(event: "init" | "ready", callback: () => void | Promise<void>): number;
  on(
    event: "renderChatMessage",
    callback: (message: FoundryChatMessage, html: FoundryHtml) => void,
  ): number;
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
  close(): Promise<void>;
  getData(): object;
  activateListeners(html: FoundryHtml): void;
  close(): Promise<void>;
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
  system: unknown;
  testUserPermission(user: FoundryUser, permission: "OWNER"): boolean;
  update(data: Record<string, unknown>): Promise<unknown>;
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
  actors: Iterable<FoundryActor> & {
    get(id: string): FoundryActor | undefined;
  };
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
    info(message: string): void;
    error(message: string): void;
  };
};

declare class Roll {
  constructor(formula: string);
  total: number;
  evaluate(): Promise<Roll>;
}

interface FoundryChatMessage {
  getFlag(namespace: string, key: string): unknown;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

declare const ChatMessage: {
  create(data: Record<string, unknown>): Promise<FoundryChatMessage>;
};
