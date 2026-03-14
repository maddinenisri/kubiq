# UX Design: Validation & Command Builder

## Design Principles

1. **Non-blocking by default** — warnings don't prevent action, only errors block Apply
2. **Inline feedback** — show issues next to the code, not in a separate panel
3. **Actionable** — every warning/error has a "Fix" suggestion or one-click fix
4. **Progressive disclosure** — summary badge first, expand for details
5. **Consistent** — same validation UI in YAML tab, chat, and resource editor

---

## 1. YAML Tab Validation UX

### Current State

```
┌─ YAML Tab ────────────────────────────────────────────┐
│  [Copy YAML]  [✎ Edit]                                │
│ ┌────────────────────────────────────────────────────┐ │
│ │ apiVersion: apps/v1                                │ │
│ │ kind: Deployment                                   │ │
│ │ spec:                                              │ │
│ │   replicas: 1                                      │ │
│ │   template:                                        │ │
│ │     spec:                                          │ │
│ │       containers:                                  │ │
│ │         - name: app                                │ │
│ │           image: myapp:latest                      │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Proposed: With Validation

```
┌─ YAML Tab ────────────────────────────────────────────┐
│  [Copy]  [✎ Edit]  [▶ Validate]   ⚠ 3 warnings  1 ℹ │
│ ┌────────────────────────────────────────────────────┐ │
│ │    apiVersion: apps/v1                             │ │
│ │    kind: Deployment                                │ │
│ │    spec:                                           │ │
│ │      replicas: 1                                   │ │
│ │      template:                                     │ │
│ │        spec:                                       │ │
│ │          containers:                               │ │
│ │            - name: app                             │ │
│ │ ⚠            image: myapp:latest                   │ │
│ │ ⚠            # missing resources.requests/limits   │ │
│ │ ⚠            # missing liveness/readiness probes   │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─ Validation Results ──────────────────────────────┐ │
│ │ ⚠ Line 9: Image uses :latest tag                  │ │
│ │   → Use a specific tag (e.g., myapp:v1.2.3)       │ │
│ │                                                    │ │
│ │ ⚠ Line 8: Missing resource requests/limits        │ │
│ │   → Add resources.requests.cpu and memory    [Fix] │ │
│ │                                                    │ │
│ │ ⚠ Line 8: Missing liveness/readiness probes       │ │
│ │   → Add health check probes                  [Fix] │ │
│ │                                                    │ │
│ │ ℹ Line 1: No namespace specified                   │ │
│ │   → Will deploy to 'default' namespace             │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Edit Mode with Live Validation

```
┌─ YAML Tab (Editing) ──────────────────────────────────┐
│  [Apply ⚠3]  [Cancel]  [Copy]    ⚠ 3 warnings  ● ℹ1 │
│ ┌────────────────────────────────────────────────────┐ │
│ │ apiVersion: apps/v1                                │ │
│ │ kind: Deployment                                   │ │
│ │ metadata:                                          │ │
│ │   name: my-app                                     │ │
│ │ spec:                                              │ │
│ │   replicas: 1                                      │ │
│ │   template:                                        │ │
│ │     spec:                                          │ │
│ │       containers:                                  │ │
│ │         - name: app                                │ │
│ │ ⚠          image: myapp:latest ← :latest tag       │ │
│ │ ⚠          # no resources ← add limits            │ │
│ │            ports:                                   │ │
│ │              - containerPort: 8080                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ⚠ 3 warnings found. Apply anyway?                     │
│ [Apply with Warnings]  [Fix All]  [Cancel]             │
└────────────────────────────────────────────────────────┘
```

### [Fix] Button Behavior

When user clicks [Fix] on "Missing resource requests/limits":

- Inserts a pre-filled resource block at the right indentation level
- Uses sensible defaults (cpu: 250m/500m, memory: 256Mi/512Mi)
- Highlights the inserted code so user can adjust values

---

## 2. AI Chat — Command Cards UX

### Current State

AI responds with raw text containing kubectl commands in code blocks.

### Proposed: Interactive Command Cards

```
┌─ Chat ────────────────────────────────────────────────┐
│                                                        │
│ 🤖 The pod can't reach the database. Here's how to    │
│    diagnose:                                           │
│                                                        │
│ ┌─ Command ──────────────────────── 🟢 safe ────────┐ │
│ │ $ kubectl get endpoints db-svc -n prod             │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Check if the database service has healthy endpoints│ │
│ │                                                    │ │
│ │ [▶ Run]  [📋 Copy]  [🔍 Dry Run]                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─ Command ──────────────────────── ⚠ review ───────┐ │
│ │ $ kubectl exec booking-pod -n prod --              │ │
│ │   nslookup db-svc.prod.svc.cluster.local           │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Test DNS resolution from inside the pod            │ │
│ │                                                    │ │
│ │ [▶ Run]  [📋 Copy]                                │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─ Command ──────────────────────── 🔴 danger ──────┐ │
│ │ $ kubectl delete pod booking-pod -n prod           │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ ⚠ DESTRUCTIVE: This will terminate the pod        │ │
│ │                                                    │ │
│ │ [📋 Copy]  (Run disabled — destructive)            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ After clicking [▶ Run]:                                │
│ ┌─ Output ───────────────────────────────────────────┐ │
│ │ NAME     ENDPOINTS          AGE                    │ │
│ │ db-svc   10.0.14.5:5432     3d                     │ │
│ │                                                    │ │
│ │ ✓ 1 endpoint healthy                               │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Ask about this pod…                          [➤]   │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### [▶ Run] Button Flow

1. Click Run → command executes via KubectlService
2. Output appears inline below the command card
3. Output is formatted (table detection, error highlighting)
4. AI can reference the output in follow-up responses

### [🔍 Dry Run] Button Flow

1. Appends `--dry-run=client` to the command
2. Shows what would happen without making changes
3. Useful for apply/patch/delete commands

---

## 3. AI Chat — YAML Generation UX

When AI generates a YAML manifest in its response:

```
┌─ Chat ────────────────────────────────────────────────┐
│                                                        │
│ 🤖 Here's a corrected deployment manifest:            │
│                                                        │
│ ┌─ YAML ────── ✅ valid  ⚠ 1 warning ──────────────┐ │
│ │ apiVersion: apps/v1                                │ │
│ │ kind: Deployment                                   │ │
│ │ metadata:                                          │ │
│ │   name: booking-service                            │ │
│ │ spec:                                              │ │
│ │   replicas: 2                                      │ │
│ │   template:                                        │ │
│ │     spec:                                          │ │
│ │       containers:                                  │ │
│ │         - name: app                                │ │
│ │           image: booking:v1.2.3                    │ │
│ │           resources:                               │ │
│ │             requests:                              │ │
│ │               cpu: 250m                            │ │
│ │               memory: 256Mi                        │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ ⚠ Missing liveness/readiness probes               │ │
│ │                                                    │ │
│ │ [▶ Apply]  [📋 Copy]  [✎ Edit & Apply]  [💾 Save] │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Button Actions

| Button           | Action                                                        |
| ---------------- | ------------------------------------------------------------- |
| **Apply**        | Validates → confirms namespace/context → `kubectl apply -f -` |
| **Copy**         | Copies YAML to clipboard                                      |
| **Edit & Apply** | Opens in Kubiq YAML editor panel with validation              |
| **Save**         | Saves to a file in the workspace                              |

---

## 4. Validation Summary Badge

A persistent badge in the YAML tab header showing validation status:

```
[Chat] [Containers] [Logs] [Events] [Describe] [YAML ✅]
[Chat] [Containers] [Logs] [Events] [Describe] [YAML ⚠3]
[Chat] [Containers] [Logs] [Events] [Describe] [YAML ❌2]
```

---

## 5. Natural Language Input UX

The chat input supports natural language for kubectl generation:

```
┌─────────────────────────────────────────────────────┐
│ Ask about this pod…                                  │
│                                                      │
│ Examples:                                            │
│  "why can't this pod reach the database?"            │
│  "show me what's using the most memory"              │
│  "restart the booking service"                       │
│  "check RBAC permissions for this service account"   │
└─────────────────────────────────────────────────────┘
```

When the AI detects a kubectl-related question, it responds with structured command cards instead of plain text.

---

## 6. Component Architecture

```
webview-ui/src/components/
├── common/
│   ├── ValidationBadge.tsx      # ✅ / ⚠3 / ❌2 summary
│   ├── ValidationResults.tsx    # Expandable list of issues with Fix buttons
│   ├── CommandCard.tsx          # Interactive kubectl command with Run/Copy/DryRun
│   ├── CommandOutput.tsx        # Formatted command execution output
│   └── YamlBlock.tsx            # Validated YAML with inline annotations
├── panel/
│   ├── YamlTab.tsx              # Updated: validation integrated
│   └── ChatTab.tsx              # Updated: renders CommandCards and YamlBlocks
```

---

## 7. Color System for Validation

| Status         | Color             | Icon | Meaning                               |
| -------------- | ----------------- | ---- | ------------------------------------- |
| Valid          | `#4af0c8` (teal)  | ✅   | No issues found                       |
| Warning        | `#f0a84a` (amber) | ⚠    | Best practice violation, non-blocking |
| Error          | `#f05a5a` (red)   | ❌   | Invalid YAML/command, blocks Apply    |
| Info           | `#5a6380` (grey)  | ℹ    | Informational, no action needed       |
| Safe command   | `#4af0c8` (teal)  | 🟢   | Read-only kubectl command             |
| Review command | `#f0a84a` (amber) | 🟡   | Mutating command, needs review        |
| Danger command | `#f05a5a` (red)   | 🔴   | Destructive command, Run disabled     |

---

## 8. Interaction Patterns

### Auto-validate on Edit

- YAML editor validates on every keystroke (debounced 500ms)
- Validation results update live
- No need to click a "Validate" button

### Gate Apply on Errors

- Errors (❌) → Apply button disabled, shows "Fix N errors to apply"
- Warnings (⚠) → Apply button shows "Apply with N warnings"
- Clean (✅) → Apply button shows "Apply"

### Command Execution Feedback

- Running: spinner on the Run button
- Success: green checkmark + output
- Error: red X + stderr output
- Command added to history (accessible from settings or a command history panel)

### [Fix All] Button

- Applies all auto-fixable issues in one click
- Shows a diff preview of what will change
- User confirms before applying fixes
