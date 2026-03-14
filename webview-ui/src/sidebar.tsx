import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

function SidebarApp() {
  return (
    <div style={{ padding: 16, textAlign: "center" }}>
      <div style={{ color: "var(--kubiq-accent)", fontSize: 32 }}>⬡</div>
      <h2 style={{ marginTop: 8 }}>Kubiq</h2>
      <p style={{ color: "var(--kubiq-dim)", marginTop: 8, fontSize: 12 }}>
        React 19 sidebar — ready for migration
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidebarApp />
  </StrictMode>,
);
