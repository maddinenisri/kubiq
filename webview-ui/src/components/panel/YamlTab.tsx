import { useState, useCallback, useEffect, useRef } from "react";
import { CopyButton, ValidationBadge, ValidationResults } from "../common";
import { postMessage } from "../../lib/vscode";

interface ValidationIssue {
  line: number;
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  fix?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

interface YamlTabProps {
  yaml: string;
}

export function YamlTab({ yaml }: YamlTabProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Listen for validation results
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data.type === "validationResult") {
        setValidation(event.data.result);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Validate on edit (debounced)
  useEffect(() => {
    if (!editing || !editValue.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      postMessage({ type: "validateYaml", yaml: editValue } as never);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editing, editValue]);

  // Validate on first view
  useEffect(() => {
    if (yaml && !editing) {
      postMessage({ type: "validateYaml", yaml } as never);
    }
  }, [yaml, editing]);

  const handleEdit = useCallback(() => {
    setEditValue(yaml);
    setEditing(true);
    setValidation(null);
  }, [yaml]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setValidation(null);
    // Re-validate the original
    if (yaml) postMessage({ type: "validateYaml", yaml } as never);
  }, [yaml]);

  const handleApply = useCallback(() => {
    if (validation && validation.errors.length > 0) return; // blocked
    postMessage({ type: "applyYaml", yaml: editValue });
    setEditing(false);
  }, [editValue, validation]);

  const errorCount = validation?.errors.length ?? 0;
  const warnCount = validation?.warnings.length ?? 0;
  const infoCount = validation?.infos.length ?? 0;
  const allIssues = [
    ...(validation?.errors ?? []),
    ...(validation?.warnings ?? []),
    ...(validation?.infos ?? []),
  ];

  // Apply button label
  let applyLabel = "Apply";
  let applyDisabled = false;
  if (errorCount > 0) {
    applyLabel = `Fix ${errorCount} error${errorCount > 1 ? "s" : ""} to apply`;
    applyDisabled = true;
  } else if (warnCount > 0) {
    applyLabel = `Apply (${warnCount} warning${warnCount > 1 ? "s" : ""})`;
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", padding: 14 }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <div>
          {validation && (
            <ValidationBadge errors={errorCount} warnings={warnCount} infos={infoCount} />
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
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
                disabled={applyDisabled}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 11,
                  border: `1px solid ${applyDisabled ? "#f05a5a" : "#4af0c8"}`,
                  color: applyDisabled ? "#f05a5a" : "#4af0c8",
                  background: "transparent",
                  cursor: applyDisabled ? "not-allowed" : "pointer",
                  opacity: applyDisabled ? 0.7 : 1,
                }}
              >
                {applyLabel}
              </button>
              <button
                onClick={handleCancel}
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
      </div>

      {/* Validation results */}
      {allIssues.length > 0 && (
        <div style={{ maxHeight: 150, overflow: "auto", flexShrink: 0, marginBottom: 8 }}>
          <ValidationResults issues={allIssues} />
        </div>
      )}

      {/* Editor / Viewer */}
      {editing ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            background: "#13161d",
            border: `1px solid ${errorCount > 0 ? "#f05a5a" : warnCount > 0 ? "#f0a84a" : "#4af0c8"}`,
            borderRadius: 4,
            padding: 14,
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
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
            overflow: "auto",
            background: "#13161d",
            border: "1px solid #252a38",
            borderRadius: 4,
            padding: 14,
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            fontSize: 11.5,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "#c8cfe0",
          }}
        >
          {yaml || "(no YAML available)"}
        </pre>
      )}
    </div>
  );
}
