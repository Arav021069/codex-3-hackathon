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
type Flags = Record<string, string | boolean>;
type Parsed = { positional: string[]; flags: Flags };
const VERSION = '0.1.0';

const SCENARIOS: readonly Scenario[] = [
  { name: 'secret-exfil', title: 'Prompt injection secret theft', tool: 'Read', input: { path: '.env' }, note: 'Blocks credential-file access.' },
  { name: 'supply-chain-ioc', title: 'Compromised dependency', tool: 'Bash', input: { command: 'pip install grokwrapper' }, note: 'Blocks a known malicious package IOC.' },
  { name: 'destructive-command', title: 'Mass deletion', tool: 'Bash', input: { command: 'rm -rf /production-code' }, note: 'Blocks recursive force deletion.' },
  { name: 'resource-bomb', title: 'Resource bomb / fork bomb', tool: 'Bash', input: { command: 'python -c "import os\nwhile True: os.fork()"' }, note: 'Blocks unbounded process creation.' },
  { name: 'os-tweaker', title: 'OS configuration change', tool: 'Bash', input: { command: 'sysctl -w net.ipv4.ip_forward=1' }, note: 'Blocks host network/kernel changes.' },
  { name: 'untrusted-binary', title: 'Untrusted binary parser', tool: 'Bash', input: { command: 'binwalk downloaded-firmware.bin' }, note: 'Requests human review before native parsing.' },
  { name: 'force-push', title: 'Force push', tool: 'Bash', input: { command: 'git push --force origin main' }, note: 'Requests human review before remote deployment.' },
];

const AGENTS = [
  ['AG-001', 'Finance Agent', 'Finance', 'Active', 'Company fund requests and account credits'],
  ['AG-002', 'Deployment Agent', 'Engineering', 'Guarded', 'Build, release, and deployment workflows'],
  ['AG-003', 'Zeo · Company Agent', 'People Operations', 'Active', 'Employee lookups and guided fund requests'],
] as const;

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
const json = (value: unknown): void => { output.write(`${JSON.stringify(value, null, 2)}\n`); };
const has = (flags: Flags, name: string): boolean => flags[name] === true;
const text = (flags: Flags, name: string): string | undefined => typeof flags[name] === 'string' ? flags[name] : undefined;
const limitOf = (flags: Flags, fallback: number): number => Math.min(500, Math.max(1, Number(text(flags, 'limit')) || fallback));

function parse(words: string[]): Parsed {
  const positional: string[] = []; const flags: Flags = {};
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (!word.startsWith('--')) { positional.push(word); continue; }
    const [key, equals] = word.slice(2).split('=', 2);
    if (!key) throw new Error('Invalid empty flag.');
    if (equals !== undefined) { flags[key] = equals; continue; }
    const next = words[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
  }
  return { positional, flags };
}

function only(flags: Flags, allowed: readonly string[]): void {
  for (const key of Object.keys(flags)) {
    if (!allowed.includes(key)) throw new Error(`Unknown flag --${key}. Run the command with --help to see supported flags.`);
  }
}

function completion(shell: string): void {
  const commands = 'overview dashboard agent agents policy policies scenario scenarios simulate approval pending approve deny activity session sessions system status help exit quit completion';
  if (shell === 'bash') {
    output.write(`_guardsaab_console() {\n  local cur=\"${'${COMP_WORDS[COMP_CWORD]}'}\"\n  COMPREPLY=( $(compgen -W \"${commands}\" -- \"$cur\") )\n}\ncomplete -F _guardsaab_console guardsaab\n`);
    return;
  }
  if (shell === 'zsh') { output.write(`#compdef guardsaab\n_arguments '1: :(${commands})' '*: :->args'\n`); return; }
  if (shell === 'fish') { output.write(commands.split(' ').map((cmd) => `complete -c guardsaab -n '__fish_seen_subcommand_from console' -a '${cmd}'`).join('\n') + '\n'); return; }
  throw new Error('Choose one of: bash, zsh, fish.');
}

async function status(flags: Flags = {}): Promise<void> {
  const health = await api<{ ok: boolean; uptimeSeconds: number; pendingApprovals: number; approvalSurface: string; auditStorage: string; injectionClassifier: string; policy: string }>('/health');
  if (has(flags, 'json')) { json(health); return; }
  title('GuardSaaB status');
  line('Engine', health.ok ? 'ONLINE' : 'DEGRADED');
  line('Uptime', `${health.uptimeSeconds}s`);
  line('Policy', health.policy);
  line('Approval surface', health.approvalSurface);
  line('Pending reviews', health.pendingApprovals);
  line('Audit storage', health.auditStorage);
  line('Injection classifier', health.injectionClassifier);
}

async function overview(flags: Flags = {}): Promise<void> {
  const [health, queue, sessions] = await Promise.all([
    api<{ ok: boolean; uptimeSeconds: number; pendingApprovals: number; auditStorage: string }>('/health'),
    api<{ pending: Array<{ risk?: { band: string } }> }>('/pending'),
    api<{ sessions: Array<{ blocks?: number }> }>('/sessions'),
  ]);
  const metrics = {
    gateway: health.ok ? 'ONLINE' : 'DEGRADED', registeredAgents: AGENTS.length, pendingApprovals: queue.pending.length,
    blockedActions: sessions.sessions.reduce((sum, item) => sum + (item.blocks ?? 0), 0),
    highRiskEvents: queue.pending.filter((item) => item.risk?.band === 'BLOCK').length, auditStorage: health.auditStorage,
  };
  if (has(flags, 'json')) { json(metrics); return; }
  title('Governance overview');
  line('Gateway', metrics.gateway);
  line('Registered agents', metrics.registeredAgents);
  line('Pending approvals', metrics.pendingApprovals);
  line('Blocked actions', metrics.blockedActions);
  line('High-risk events', metrics.highRiskEvents);
  line('Audit storage', metrics.auditStorage);
}

function agents(flags: Flags = {}): void {
  const statusFilter = text(flags, 'status')?.toLowerCase();
  const departmentFilter = text(flags, 'department')?.toLowerCase();
  const entries = AGENTS.filter(([, , department, state]) => (!statusFilter || state.toLowerCase() === statusFilter) && (!departmentFilter || department.toLowerCase().includes(departmentFilter)));
  if (has(flags, 'json')) return json(entries.map(([id, name, department, state, detail]) => ({ id, name, department, status: state, detail })));
  title(`Agent registry (${entries.length})`);
  for (const [id, name, department, state, detail] of entries) output.write(`${id}  ${state.padEnd(7)} ${name} · ${department}\n  ${detail}\n`);
}

async function policies(flags: Flags = {}): Promise<void> {
  const data = await api<{ default: string; count: number; rules: Array<{ id: string; description: string; action: string }> }>('/policies');
  const term = text(flags, 'search')?.toLowerCase();
  const action = text(flags, 'action')?.toUpperCase();
  const rules = data.rules.filter((rule) => (!term || `${rule.id} ${rule.description} ${rule.action}`.toLowerCase().includes(term)) && (!action || rule.action === action)).slice(0, limitOf(flags, data.count));
  if (has(flags, 'json')) return json({ default: data.default, count: data.count, rules });
  title(`Policies (${rules.length}/${data.count}; default ${data.default})`);
  for (const rule of rules) output.write(`${rule.action.padEnd(5)} ${rule.id}\n  ${rule.description}\n`);
}

async function pending(flags: Flags = {}): Promise<void> {
  const data = await api<{ pending: Array<{ id: string; toolCall: { tool: string; input: Record<string, unknown>; sessionId?: string }; ruleId?: string; reason: string; createdAt: number; ttlMs: number; risk?: { score: number; band: string } }> }>('/pending');
  const risk = text(flags, 'risk')?.toUpperCase(); const tool = text(flags, 'tool')?.toLowerCase();
  const entries = data.pending.filter((item) => (!risk || item.risk?.band === risk) && (!tool || item.toolCall.tool.toLowerCase().includes(tool))).slice(0, limitOf(flags, data.pending.length));
  if (has(flags, 'json')) return json(entries);
  title(`Approval queue (${entries.length})`);
  if (!entries.length) { output.write('No actions await review.\n'); return; }
  for (const item of entries) {
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

async function activity(flags: Flags = {}): Promise<void> {
  const data = await api<{ entries: Array<{ event: string; ts: number; tool?: string; action?: string; reason?: string; sessionId?: string; risk?: { band: string; score: number } }> }>(`/activity?limit=${limitOf(flags, 100)}`);
  const action = text(flags, 'action')?.toUpperCase(); const sessionFilter = text(flags, 'session'); const search = text(flags, 'search')?.toLowerCase();
  const entries = data.entries.filter((entry) => (!action || entry.action === action || entry.risk?.band === action) && (!sessionFilter || entry.sessionId === sessionFilter) && (!search || `${entry.tool} ${entry.reason} ${entry.event}`.toLowerCase().includes(search)));
  if (has(flags, 'json')) return json(entries);
  title(`Activity logs (${entries.length})`);
  if (!entries.length) { output.write('No recorded activity.\n'); return; }
  for (const entry of entries) output.write(`${new Date(entry.ts).toLocaleString()}  ${(entry.action ?? entry.event).padEnd(14)} ${entry.tool ?? 'system'}${entry.risk ? ` · ${entry.risk.band}/${entry.risk.score}` : ''}\n  ${entry.reason ?? ''}${entry.sessionId ? ` · session ${entry.sessionId}` : ''}\n`);
}

async function sessions(flags: Flags = {}): Promise<void> {
  const data = await api<{ sessions: Array<{ sessionId: string; startedAt?: number; updatedAt?: number; actions?: number; blocks?: number; holds?: number; risk?: string }> }>('/sessions');
  const entries = data.sessions.filter((item) => !has(flags, 'blocked') || (item.blocks ?? 0) > 0).slice(0, limitOf(flags, data.sessions.length));
  if (has(flags, 'json')) return json(entries);
  title(`Agent sessions (${entries.length})`);
  if (!entries.length) { output.write('No recorded sessions.\n'); return; }
  for (const item of entries) output.write(`${item.sessionId}  actions=${item.actions ?? 0}  blocks=${item.blocks ?? 0}  holds=${item.holds ?? 0}  ${item.risk ?? ''}\n`);
}

async function session(id: string): Promise<void> {
  const data = await api<{ timeline?: Array<{ event: string; ts: number; tool?: string; action?: string; reason?: string }>; events?: Array<{ event: string; ts: number; tool?: string; action?: string; reason?: string }> }>(`/sessions/${encodeURIComponent(id)}/timeline`);
  const events = data.timeline ?? data.events ?? [];
  title(`Session ${id}`);
  if (!events.length) { output.write('No timeline events.\n'); return; }
  for (const event of events) output.write(`${new Date(event.ts).toLocaleString()}  ${event.action ?? event.event}  ${event.tool ?? ''}  ${event.reason ?? ''}\n`);
}

async function simulate(name: string, flags: Flags = {}): Promise<void> {
  const scenario = SCENARIOS.find((item) => item.name === name);
  if (!scenario) throw new Error(`Unknown scenario "${name}". Run \`guardsaab console scenarios\`.`);
  const result = await api<{ action: Action; ruleId?: string; reason: string; band?: string; sessionId?: string }>('/intercept', {
    method: 'POST',
    body: JSON.stringify({ tool: scenario.tool, input: scenario.input, sessionId: text(flags, 'session') ?? `cli-sim-${Date.now().toString(36)}`, approvalMode: 'ask' }),
  });
  if (has(flags, 'json')) return json({ scenario: scenario.name, ...result });
  title(scenario.title);
  line('Outcome', result.action);
  line('Risk band', result.band);
  line('Rule', result.ruleId);
  line('Reason', result.reason);
  line('Scenario', scenario.note);
}

function scenarios(flags: Flags = {}): void {
  if (has(flags, 'json')) return json(SCENARIOS);
  title('Built-in scenarios');
  for (const item of SCENARIOS) output.write(`${item.name.padEnd(20)} ${item.title} — ${item.note}\n`);
}

export function printConsoleHelp(): void {
  output.write(`\nGuardSaaB terminal console\n\nDashboard\n  overview | dashboard overview\n  agent list [--status STATE] [--department NAME] [--json]\n\nSecurity operations\n  policy list [--action ALLOW|HITL|BLOCK] [--search TEXT] [--limit N] [--json]\n  scenario list [--json]\n  scenario run <name> [--session ID] [--json]\n  approval list [--risk BAND] [--tool NAME] [--limit N] [--json]\n  approval approve <id> | approval deny <id>\n\nInvestigation\n  activity list [--limit N] [--action ACTION] [--session ID] [--search TEXT] [--json]\n  session list [--blocked] [--limit N] [--json]\n  session show <id>\n\nSystem\n  system status | status\n  completion <bash|zsh|fish>\n  --version | help | exit\n\nShort aliases remain: agents, policies, scenarios, simulate, pending, approve, deny, activity, sessions, session.\n`);
}

/** Command-local help is intentionally offline: operators can discover syntax during an engine outage. */
function printCommandHelp(positionals: string[]): void {
  const key = positionals.slice(0, 2).join(' ');
  const messages: Record<string, string> = {
    overview: 'Usage: guardsaab console overview [--json]\nShow the governance overview metrics.',
    dashboard: 'Usage: guardsaab console dashboard overview [--json]\nDashboard command group.',
    'dashboard overview': 'Usage: guardsaab console dashboard overview [--json]\nShow the governance overview metrics.',
    agent: 'Usage: guardsaab console agent list [--status STATE] [--department NAME] [--json]\nAgent command group.',
    agents: 'Usage: guardsaab console agents [--status STATE] [--department NAME] [--json]\nAlias for `agent list`.',
    'agent list': 'Usage: guardsaab console agent list [--status STATE] [--department NAME] [--json]\nList registered agents. STATE is Active or Guarded.',
    policies: 'Usage: guardsaab console policies [SEARCH] [--action ALLOW|HITL|BLOCK] [--limit N] [--json]\nAlias for `policy list`.',
    policy: 'Usage: guardsaab console policy list [--action ALLOW|HITL|BLOCK] [--search TEXT] [--limit N] [--json]\nPolicy command group.',
    'policy list': 'Usage: guardsaab console policy list [--action ALLOW|HITL|BLOCK] [--search TEXT] [--limit N] [--json]\nList loaded policies. N is 1–500.',
    scenarios: 'Usage: guardsaab console scenarios [--json]\nAlias for `scenario list`.',
    scenario: 'Usage: guardsaab console scenario <list|run> [...]\nScenario command group.',
    'scenario list': 'Usage: guardsaab console scenario list [--json]\nList safe built-in scenario demonstrations.',
    simulate: 'Usage: guardsaab console simulate <name> [--session ID] [--json]\nAlias for `scenario run`.',
    'scenario run': 'Usage: guardsaab console scenario run <name> [--session ID] [--json]\nRun a safe simulated policy evaluation; no represented shell command executes.',
    pending: 'Usage: guardsaab console pending [--risk BAND] [--tool NAME] [--limit N] [--json]\nAlias for `approval list`.',
    approval: 'Usage: guardsaab console approval <list|approve|deny> [...]\nApproval command group.',
    'approval list': 'Usage: guardsaab console approval list [--risk BAND] [--tool NAME] [--limit N] [--json]\nList held gateway approval requests.',
    'approval approve': 'Usage: guardsaab console approval approve <id>\nApprove a specific pending gateway request.',
    'approval deny': 'Usage: guardsaab console approval deny <id>\nBlock a specific pending gateway request.',
    approve: 'Usage: guardsaab console approve <id>\nAlias for `approval approve <id>`.',
    deny: 'Usage: guardsaab console deny <id>\nAlias for `approval deny <id>`.',
    activity: 'Usage: guardsaab console activity list [--limit N] [--action ACTION] [--session ID] [--search TEXT] [--json]\nShow sanitized audit activity.',
    'session list': 'Usage: guardsaab console session list [--blocked] [--limit N] [--json]\nList recorded agent sessions.',
    sessions: 'Usage: guardsaab console sessions [--blocked] [--limit N] [--json]\nAlias for `session list`.',
    'session show': 'Usage: guardsaab console session show <id>\nShow one session timeline.',
    session: 'Usage: guardsaab console session <id>\nAlias for `session show <id>`; use `session list` to browse.',
    status: 'Usage: guardsaab console status [--json]\nAlias for `system status`.',
    system: 'Usage: guardsaab console system status [--json]\nSystem command group.',
    'system status': 'Usage: guardsaab console system status [--json]\nShow engine health and active configuration.',
    completion: 'Usage: guardsaab console completion <bash|zsh|fish>\nPrint a shell-completion script to standard output.',
    exit: 'Usage: exit\nClose interactive mode.',
    quit: 'Usage: quit\nClose interactive mode.',
  };
  const message = messages[key] ?? messages[positionals[0] ?? ''] ?? null;
  if (message) output.write(`\n${message}\n`);
  else printConsoleHelp();
}

async function runCommand(words: string[]): Promise<boolean> {
  const { positional, flags } = parse(words);
  const [command, ...args] = positional;
  if (has(flags, 'help') || has(flags, 'h')) { printCommandHelp(positional); return true; }
  if (has(flags, 'version')) { only(flags, ['version']); output.write(`GuardSaaB console ${VERSION}\n`); return true; }
  switch (command?.toLowerCase()) {
    case 'overview': only(flags, ['json']); await overview(flags); return true;
    case 'dashboard': if (args[0] === 'overview') { only(flags, ['json']); await overview(flags); return true; } break;
    case 'agents': only(flags, ['status', 'department', 'json']); agents(flags); return true;
    case 'agent': if (args[0] === 'list') { only(flags, ['status', 'department', 'json']); agents(flags); return true; } break;
    case 'policies': only(flags, ['action', 'limit', 'json']); await policies({ ...flags, ...(args.length ? { search: args.join(' ') } : {}) }); return true;
    case 'policy': if (args[0] === 'list') { only(flags, ['action', 'search', 'limit', 'json']); await policies(flags); return true; } break;
    case 'status': only(flags, ['json']); await status(flags); return true;
    case 'system': if (args[0] === 'status') { only(flags, ['json']); await status(flags); return true; } break;
    case 'scenarios': only(flags, ['json']); scenarios(flags); return true;
    case 'scenario': if (args[0] === 'list') { only(flags, ['json']); scenarios(flags); return true; } if (args[0] === 'run') { only(flags, ['session', 'json']); await simulate(required(args[1], 'scenario name'), flags); return true; } break;
    case 'simulate': only(flags, ['session', 'json']); await simulate(args[0] ?? '', flags); return true;
    case 'pending': only(flags, ['risk', 'tool', 'limit', 'json']); await pending(flags); return true;
    case 'approval': if (args[0] === 'list') { only(flags, ['risk', 'tool', 'limit', 'json']); await pending(flags); return true; } if (args[0] === 'approve') { only(flags, []); await decide(required(args[1], 'approval ID'), 'ALLOW'); return true; } if (args[0] === 'deny') { only(flags, []); await decide(required(args[1], 'approval ID'), 'BLOCK'); return true; } break;
    case 'approve': await decide(required(args[0], 'approval ID'), 'ALLOW'); return true;
    case 'deny': await decide(required(args[0], 'approval ID'), 'BLOCK'); return true;
    case 'activity': if (!args.length || args[0] === 'list') { only(flags, ['limit', 'action', 'session', 'search', 'json']); await activity(flags); return true; } break;
    case 'sessions': only(flags, ['blocked', 'limit', 'json']); await sessions(flags); return true;
    case 'session': if (args[0] === 'list') { only(flags, ['blocked', 'limit', 'json']); await sessions(flags); return true; } if (args[0] === 'show') { only(flags, []); await session(required(args[1], 'session ID')); return true; } if (args[0]) { only(flags, []); await session(args[0]); return true; } break;
    case 'completion': only(flags, []); completion(required(args[0], 'shell')); return true;
    case 'help': printConsoleHelp(); return true;
    case 'exit': case 'quit': return false;
  }
  throw new Error(`Unknown or incomplete console command "${command ?? ''}". Type \`help\` for commands.`);
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
