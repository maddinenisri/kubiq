import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsPanel />
  </StrictMode>,
);
