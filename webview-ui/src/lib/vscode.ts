import type { WebviewMessage } from "@shared/messages";

/**
 * Type-safe wrapper around VS Code's webview API.
 * acquireVsCodeApi() can only be called once per webview lifecycle.
 */

interface VsCodeApi {
  postMessage(message: WebviewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

// Declared by VS Code's webview runtime
declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

/** Send a typed message to the extension host */
export function postMessage(message: WebviewMessage): void {
  getVsCodeApi().postMessage(message);
}
