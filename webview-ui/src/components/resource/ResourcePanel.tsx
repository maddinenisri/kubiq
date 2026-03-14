import { useState, useCallback } from "react";
import { CopyButton } from "../common";
import { postMessage } from "../../lib/vscode";

interface ResourcePanelProps {
  kind: string;
  name: string;
  namespace: string;
  context: string;
}

export function ResourcePanel({ kind, name, namespace, context }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState("describe");
  const [describe, setDescribe] = useState("Loading…");
  const [yaml, setYaml] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Listen for data from extension host
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "resourceData") {
      setDescribe(msg.describe || "(no output)");
      setYaml(msg.yaml || "");
    }
    if (msg.type === "applySuccess") {
      setYaml(editValue);
      setEditing(false);
    }
  });

  const handleEdit = useCallback(() => {
    setEditValue(yaml);
    setEditing(true);
  }, [yaml]);

  const handleApply = useCallback(() => {
    postMessage({ type: "applyYaml", yaml: editValue });
  }, [editValue]);

  return (
    <>
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "#13161d",
          borderBottom: "1px solid #252a38",
        }}
      >
        <span style={{ color: "#4af0c8", fontSize: 16 }}>⬡</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8ecf8" }}>{name}</span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontFamily: "monospace",
            background: "#1a2235",
            border: "1px solid #2a3a5a",
            color: "#3a7bd5",
          }}
        >
          {kind}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontFamily: "monospace",
            background: "#1e2235",
            border: "1px solid #2e3448",
            color: "#7a85b0",
          }}
        >
          {namespace}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontFamily: "monospace",
            background: "#1e2235",
            border: "1px solid #2e3448",
            color: "#5a6380",
          }}
        >
          {context}
        </span>
      </header>

      {/* Tabs */}
      <nav
        style={{
          display: "flex",
          background: "#13161d",
          borderBottom: "1px solid #252a38",
        }}
      >
        {["describe", ...(yaml ? ["yaml"] : [])].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: activeTab === tab ? "#4af0c8" : "#5a6380",
              padding: "9px 18px",
              fontSize: 12,
              fontWeight: 500,
              borderBottom: `2px solid ${activeTab === tab ? "#4af0c8" : "transparent"}`,
            }}
          >
            {tab === "describe" ? "Describe" : "YAML"}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column" }}>
        {activeTab === "describe" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <CopyButton text={describe} />
            </div>
            <pre
              style={{
                flex: 1,
                background: "#13161d",
                border: "1px solid #252a38",
                borderRadius: 4,
                padding: 14,
                fontFamily: "monospace",
                fontSize: 11.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#c8cfe0",
              }}
            >
              {describe}
            </pre>
          </>
        )}

        {activeTab === "yaml" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
              <CopyButton text={editing ? editValue : yaml} label="Copy YAML" />
              {!editing ? (
                <button
                  onClick={handleEdit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 11,
                    background: "#1a1e28",
                    border: "1px solid #2e3448",
                    color: "#5a6380",
                    cursor: "pointer",
                  }}
                >
                  ✎ Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleApply}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 11,
                      border: "1px solid #4af0c8",
                      color: "#4af0c8",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "#1a1e28",
                      border: "1px solid #2e3448",
                      color: "#5a6380",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {editing ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1,
                  background: "#13161d",
                  border: "1px solid #4af0c8",
                  borderRadius: 4,
                  padding: 14,
                  fontFamily: "monospace",
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  color: "#c8cfe0",
                  resize: "none",
                  outline: "none",
                  whiteSpace: "pre",
                  overflow: "auto",
                  tabSize: 2,
                }}
              />
            ) : (
              <pre
                style={{
                  flex: 1,
                  background: "#13161d",
                  border: "1px solid #252a38",
                  borderRadius: 4,
                  padding: 14,
                  fontFamily: "monospace",
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#c8cfe0",
                }}
              >
                {yaml}
              </pre>
            )}
          </>
        )}
      </div>
    </>
  );
}
