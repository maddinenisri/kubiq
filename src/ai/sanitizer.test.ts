import { describe, it, expect } from "vitest";
import { sanitize } from "./sanitizer";

describe("sanitizer", () => {
  it("strips AWS access keys", () => {
    const input = "env: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    const result = sanitize(input, {
      stripSecrets: true,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    expect(result.sanitized).toContain("[REDACTED:AWS Access Key]");
    expect(result.sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result.totalRedacted).toBeGreaterThan(0);
  });

  it("strips JWT tokens", () => {
    const input =
      "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123456";
    const result = sanitize(input, {
      stripSecrets: true,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    expect(result.sanitized).toContain("[REDACTED");
    expect(result.totalRedacted).toBeGreaterThan(0);
  });

  it("strips connection strings with passwords", () => {
    const input = "DATABASE_URL=postgres://admin:s3cretP@ss@db.example.com:5432/mydb";
    const result = sanitize(input, {
      stripSecrets: true,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    expect(result.sanitized).not.toContain("s3cretP@ss");
    expect(result.totalRedacted).toBeGreaterThan(0);
  });

  it("strips GitHub tokens", () => {
    // Isolated from generic credential pattern by not using the word 'token' around it
    const input = "creds: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12 loaded";
    const result = sanitize(input, {
      stripSecrets: true,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    expect(result.sanitized).toContain("[REDACTED:GitHub Token]");
    expect(result.sanitized).not.toContain("ghp_");
  });

  it("redacts sensitive env var values", () => {
    const input = "    DB_PASSWORD:  my-secret-password-123\n    APP_NAME:  my-app";
    const result = sanitize(input, {
      stripSecrets: false,
      stripEnvVarValues: true,
      customPatterns: [],
    });
    expect(result.sanitized).toContain("[REDACTED]");
    expect(result.sanitized).toContain("APP_NAME");
  });

  it("applies custom patterns", () => {
    const input = "internal-service.corp.example.com is unreachable";
    const result = sanitize(input, {
      stripSecrets: false,
      stripEnvVarValues: false,
      customPatterns: ["corp\\.example\\.com"],
    });
    expect(result.sanitized).toContain("[REDACTED]");
    expect(result.sanitized).not.toContain("corp.example.com");
  });

  it("returns unchanged text when all options disabled", () => {
    const input = "AKIAIOSFODNN7EXAMPLE password=secret123";
    const result = sanitize(input, {
      stripSecrets: false,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    expect(result.sanitized).toBe(input);
    expect(result.totalRedacted).toBe(0);
  });

  it("counts redactions accurately", () => {
    const input = "key1=AKIAIOSFODNN7EXAMP01 key2=AKIAIOSFODNN7EXAMP02";
    const result = sanitize(input, {
      stripSecrets: true,
      stripEnvVarValues: false,
      customPatterns: [],
    });
    const awsRedaction = result.redactions.find((r) => r.label === "AWS Access Key");
    expect(awsRedaction).toBeDefined();
    expect(awsRedaction!.count).toBe(2);
  });
});
