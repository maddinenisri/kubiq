/**
 * Parse Kubernetes resource quantities into numeric values.
 */

/** Parse CPU value to millicores. "250m" → 250, "1" → 1000, "0.5" → 500 */
export function parseCpu(value: string): number {
  if (!value) return 0;
  const s = String(value).trim();
  if (s.endsWith("m")) return parseInt(s.slice(0, -1), 10) || 0;
  if (s.endsWith("n")) return Math.round((parseInt(s.slice(0, -1), 10) || 0) / 1_000_000);
  return Math.round(parseFloat(s) * 1000) || 0;
}

/** Parse memory value to bytes. "256Mi" → 268435456, "1Gi" → 1073741824 */
export function parseMemory(value: string): number {
  if (!value) return 0;
  const s = String(value).trim();
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  };
  for (const [suffix, multiplier] of Object.entries(units)) {
    if (s.endsWith(suffix)) {
      return Math.round(parseFloat(s.slice(0, -suffix.length)) * multiplier) || 0;
    }
  }
  return parseInt(s, 10) || 0; // raw bytes
}

/** Format bytes to human-readable. 268435456 → "256Mi" */
export function formatMemory(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}Mi`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}Ki`;
  return `${bytes}`;
}

/** Format millicores to human-readable. 1500 → "1.5", 250 → "250m" */
export function formatCpu(millicores: number): string {
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)}`;
  return `${millicores}m`;
}
