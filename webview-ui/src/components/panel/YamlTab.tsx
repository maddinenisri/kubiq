import { useState, useCallback } from "react";
import { CopyButton } from "../common";
import { postMessage } from "../../lib/vscode";

interface YamlTabProps {
  yaml: string;
}

export function YamlTab({ yaml }: YamlTabProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEdit = useCallback(() => {
    setEditValue(yaml);
    setEditing(true);
  }, [yaml]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleApply = useCallback(() => {
    postMessage({ type: "applyYaml", yaml: editValue });
    setEditing(false);
  }, [editValue]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-3.5">
      <div className="flex justify-end gap-1.5 mb-2 shrink-0">
        <CopyButton text={editing ? editValue : yaml} label="Copy YAML" />
        {!editing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-bg3 border border-border2 text-dim hover:text-accent hover:border-accent/30 cursor-pointer transition-colors"
          >
            ✎ Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs border border-accent text-accent hover:bg-ok/10 cursor-pointer transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-bg3 border border-border2 text-dim hover:text-err hover:border-err/30 cursor-pointer transition-colors"
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
          className="flex-1 bg-bg2 border border-accent rounded p-3.5 font-mono text-xs leading-relaxed text-text resize-none outline-none whitespace-pre overflow-auto"
          style={{ tabSize: 2 }}
        />
      ) : (
        <pre className="flex-1 overflow-auto bg-bg2 border border-border rounded p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
          {yaml || "(no YAML available)"}
        </pre>
      )}
    </div>
  );
}
