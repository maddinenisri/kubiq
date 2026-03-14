/**
 * Pre-hook: sanitize pod data before sending to LLM.
 * Strips secrets, tokens, credentials, and PII from logs, events, and describe output.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // AWS credentials
  { pattern: /AKIA[0-9A-Z]{16}/g, label: "AWS Access Key" },
  {
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*\S+/gi,
    label: "AWS Secret Key",
  },
  // Generic tokens and passwords
  {
    pattern:
      /(?:password|passwd|token|secret|api[_-]?key|auth[_-]?token)\s*[=:]\s*["']?[^\s"',]{8,}/gi,
    label: "Credential",
  },
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, label: "Bearer Token" },
  // JWT tokens
  {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    label: "JWT Token",
  },
  // Private keys
  {
    pattern:
      /-----BEGIN\s+(?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA |EC )?PRIVATE KEY-----/g,
    label: "Private Key",
  },
  // Base64-encoded secrets in env vars
  {
    pattern: /(?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL)\s*[=:]\s*[A-Za-z0-9+/]{40,}={0,2}/gi,
    label: "Encoded Secret",
  },
  // Connection strings with passwords
  {
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@]+@[^\s]+/gi,
    label: "Connection String",
  },
  // GitHub/GitLab tokens
  { pattern: /gh[ps]_[A-Za-z0-9_]{36,}/g, label: "GitHub Token" },
  { pattern: /glpat-[A-Za-z0-9\-_]{20,}/g, label: "GitLab Token" },
];

export interface SanitizationResult {
  sanitized: string;
  redactions: Array<{ label: string; count: number }>;
  totalRedacted: number;
}

export function sanitize(
  input: string,
  options: {
    stripSecrets: boolean;
    stripEnvVarValues: boolean;
    customPatterns: string[];
  },
): SanitizationResult {
  let result = input;
  const redactionCounts = new Map<string, number>();

  if (options.stripSecrets) {
    for (const { pattern, label } of SECRET_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      const matches = result.match(pattern);
      if (matches) {
        redactionCounts.set(label, (redactionCounts.get(label) ?? 0) + matches.length);
        pattern.lastIndex = 0;
        result = result.replace(pattern, `[REDACTED:${label}]`);
      }
    }
  }

  if (options.stripEnvVarValues) {
    // Redact values in "Environment:" sections of kubectl describe output
    result = result.replace(
      /^(\s+(?:\w[\w.-]*):\s+)(.+)$/gm,
      (match, prefix: string, value: string) => {
        // Only redact if it looks like an env var block (indented key: value)
        const sensitive =
          /secret|password|token|key|credential|auth/i.test(prefix) ||
          /secret|password|token|key|credential|auth/i.test(value);
        if (sensitive) {
          redactionCounts.set("Env Var", (redactionCounts.get("Env Var") ?? 0) + 1);
          return `${prefix}[REDACTED]`;
        }
        return match;
      },
    );
  }

  for (const custom of options.customPatterns) {
    try {
      const re = new RegExp(custom, "gi");
      const matches = result.match(re);
      if (matches) {
        redactionCounts.set(
          "Custom Pattern",
          (redactionCounts.get("Custom Pattern") ?? 0) + matches.length,
        );
        result = result.replace(re, "[REDACTED]");
      }
    } catch {
      /* skip invalid regex */
    }
  }

  const redactions = Array.from(redactionCounts.entries()).map(([label, count]) => ({
    label,
    count,
  }));
  const totalRedacted = redactions.reduce((sum, r) => sum + r.count, 0);

  return { sanitized: result, redactions, totalRedacted };
}
