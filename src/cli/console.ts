/**
 * GuardSaaB Console — a dependency-free terminal companion to the web cockpit.
 *
 * The console intentionally talks to the same loopback HTTP API as the dashboard;
 * it does not reimplement policy evaluation or bypass the approval store.
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { numEnv, strEnv } from '../config/env.js';

type Action = 'ALLOW' | 'BLOCK' | 'ASK' | 'HITL';
type Scenario = { name: string; title: string; tool: string; input: Record<string, unknown>; note: string };

const SCENARIOS: readonly Scenario[] = [
  { name: 'secret-exfil', title: 'Prompt injection secret theft', tool: 'Read', input: { path: '.env' }, note: 'Blocks credential-file access.' },
  { name: 'supply-chain-ioc', title: 'Compromised dependency', tool: 'Bash', input: { command: 'pip install grokwrapper' }, note: 'Blocks a known malicious package IOC.' },
  { name: 'destructive-command', title: 'Mass deletion', tool: 'Bash', input: { command: 'rm -rf /production-code' }, note: 'Blocks recursive force deletion.' },
  { name: 'resource-bomb', title: 'Resource bomb / fork bomb', tool: 'Bash', input: { command: 'python -c "import os\nwhile True: os.fork()"' }, note: 'Blocks unbounded process creation.' },
  { name: 'os-tweaker', title: 'OS configuration change', tool: 'Bash', input: { command: 'sysctl -w net.ipv4.ip_forward=1' }, note: 'Blocks host network/kernel changes.' },
  { name: 'untrusted-binary', title: 'Untrusted binary parser', tool: 'Bash', input: { command: 'binwalk downloaded-firmware.bin' }, note: 'Requests human review before native parsing.' },
  { name: 'force-push', title: 'Force push', tool: 'Bash', input: { command: 'git push --force origin main' }, note: 'Requests human review before remote deployment.' },
];

const endpoint = (path: string): string => `http://${strEnv('ENGINE_HOST', '127.0.0.1')}:${numEnv('ENGINE_PORT', 9000)}${path}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint(path), { headers: { 'content-type': 'application/json' }, ...init });
  } catch {
    throw new Error(`Cannot reach GuardSaaB at ${endpoint('/health')}. Start it with \`guardsaab engine\`.`);
  }
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Engine returned HTTP ${response.status}.`);
  return body;
}

const line = (label: string, value: unknown): void => { output.write(`${label.padEnd(18)} ${String(value ?? '—')}\n`); };
const title = (value: string): void => { output.write(`\n${value}\n${'─'.repeat(value.length)}\n`); };

async function status(): Promise<void> {
  const health = await api<{ ok: boolean; uptimeSeconds: number; pendingApprovals: number; approvalSurface: string; auditStorage: string; injectionClassifier: string; policy: string }>('/health');
  title('GuardSaaB status');
  line('Engine', health.ok ? 'ONLINE' : 'DEGRADED');
  line('Uptime', `${health.uptimeSeconds}s`);
  line('Policy', health.policy);
  line('Approval surface', health.approvalSurface);
  line('Pending reviews', health.pendingApprovals);
  line('Audit storage', health.auditStorage);
  line('Injection classifier', health.injectionClassifier);
}

async function pending(): Promise<void> {
  const data = await api<{ pending: Array<{ id: string; toolCall: { tool: string; input: Record<string, unknown>; sessionId?: string }; ruleId?: string; reason: string; createdAt: number; ttlMs: number; risk?: { score: number; band: string } }> }>('/pending');
  title(`Approval queue (${data.pending.length})`);
  if (!data.pending.length) { output.write('No actions await review.\n'); return; }
  for (const item of data.pending) {
    output.write(`\n${item.id}  ${item.risk?.band ?? 'HITL'}${item.risk ? ` · risk ${item.risk.score}` : ''}\n`);
    line('Tool', item.toolCall.tool);
    line('Rule', item.ruleId);
    line('Request', JSON.stringify(item.toolCall.input));
    line('Reason', item.reason);
  }
}

async function decide(id: string, action: 'ALLOW' | 'BLOCK'): Promise<void> {
  await api<{ ok: boolean }>('/decision', { method: 'POST', body: JSON.stringify({ type: 'decision', violationId: id, action }) });
  output.write(`${action === 'ALLOW' ? 'Approved' : 'Denied'} ${id}.\n`);
}

async function activity(): Promise<void> {
  const data = await api<{ sessions: Array<{ sessionId: string; startedAt?: number; updatedAt?: number; actions?: number; blocks?: number; holds?: number; risk?: string }> }>('/sessions');
  title(`Activity / sessions (${data.sessions.length})`);
  if (!data.sessions.length) { output.write('No recorded sessions.\n'); return; }
  for (const item of data.sessions) output.write(`${item.sessionId}  actions=${item.actions ?? 0}  blocks=${item.blocks ?? 0}  holds=${item.holds ?? 0}  ${item.risk ?? ''}\n`);
}

async function session(id: string): Promise<void> {
  const data = await api<{ timeline?: Array<{ event: string; ts: number; tool?: string; action?: string; reason?: string }>; events?: Array<{ event: string; ts: number; tool?: string; action?: string; reason?: string }> }>(`/sessions/${encodeURIComponent(id)}/timeline`);
  const events = data.timeline ?? data.events ?? [];
  title(`Session ${id}`);
  if (!events.length) { output.write('No timeline events.\n'); return; }
  for (const event of events) output.write(`${new Date(event.ts).toLocaleString()}  ${event.action ?? event.event}  ${event.tool ?? ''}  ${event.reason ?? ''}\n`);
}

async function simulate(name: string): Promise<void> {
  const scenario = SCENARIOS.find((item) => item.name === name);
  if (!scenario) throw new Error(`Unknown scenario "${name}". Run \`guardsaab console scenarios\`.`);
  const result = await api<{ action: Action; ruleId?: string; reason: string; band?: string; sessionId?: string }>('/intercept', {
    method: 'POST',
    body: JSON.stringify({ tool: scenario.tool, input: scenario.input, sessionId: `cli-sim-${Date.now().toString(36)}`, approvalMode: 'ask' }),
  });
  title(scenario.title);
  line('Outcome', result.action);
  line('Risk band', result.band);
  line('Rule', result.ruleId);
  line('Reason', result.reason);
  line('Scenario', scenario.note);
}

function scenarios(): void {
  title('Built-in scenarios');
  for (const item of SCENARIOS) output.write(`${item.name.padEnd(20)} ${item.title} — ${item.note}\n`);
}

export function printConsoleHelp(): void {
  output.write(`\nGuardSaaB terminal console\n\nCommands:\n  status                         engine health and governance posture\n  scenarios                      list the website-equivalent security demonstrations\n  simulate <scenario>            run a safe simulated tool call through the live engine\n  pending                        display actions awaiting human review\n  approve <id> | deny <id>       resolve an item in the approval queue\n  activity                       list recorded agent sessions\n  session <id>                   show a session timeline\n  help                           show this command list\n  exit                           close interactive mode\n\nOne-shot use: guardsaab console <command>\n`);
}

async function runCommand(words: string[]): Promise<boolean> {
  const [command, ...args] = words;
  switch (command?.toLowerCase()) {
    case 'status': await status(); return true;
    case 'scenarios': scenarios(); return true;
    case 'simulate': await simulate(args[0] ?? ''); return true;
    case 'pending': await pending(); return true;
    case 'approve': await decide(required(args[0], 'approval ID'), 'ALLOW'); return true;
    case 'deny': await decide(required(args[0], 'approval ID'), 'BLOCK'); return true;
    case 'activity': await activity(); return true;
    case 'session': await session(required(args[0], 'session ID')); return true;
    case 'help': printConsoleHelp(); return true;
    case 'exit': case 'quit': return false;
    default: throw new Error(`Unknown console command "${command ?? ''}". Type \`help\` for commands.`);
  }
}

const required = (value: string | undefined, label: string): string => {
  if (!value) throw new Error(`A ${label} is required.`);
  return value;
};

export async function runConsole(argv: string[]): Promise<void> {
  if (argv.length) { await runCommand(argv); return; }
  printConsoleHelp();
  const rl = createInterface({ input, output, terminal: true });
  try {
    for (;;) {
      const raw = (await rl.question('guardsaab> ')).trim();
      if (!raw) continue;
      try { if (!(await runCommand(raw.split(/\s+/)))) break; }
      catch (err) { output.write(`Error: ${(err as Error).message}\n`); }
    }
  } finally { rl.close(); }
}
