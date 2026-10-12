import { sanitizedAuditExport, sanitizeAuditPayload } from '../src/audit/sanitize.js';

let pass = 0;
const check = (name: string, condition: boolean) => { if (!condition) throw new Error(`FAIL ${name}`); pass++; console.log(`PASS ${name}`); };
const rawToken = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const payload = {
  action: 'tool call',
  input: { command: `curl https://example.test/?token=${rawToken}`, api_key: 'private-value' },
  reason: `Authorization: Bearer ${rawToken}`,
};
const sanitized = JSON.stringify(sanitizeAuditPayload(payload));
check('audit sanitizer removes a structured GitHub token', !sanitized.includes(rawToken));
check('audit sanitizer replaces credential fields by key', !sanitized.includes('private-value') && sanitized.includes('[REDACTED]'));
check('audit sanitizer redacts URL query credentials', sanitized.includes('token=[REDACTED]'));

const exported = sanitizedAuditExport([{
  seq: 1, id: 'entry-1', recordedAt: new Date(0).toISOString(), stream: 'gateway', payload,
  previousHash: '0'.repeat(64), hash: '1'.repeat(64),
}]);
check('sanitized export preserves entry metadata', exported.count === 1 && exported.entries[0]?.hash === '1'.repeat(64));
check('sanitized export omits the raw secret from its payload', !JSON.stringify(exported).includes(rawToken));
console.log(`\n${pass} audit sanitization checks passed`);
