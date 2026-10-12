import { redactSecrets } from '../signals/secrets.js';
import type { AuditChainRow } from '../db/audit-store.js';

const SECRET_KEY = /(?:password|passwd|secret|token|credential|authorization|private.?key|api.?key)/i;
const URL_SECRET = /([?&](?:access_token|api[_-]?key|key|password|passwd|secret|token|authorization)=)[^&#\s]*/gi;
const ASSIGNMENT_SECRET = /\b(password|passwd|secret|token|api[_-]?key|authorization)\b\s*([:=])\s*(['"]?)[^\s,;"']{4,}/gi;

/** Recursively scrub common credential fields and structured secrets before persistence/export. */
export function sanitizeAuditPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    const structured = redactSecrets(value).text;
    return structured.replace(URL_SECRET, '$1[REDACTED]').replace(ASSIGNMENT_SECRET, '$1$2[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeAuditPayload(item)]));
  }
  return value;
}

export function sanitizedAuditExport(entries: readonly AuditChainRow[]): { format: string; exportedAt: string; count: number; entries: AuditChainRow[] } {
  return {
    format: 'guardsaab-sanitized-audit-export-v1',
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries: entries.map((entry) => ({ ...entry, payload: sanitizeAuditPayload(entry.payload) })),
  };
}
