import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ResourcePanel } from "./components/resource/ResourcePanel";
import "./index.css";

function ResourceApp() {
  const root = document.getElementById("root")!;
  const kind = root.dataset.kind ?? "";
  const name = root.dataset.name ?? "";
  const namespace = root.dataset.namespace ?? "";
  const context = root.dataset.context ?? "";

  return <ResourcePanel kind={kind} name={name} namespace={namespace} context={context} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ResourceApp />
  </StrictMode>,
);
