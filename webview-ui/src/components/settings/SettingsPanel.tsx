import { useState, useEffect, useCallback } from "react";
import { postMessage } from "../../lib/vscode";

interface Settings {
  // AI
  aiEnabled: boolean;
  promptPreset: string;
  customInstructions: string;
  // Guardrails
  sanitizeSecrets: boolean;
  sanitizeEnvVars: boolean;
  redactPatterns: string[];
  flagDestructiveCommands: boolean;
  // Cluster
  logTailLines: number;
  clusterProfiles: Record<string, { profile: string; region: string }>;
  // Skills
  loadedSkills: string[];
  workspaceRules: string[];
}

const defaultSettings: Settings = {
  aiEnabled: true,
  promptPreset: "default",
  customInstructions: "",
  sanitizeSecrets: true,
  sanitizeEnvVars: true,
  redactPatterns: [],
  flagDestructiveCommands: true,
  logTailLines: 500,
  clusterProfiles: {},
  loadedSkills: [],
  workspaceRules: [],
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeSection, setActiveSection] = useState("ai");
  const [saved, setSaved] = useState(false);
  const [newPattern, setNewPattern] = useState("");

  // Listen for settings data from extension host
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data.type === "settingsData") {
        setSettings(event.data.settings);
      }
    }
    window.addEventListener("message", onMessage);
    // Request current settings
    postMessage({ type: "getSettings" } as never);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSave = useCallback(
    (key: string, value: unknown) => {
      postMessage({ type: "updateSetting", key, value } as never);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [],
  );

  const updateField = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K], settingKey: string) => {
      setSettings((s) => ({ ...s, [key]: value }));
      handleSave(settingKey, value);
    },
    [handleSave],
  );

  const sections = [
    { id: "ai", label: "AI Configuration" },
    { id: "guardrails", label: "Guardrails" },
    { id: "cluster", label: "Cluster" },
    { id: "skills", label: "Knowledge Base" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "#c8cfe0" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "#13161d",
          borderBottom: "1px solid #252a38",
        }}
      >
        <span style={{ color: "#4af0c8", fontSize: 16 }}>⬡</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8ecf8" }}>Kubiq Settings</span>
        {saved && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#4af0c8",
              padding: "2px 8px",
              border: "1px solid rgba(74,240,200,0.3)",
              borderRadius: 3,
            }}
          >
            ✓ Saved
          </span>
        )}
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar nav */}
        <nav
          style={{
            width: 180,
            background: "#13161d",
            borderRight: "1px solid #252a38",
            padding: "8px 0",
            flexShrink: 0,
          }}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 16px",
                fontSize: 12,
                background: activeSection === s.id ? "rgba(74,240,200,0.08)" : "transparent",
                color: activeSection === s.id ? "#4af0c8" : "#5a6380",
                border: "none",
                borderLeft: activeSection === s.id ? "2px solid #4af0c8" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {activeSection === "ai" && (
            <div>
              <SectionHeader title="AI Configuration" />

              <ToggleField
                label="Enable AI Diagnostics"
                description="When disabled, pod panels show data tabs only. Crash pattern detection still works locally."
                value={settings.aiEnabled}
                onChange={(v) => updateField("aiEnabled", v, "kubiq.ai.enabled")}
              />

              <SelectField
                label="Prompt Preset"
                description="AI personality for pod diagnosis."
                value={settings.promptPreset}
                options={[
                  { value: "default", label: "General K8s SRE" },
                  { value: "sre-oncall", label: "SRE On-Call (incident focus)" },
                  { value: "developer", label: "Developer (app-level focus)" },
                  { value: "security-audit", label: "Security Audit (CVE/RBAC focus)" },
                ]}
                onChange={(v) => updateField("promptPreset", v, "kubiq.ai.promptPreset")}
              />

              <TextAreaField
                label="Custom Instructions"
                description="Additional instructions appended to the AI prompt. Use for team-specific context."
                placeholder="e.g., Focus on Java Spring Boot errors. Always suggest Helm chart fixes."
                value={settings.customInstructions}
                onChange={(v) => updateField("customInstructions", v, "kubiq.ai.customInstructions")}
              />
            </div>
          )}

          {activeSection === "guardrails" && (
            <div>
              <SectionHeader title="Guardrails" />

              <ToggleField
                label="Sanitize Secrets"
                description="Strip AWS keys, JWT tokens, passwords, connection strings before sending to AI."
                value={settings.sanitizeSecrets}
                onChange={(v) => updateField("sanitizeSecrets", v, "kubiq.guardrails.sanitizeSecrets")}
              />

              <ToggleField
                label="Redact Environment Variables"
                description="Redact values of sensitive env vars (SECRET, PASSWORD, TOKEN, etc.) in pod describe output."
                value={settings.sanitizeEnvVars}
                onChange={(v) => updateField("sanitizeEnvVars", v, "kubiq.guardrails.sanitizeEnvVars")}
              />

              <ToggleField
                label="Flag Destructive Commands"
                description="Show warning badges on destructive kubectl commands (delete, drain, scale-to-zero) in AI responses."
                value={settings.flagDestructiveCommands}
                onChange={(v) =>
                  updateField("flagDestructiveCommands", v, "kubiq.guardrails.flagDestructiveCommands")
                }
              />

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 4 }}>
                  Custom Redaction Patterns
                </label>
                <p style={{ fontSize: 11, color: "#5a6380", marginBottom: 8 }}>
                  Regex patterns to redact from data sent to AI. Each match is replaced with [REDACTED].
                </p>
                {settings.redactPatterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                    <code
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        background: "#1a1e28",
                        border: "1px solid #2e3448",
                        borderRadius: 3,
                        fontSize: 11,
                        color: "#a0d8c8",
                      }}
                    >
                      {p}
                    </code>
                    <button
                      onClick={() => {
                        const updated = settings.redactPatterns.filter((_, idx) => idx !== i);
                        updateField("redactPatterns", updated, "kubiq.guardrails.redactPatterns");
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid #2e3448",
                        color: "#f05a5a",
                        borderRadius: 3,
                        padding: "2px 8px",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="e.g., corp\\.internal\\.com"
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      background: "#1a1e28",
                      border: "1px solid #2e3448",
                      borderRadius: 3,
                      fontSize: 11,
                      color: "#c8cfe0",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newPattern.trim()) {
                        updateField(
                          "redactPatterns",
                          [...settings.redactPatterns, newPattern.trim()],
                          "kubiq.guardrails.redactPatterns",
                        );
                        setNewPattern("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newPattern.trim()) {
                        updateField(
                          "redactPatterns",
                          [...settings.redactPatterns, newPattern.trim()],
                          "kubiq.guardrails.redactPatterns",
                        );
                        setNewPattern("");
                      }
                    }}
                    style={{
                      background: "#1a1e28",
                      border: "1px solid #4af0c8",
                      color: "#4af0c8",
                      borderRadius: 3,
                      padding: "2px 10px",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "cluster" && (
            <div>
              <SectionHeader title="Cluster Configuration" />

              <NumberField
                label="Log Tail Lines"
                description="Number of log lines to fetch per container."
                value={settings.logTailLines}
                min={50}
                max={5000}
                step={50}
                onChange={(v) => updateField("logTailLines", v, "kubiq.logTailLines")}
              />
            </div>
          )}

          {activeSection === "skills" && (
            <div>
              <SectionHeader title="Knowledge Base" />

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 8 }}>
                  Built-in Skills ({settings.loadedSkills.length})
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {settings.loadedSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 10,
                        border: "1px solid rgba(74,240,200,0.2)",
                        color: "rgba(74,240,200,0.7)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 4 }}>
                  Workspace Rules
                </label>
                <p style={{ fontSize: 11, color: "#5a6380", marginBottom: 8 }}>
                  Add custom .md files to <code style={{ color: "#a0d8c8" }}>.kubiq/rules/</code> in your workspace.
                  They override built-in skills with the same name.
                </p>
                {settings.workspaceRules.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#5a6380", fontStyle: "italic" }}>No workspace rules found</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {settings.workspaceRules.map((r) => (
                      <span
                        key={r}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          border: "1px solid rgba(240,168,74,0.3)",
                          color: "rgba(240,168,74,0.7)",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Field Components ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 700, color: "#e8ecf8", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #252a38" }}>
      {title}
    </h2>
  );
}

function ToggleField({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 2 }}>{label}</label>
        <p style={{ fontSize: 11, color: "#5a6380", maxWidth: 400 }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "none",
          background: value ? "#4af0c8" : "#2e3448",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            display: "block",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: value ? 21 : 3,
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

function SelectField({ label, description, value, options, onChange }: {
  label: string; description: string; value: string;
  options: Array<{ value: string; label: string }>; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 2 }}>{label}</label>
      <p style={{ fontSize: 11, color: "#5a6380", marginBottom: 6 }}>{description}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#1a1e28",
          border: "1px solid #2e3448",
          color: "#c8cfe0",
          padding: "6px 10px",
          borderRadius: 4,
          fontSize: 12,
          outline: "none",
          width: "100%",
          maxWidth: 300,
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({ label, description, placeholder, value, onChange }: {
  label: string; description: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 2 }}>{label}</label>
      <p style={{ fontSize: 11, color: "#5a6380", marginBottom: 6 }}>{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: "100%",
          maxWidth: 500,
          background: "#1a1e28",
          border: "1px solid #2e3448",
          color: "#c8cfe0",
          padding: "8px 10px",
          borderRadius: 4,
          fontSize: 12,
          outline: "none",
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function NumberField({ label, description, value, min, max, step, onChange }: {
  label: string; description: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8ecf8", marginBottom: 2 }}>{label}</label>
      <p style={{ fontSize: 11, color: "#5a6380", marginBottom: 6 }}>{description}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          style={{ flex: 1, maxWidth: 250, accentColor: "#4af0c8" }}
        />
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#4af0c8", minWidth: 40 }}>{value}</span>
      </div>
    </div>
  );
}
