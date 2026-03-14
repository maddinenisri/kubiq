# Plan: Natural Language to kubectl Command Builder (#5)

## Overview

Users type natural language questions in the chat, and Kubiq generates validated kubectl commands with explanations and "Run" buttons.

## Architecture

```
User types: "why can't my pod reach the database service?"
        ↓
┌─────────────────────┐
│ Intent Detection     │  Classify: diagnostic, action, or question
│ (AI prompt)          │  Extract: target resource, namespace, operation
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Command Generation   │  AI generates kubectl commands
│ (Claude/LLM)         │  Structured output: { command, explanation, risk }
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Command Validator    │  AST-parse the kubectl command
│ (#49)                │  Validate flags, resources, namespaces
│                      │  Classify risk: safe / review / dangerous
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Render in Chat       │  Show command with:
│                      │  - Syntax-highlighted code block
│                      │  - Explanation text
│                      │  - Risk badge (safe/review/dangerous)
│                      │  - [Run] button (if safe or reviewed)
│                      │  - [Copy] button
│                      │  - [Dry Run] button
└─────────────────────┘
          ↓ (user clicks Run)
┌─────────────────────┐
│ Command Executor     │  Runs in VS Code terminal or captures output
│                      │  Shows result inline in chat
│                      │  Saves to command history
└─────────────────────┘
```

## Natural Language → Command Examples

| User Input                                     | Generated Commands                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "why can't my pod reach the database?"         | `kubectl exec <pod> -- nslookup database-svc`<br>`kubectl get endpoints database-svc`<br>`kubectl get networkpolicy -n <ns>` |
| "show me what's using the most memory"         | `kubectl top pods --sort-by=memory -n <ns>`                                                                                  |
| "restart the booking service"                  | `kubectl rollout restart deployment/booking-service`                                                                         |
| "what changed in the last hour?"               | `kubectl get events --sort-by='.lastTimestamp' -n <ns>`                                                                      |
| "check if the service account has permissions" | `kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa>`                                                             |
| "scale the API to 5 replicas"                  | `kubectl scale deployment/api --replicas=5`                                                                                  |

## Command Validator (AST-based, #49)

```typescript
// src/ai/commandValidator.ts

interface ParsedCommand {
  verb: string; // get, delete, apply, exec, logs, etc.
  resource?: string; // pod, deployment, service, etc.
  name?: string; // resource name
  flags: Record<string, string>; // --namespace, --context, -o, etc.
  risk: "safe" | "review" | "dangerous";
  issues: string[]; // validation issues
}

function parseKubectlCommand(cmd: string): ParsedCommand {
  // Tokenize: kubectl <verb> [resource] [name] [flags...]
  // Validate: known verbs, valid flag combinations
  // Classify risk based on verb (get=safe, delete=dangerous, apply=review)
}
```

## Chat UI Integration

When AI responds with kubectl commands, the chat renders them as interactive command cards:

```
┌──────────────────────────────────────────────────────┐
│ 🟢 SAFE                                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ kubectl get endpoints database-svc -n prod       │ │
│ └──────────────────────────────────────────────────┘ │
│ Checks if the database service has healthy endpoints │
│ [▶ Run]  [📋 Copy]  [🔍 Dry Run]                   │
├──────────────────────────────────────────────────────┤
│ ⚠️ REVIEW                                           │
│ ┌──────────────────────────────────────────────────┐ │
│ │ kubectl exec booking-pod -- nslookup database-svc│ │
│ └──────────────────────────────────────────────────┘ │
│ Runs DNS lookup from inside the pod                  │
│ [▶ Run]  [📋 Copy]                                  │
└──────────────────────────────────────────────────────┘
```

## Implementation Steps

1. **Command Parser** (`src/ai/commandParser.ts`): Tokenize kubectl commands into structured objects
2. **Command Validator** (extend `src/ai/responseValidator.ts`): Validate parsed commands, classify risk
3. **Prompt Engineering**: Update crash analyzer prompt to request structured command output
4. **Chat UI**: New `CommandCard` React component with Run/Copy/DryRun buttons
5. **Command Executor**: Run commands via `KubectlService`, show output inline in chat
6. **Command History**: Store executed commands for reference

## Dependencies

- No new dependencies — kubectl command parsing is string manipulation
- Existing `KubectlService.run()` handles execution

## Estimate: 4-5 days
