export interface DeckPrototype extends DeckInstance {
  __pyropeHooked?: boolean;
}

export interface DeckConstructor {
  new(): DeckInstance;
  prototype: DeckPrototype;
}

interface PyropeCommandBase {
  name: string;
  description?: string;
  args?: PyropeArgumentDefinition[];
  flags?: PyropeFlagDefinition[];
}

export interface PyropeExecutableCommand
  extends PyropeCommandBase {
  execute(
    context: PyropeCommandContext
  ): void | Promise<void>;

  subcommands?: never;
}

export interface PyropeCommandGroup
  extends PyropeCommandBase {
  subcommands: PyropeExecutableCommand[];

  execute?: never;
}


export type PyropeCommandDefinition =
  | PyropeExecutableCommand
  | PyropeCommandGroup;


export interface PyropeAPI {
  readonly color: string | null;
  readonly loadedPlugins: string[];

  init(): Promise<void>;
  isInitialized(): boolean;

  registerPlugin(plugin: PyropePlugin): Promise<void>;
  registerCommand(definition: PyropeCommandDefinition): void;

  executeCommand(input: string, deckId: string): boolean;

  getActiveDeckId(): string | null;

  print(message: string, options?: PyropePrintOptions): void;

  setColor(color: string): void;
  resetColor(): void;
}

export interface PyropePlugin {
  readonly name: string;
  init(pyrope: PyropeAPI): void | Promise<void>;
}


declare global {
  interface Window {
    MenuInventaire: MenuInventaireConstructor;
    Deck: () => DeckConstructor;
    pyrope: PyropeAPI;
  }
}

export { }