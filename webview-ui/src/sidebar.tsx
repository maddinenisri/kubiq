import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionStateProvider } from "./context/ExtensionStateContext";
import { Sidebar } from "./components/sidebar/Sidebar";
import { postMessage } from "./lib/vscode";
import "./index.css";

function SidebarApp() {
  return (
    <ExtensionStateProvider>
      <Sidebar />
    </ExtensionStateProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidebarApp />
  </StrictMode>,
);

// Signal ready to extension host — retry until acknowledged (handles race condition)
function signalInit() {
  postMessage({ type: "init" });
}
// Send immediately and retry after a delay in case the extension host isn't ready
signalInit();
setTimeout(signalInit, 500);
setTimeout(signalInit, 1500);
