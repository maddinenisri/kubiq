import { useEffect } from "react";
import type { ExtensionMessage } from "@shared/messages";

/**
 * Hook that listens for messages from the extension host.
 * Calls the handler whenever a message of the specified type arrives.
 */
export function useExtensionMessage<T extends ExtensionMessage["type"]>(
  type: T,
  handler: (message: Extract<ExtensionMessage, { type: T }>) => void,
): void {
  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      if (event.data.type === type) {
        handler(event.data as Extract<ExtensionMessage, { type: T }>);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [type, handler]);
}

/**
 * Hook that listens for ALL messages from the extension host.
 */
export function useAllExtensionMessages(
  handler: (message: ExtensionMessage) => void,
): void {
  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      handler(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handler]);
}
