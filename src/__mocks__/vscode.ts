import { vi } from "vitest";

export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue: unknown) => defaultValue,
  }),
};

export const window = {
  createWebviewPanel: vi.fn(),
  registerWebviewViewProvider: vi.fn(),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  withProgress: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: "file" }),
  joinPath: (...args: string[]) => ({ fsPath: args.join("/") }),
};

export const ViewColumn = { One: 1 };
export const ProgressLocation = { Notification: 15 };

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
