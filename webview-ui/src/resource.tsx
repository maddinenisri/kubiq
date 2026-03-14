import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

function ResourceApp() {
  return (
    <div style={{ padding: 16, textAlign: "center" }}>
      <div style={{ color: "var(--kubiq-accent)", fontSize: 32 }}>⬡</div>
      <h2 style={{ marginTop: 8 }}>Resource Detail</h2>
      <p style={{ color: "var(--kubiq-dim)", marginTop: 8, fontSize: 12 }}>
        React 19 resource panel — ready for migration
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ResourceApp />
  </StrictMode>,
);
