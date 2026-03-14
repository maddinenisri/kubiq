import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TopologyPanel } from "./components/topology/TopologyPanel";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TopologyPanel />
  </StrictMode>,
);
