# Contributing to Kubiq

## Getting Started

```bash
git clone https://github.com/maddinenisri/kubiq.git
cd kubiq
npm install
cd webview-ui && npm install && cd ..
npm run compile    # builds both extension + webview
# Press F5 in VS Code to launch Extension Development Host
```

## Development Commands

| Command                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `npm run compile`         | Build extension (esbuild) + webview (Vite) |
| `npm run build:extension` | Build extension host only                  |
| `npm run build:webview`   | Build React webview only                   |
| `npm run watch`           | Watch mode (extension only)                |
| `npm run watch:webview`   | Watch mode (webview only)                  |
| `npm test`                | Run vitest (42 tests)                      |
| `npm run test:watch`      | Watch mode tests                           |
| `npm run test:coverage`   | Tests with v8 coverage                     |
| `npm run lint`            | ESLint                                     |
| `npm run lint:fix`        | ESLint with auto-fix                       |
| `npm run format`          | Prettier (extension + webview)             |
| `npm run typecheck`       | TypeScript type check                      |
| `npm run package`         | Build VSIX for distribution                |

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

**Key directories:**

- `src/` — Extension host (Node.js). Services, AI, shared types.
- `webview-ui/` — React 19 webview app (Vite 6, Tailwind CSS v4).
- `src/shared/` — Types and message protocol shared between host and webview.
- `src/ai/skills/` — Built-in K8s troubleshooting knowledge base (.md files).
- `docs/` — Feature docs, architecture, guardrails.

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint:

```
feat: add namespace filter to sidebar
fix: handle empty kubeconfig gracefully
chore: update eslint config
test: add runner unit tests
refactor: extract service layer
docs: update README
```

## Pre-commit Hooks

Husky runs on every commit:

- **lint-staged**: ESLint + Prettier on staged files
- **commitlint**: Validates commit message format

## Testing

Tests use vitest with a vscode mock at `src/__mocks__/vscode.ts`.

```bash
npm test                    # run once
npm run test:watch          # watch mode
npm run test:coverage       # with v8 coverage
```

**Test files:**
| File | Tests | Coverage |
|---|---|---|
| `src/ai/sanitizer.test.ts` | 8 | Secret detection patterns |
| `src/ai/responseValidator.test.ts` | 8 | Command safety flagging |
| `src/ai/markdown.test.ts` | 10 | Markdown rendering |
| `src/pods/crashAnalyzer.test.ts` | 9 | Crash pattern detection + prompt building |
| `src/services/SessionStoreService.test.ts` | 7 | Session persistence |

## Adding a New Feature

1. Create a GitHub issue with the feature request template
2. Create a feature branch from `main`
3. Implement the feature
4. Add tests
5. Ensure all checks pass: `npm run typecheck && npm run lint && npm test`
6. Push and open a PR

## Adding a New Knowledge Base Skill

1. Create a `.md` file in `src/ai/skills/`
2. Follow the existing format (headers, bullet points, kubectl commands)
3. The skill is automatically loaded and injected into the AI prompt
4. Users can override it by creating a file with the same name in `.kubiq/rules/`

## Adding a New Resource Table

1. Create a table component in `webview-ui/src/components/sidebar/tables/`
2. Use the shared `DataTable` component with column definitions
3. Add the table to `ResourceView.tsx`
4. Add the resource type to `ResourceTabs.tsx`
5. Add the kubectl fetch logic to `SidebarProvider.ts`

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass
4. Push and open a PR against `main`
5. CI will run typecheck, lint, format check, test, and build
