import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionStateProvider } from "./context/ExtensionStateContext";
import { PodPanel } from "./components/panel/PodPanel";
import { postMessage } from "./lib/vscode";
import "./index.css";

function PanelApp() {
  // Read pod info from data attributes set by the extension host
  const root = document.getElementById("root")!;
  const podName = root.dataset.podName ?? "unknown";
  const namespace = root.dataset.namespace ?? "default";
  const context = root.dataset.context ?? "";

  return (
    <ExtensionStateProvider>
      <PodPanel podName={podName} namespace={namespace} context={context} />
    </ExtensionStateProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>,
);

// Signal ready to extension host
postMessage({ type: "ready" });
