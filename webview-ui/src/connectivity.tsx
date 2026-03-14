import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectivityPanel } from "./components/connectivity/ConnectivityPanel";
import "./index.css";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <ConnectivityPanel
      sourcePod={root.dataset.sourcePod ?? ""}
      sourceNamespace={root.dataset.sourceNamespace ?? ""}
      targetService={root.dataset.targetService ?? ""}
      targetNamespace={root.dataset.targetNamespace ?? ""}
    />
  </StrictMode>,
);
