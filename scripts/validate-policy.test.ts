import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JsonLogicPolicyEngine } from '../src/policy/engine.js';
import { validatePolicyFile } from '../src/cli/validate.js';

const dir = mkdtempSync(join(tmpdir(), 'guardsaab-policy-'));
const safePath = join(dir, 'safe.yaml');
writeFileSync(safePath, `default: HITL\nrules:\n  - id: narrow-review\n    description: Review ordinary shell execution first.\n    action: HITL\n    when:\n      and:\n        - "==": [{ var: tool }, Bash]\n        - "==": [{ var: command }, printf hello]\n  - id: broad-block\n    description: This lower priority rule must not override the first match.\n    action: BLOCK\n    when:\n      "==": [{ var: tool }, Bash]\n`);
if (validatePolicyFile(safePath).length) throw new Error('A valid rule file was rejected.');
const engine = new JsonLogicPolicyEngine(safePath);
const result = engine.evaluate({ tool: 'Bash', input: { command: 'printf hello' } });
if (result.action !== 'HITL' || result.ruleId !== 'narrow-review') throw new Error('Rule order did not follow first-match priority.');

const invalidPath = join(dir, 'invalid.yaml');
writeFileSync(invalidPath, `default: HITL\nrules:\n  - id: duplicate\n    description: First.\n    action: ALLOW\n    when:\n      matches: ["(", { var: command }]\n  - id: duplicate\n    description: Duplicate.\n    action: BLOCK\n    when: true\n`);
const problems = validatePolicyFile(invalidPath);
if (!problems.some((problem) => problem.message.includes('invalid regex')) || !problems.some((problem) => problem.message.includes('duplicate rule id'))) throw new Error('Validator missed malformed regex or duplicate rule ID.');

const unsafePath = join(dir, 'unsafe.yaml');
writeFileSync(unsafePath, `default: HITL\nrules:\n  - id: backtracking\n    description: Reject pathological nested repetition.\n    action: BLOCK\n    when:\n      matches: ["^(a+)+$", { var: command }]\n`);
if (!validatePolicyFile(unsafePath).some((problem) => problem.message.includes('nested repetition'))) throw new Error('Validator missed a nested-repetition regex.');

const defaultPolicy = validatePolicyFile(resolve(import.meta.dirname, '..', 'rules', 'default_policy.yaml'));
if (defaultPolicy.length) throw new Error(`The bundled policy failed validation: ${defaultPolicy.map((problem) => problem.message).join('; ')}`);
console.log('Policy validation checks passed: first-match order, malformed/unsafe regex, duplicate IDs, bundled rules.');
