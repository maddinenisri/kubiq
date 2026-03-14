# Contributing to Kubiq

## Getting Started

```bash
git clone https://github.com/maddinenisri/kubiq.git
cd kubiq
npm install
npm run watch    # recompiles on save
# Press F5 in VS Code to launch Extension Development Host
```

## Development Commands

| Command              | Description           |
| -------------------- | --------------------- |
| `npm run compile`    | Build with esbuild    |
| `npm run watch`      | Watch mode            |
| `npm test`           | Run vitest            |
| `npm run test:watch` | Watch mode tests      |
| `npm run lint`       | ESLint                |
| `npm run lint:fix`   | ESLint with auto-fix  |
| `npm run format`     | Prettier              |
| `npm run typecheck`  | TypeScript type check |
| `npm run package`    | Build VSIX            |

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add namespace filter to sidebar
fix: handle empty kubeconfig gracefully
chore: update eslint config
test: add runner unit tests
docs: update README with GKE setup
```

Enforced by commitlint via husky hook.

## Pre-commit Hooks

On every commit, husky runs:

- **lint-staged**: ESLint + Prettier on staged `.ts` files
- **commitlint**: Validates commit message format

## Architecture

```
src/
├── extension.ts              # entry point
├── sidebar/                  # WebviewViewProvider dashboard
├── kubectl/runner.ts         # all kubectl interactions
├── clusters/contextManager.ts # kubeconfig parsing
├── pods/crashAnalyzer.ts     # pattern matching + prompts
├── claude/                   # Claude CLI session management
└── webview/podPanel.ts       # per-pod diagnosis panel
```

## Testing

Tests live next to source files as `*.test.ts`. We use vitest with a vscode mock at `src/__mocks__/vscode.ts`.

```bash
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with v8 coverage
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass: `npm run typecheck && npm run lint && npm test`
4. Push and open a PR against `main`
5. CI will run typecheck, lint, format check, test, and build
