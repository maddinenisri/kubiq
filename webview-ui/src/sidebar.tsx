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

// Signal ready to extension host — single init, no retries
postMessage({ type: "init" });
