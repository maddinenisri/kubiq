# Architecture

Kubiq is a VS Code extension with a React-based webview UI. The extension host (Node.js) handles kubectl operations and AI sessions. The webview (browser) renders the UI.

## Directory Structure

```
kubiq/
├── src/                              # Extension host (Node.js runtime)
│   ├── extension.ts                  # Entry point — activation, commands, orchestration
│   ├── services/                     # Business logic
│   │   ├── KubectlService.ts         # All kubectl operations (pods, deploys, nodes, etc.)
│   │   ├── ContextService.ts         # Kubeconfig parsing, AWS profile resolution
│   │   ├── ClaudeService.ts          # Claude CLI subprocess (NDJSON streaming)
│   │   └── SessionStoreService.ts    # Chat history persistence via VS Code globalState
│   ├── ai/                           # AI layer
│   │   ├── sanitizer.ts              # Pre-hook: strip secrets/PII before LLM
│   │   ├── responseValidator.ts      # Post-hook: flag destructive kubectl commands
│   │   ├── skillsLoader.ts           # Loads .md knowledge base files
│   │   └── skills/                   # 11 built-in K8s troubleshooting guides
│   ├── pods/
│   │   └── crashAnalyzer.ts          # Local crash pattern detection + prompt builder
│   ├── sidebar/
│   │   └── sidebarProvider.ts        # WebviewViewProvider for sidebar dashboard
│   ├── webview/
│   │   └── podPanel.ts               # WebviewPanel for pod diagnosis (message handler)
│   ├── shared/                       # Types shared with webview
│   │   ├── types.ts                  # PodRow, PodSnapshot, StoredMessage, etc.
│   │   └── messages.ts               # Typed message protocol (ExtensionMessage ↔ WebviewMessage)
│   └── utils/
│       └── html.ts                   # getWebviewHtml — loads React bundles with CSP
│
├── webview-ui/                       # Webview UI (React 19, browser runtime)
│   ├── src/
│   │   ├── sidebar.tsx               # Sidebar entry point
│   │   ├── panel.tsx                 # Pod panel entry point
│   │   ├── resource.tsx              # Resource detail entry point
│   │   ├── index.css                 # Tailwind CSS v4 + VS Code variable theme
│   │   ├── lib/
│   │   │   └── vscode.ts            # Type-safe postMessage bridge
│   │   ├── hooks/
│   │   │   └── useExtensionMessage.ts
│   │   ├── context/
│   │   │   └── ExtensionStateContext.tsx  # Global state (useReducer)
│   │   └── components/
│   │       ├── common/               # Shared UI components
│   │       │   ├── DataTable.tsx     # Generic sortable table
│   │       │   ├── StatusChip.tsx    # Running/Pending/Failed badge
│   │       │   ├── CopyButton.tsx    # Clipboard with feedback
│   │       │   ├── Markdown.tsx      # Hand-rolled markdown renderer
│   │       │   └── ...
│   │       ├── sidebar/              # Sidebar-specific components
│   │       │   ├── FilterBar.tsx
│   │       │   ├── ResourceTabs.tsx
│   │       │   └── tables/           # PodsTable, DeploymentsTable, etc.
│   │       ├── panel/                # Pod panel components
│   │       │   ├── ChatTab.tsx
│   │       │   ├── ContainersTab.tsx
│   │       │   ├── LogsTab.tsx
│   │       │   └── ...
│   │       └── resource/             # Resource detail panel
│   │           └── ResourcePanel.tsx
│   ├── vite.config.ts                # Vite 6 build config
│   └── package.json                  # React 19, Tailwind CSS v4
│
├── media/                            # Icons (SVG for activity bar, PNG for marketplace)
├── build.js                          # esbuild config for extension host
└── package.json                      # Extension manifest + scripts
```

## Data Flow

```
Extension Host (Node.js)              Webview (React, browser)
═══════════════════════              ══════════════════════════

┌─────────────────────┐
│ SidebarProvider      │──── postMessage(bootstrap) ────→ ExtensionStateProvider
│                      │                                   └─ reducer updates state
│ KubectlService       │                                   └─ useEffect: fetch namespaces
│   kubectl get pods   │←── postMessage(getNamespaces) ──── FilterBar
│                      │──── postMessage(namespaces) ────→ reducer: connected=true
│                      │                                   └─ useEffect: fetch pods
│                      │←── postMessage(fetch pods) ─────── auto from provider
│                      │──── postMessage(data pods) ─────→ reducer: data.pods = rows
│                      │                                   └─ React re-renders PodsTable
└─────────────────────┘

┌─────────────────────┐
│ PodPanel             │←── postMessage(ready) ──────────── panel.tsx on mount
│                      │──── postMessage(snapshot) ──────→ reducer: snapshot = data
│ CrashAnalyzer        │──── postMessage(thinking) ──────→ ChatTab: show dots
│   sanitize → prompt  │──── postMessage(text_delta) ────→ ChatTab: stream text
│                      │──── postMessage(turn_complete) ─→ ChatTab: add to messages
│ ClaudeService        │
│   claude CLI process │
└─────────────────────┘
```

## Key Design Decisions

### React 19 + Vite 6 for Webview

The webview UI is a full React single-page app built with Vite. Three entry points (sidebar, panel, resource) share a common React chunk. Tailwind CSS v4 provides utility classes with VS Code CSS variable theming.

### Hand-Rolled Markdown Renderer

We use a simple regex-based markdown renderer with `dangerouslySetInnerHTML` instead of `react-markdown`. The react-markdown library caused re-render issues in VS Code webviews where text would disappear after streaming completed. The hand-rolled renderer uses `useMemo` and inline styles for reliable rendering.

### Typed Message Protocol

All communication between extension host and webview uses discriminated union types defined in `src/shared/messages.ts`. This ensures type safety at compile time and makes the message contract explicit.

### Centralized State Management

The `ExtensionStateContext` uses React's `useReducer` with a single reducer that handles all extension messages. Side effects (auto-fetching namespaces, pods) live in `useEffect` hooks in the provider, not in individual components.

### kubectl Over Client Libraries

Kubernetes auth is handled transparently by kubectl via kubeconfig. No need to reimplement token refresh for each cloud provider (EKS, GKE, AKS).

### Claude CLI Over API

Uses `claude --print --output-format stream-json` as a persistent subprocess. Supports session resume, streaming token deltas, and inherits the user's existing Claude authentication.

## Build Pipeline

```
npm run compile
  ├─ build:extension  →  esbuild  →  out/extension.js (Node.js bundle)
  └─ build:webview    →  Vite     →  out/webview/assets/ (React bundles + CSS)
```

Extension host: esbuild bundles `src/extension.ts` into `out/extension.js` (CJS, Node 18 target).
Webview: Vite builds 3 entry points into `out/webview/assets/` with code splitting.
Skills: `build.js` copies `src/ai/skills/*.md` to `out/ai/skills/`.
