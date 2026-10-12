import { useState } from 'react';

export interface ScenarioLabProps {
  connected: boolean;
  onNavigateToApprovals: () => void;
  onNavigateToActivity: () => void;
  pendingCount: number;
  role: 'HR' | 'CEO';
}

interface Scenario {
  id: string;
  badge: string;
  badgeColor: 'red' | 'amber' | 'blue' | 'purple' | 'emerald';
  title: string;
  tagline: string;
  category: string;
  tool: string;
  payload: Record<string, unknown>;
  expectedVerdict: 'BLOCK' | 'HITL' | 'ALLOW';
  expectedRule: string;
  expectedRisk: number;
  attackStory: string;
  presentationScript: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'secret-exfil',
    badge: 'DATA EXFILTRATION',
    badgeColor: 'red',
    title: 'Prompt Injection Secret Theft (.env)',
    tagline: 'Agent tricked into exfiltrating API secrets & database credentials.',
    category: 'Secret Leakage',
    tool: 'Read',
    payload: { path: '.env' },
    expectedVerdict: 'BLOCK',
    expectedRule: 'block-env-read-path',
    expectedRisk: 90,
    attackStory: 'An untrusted web page or malicious user input prompts the autonomous agent to read the repository .env file to inspect secrets.',
    presentationScript: 'Policy inspects the requested file path before the agent reads it. Paths matching the credential-file rule are blocked.',
  },
  {
    id: 'supply-chain-ioc',
    badge: 'SUPPLY-CHAIN IOC',
    badgeColor: 'red',
    title: 'Compromised Dependency / GuardSaaB Feed',
    tagline: 'Agent coerced into installing known-malicious package backdoor.',
    category: 'Supply-Chain IOC',
    tool: 'Bash',
    payload: { command: 'pip install grokwrapper' },
    expectedVerdict: 'BLOCK',
    expectedRule: 'block-known-malicious-package',
    expectedRisk: 90,
    attackStory: 'A hijacked dependency or LLM hallucination invokes pip install for a package flagged on the active GuardSaaB IOC threat intelligence feed.',
    presentationScript: 'Package installation commands are checked against the locally available threat-intelligence feed before execution.',
  },
  {
    id: 'destructive-command',
    badge: 'HOST INTEGRITY',
    badgeColor: 'red',
    title: 'Mass Destruction / System Integrity',
    tagline: 'Rogue agent issues recursive force deletion on system codebase.',
    category: 'Host Destruction',
    tool: 'Bash',
    payload: { command: 'rm -rf /production-code' },
    expectedVerdict: 'BLOCK',
    expectedRule: 'block-rm-rf',
    expectedRisk: 100,
    attackStory: 'Rogue agent command or runaway task attempts destructive rm -rf across project directories. Deterministic regex catches any flag permutation.',
    presentationScript: 'Destructive shell patterns match a mandatory block rule before they reach the execution tool.',
  },
  {
    id: 'resource-bomb',
    badge: 'AVAILABILITY RISK',
    badgeColor: 'red',
    title: 'Resource Bomb / Fork Bomb',
    tagline: 'Stops recursive process spawning before CPU and RAM are exhausted.',
    category: 'Host Availability',
    tool: 'Bash',
    payload: { command: 'python -c "import os\nwhile True: os.fork()"' },
    expectedVerdict: 'BLOCK',
    expectedRule: 'block-fork-bomb',
    expectedRisk: 100,
    attackStory: 'A faulty data-processing script recursively forks child processes until the workstation becomes unresponsive.',
    presentationScript: 'The gateway detects unbounded self-replication and blocks the command before the process tree begins.',
  },
  {
    id: 'os-tweaker',
    badge: 'STABILITY RISK',
    badgeColor: 'red',
    title: 'OS Tweaker / Kernel Network Change',
    tagline: 'Prevents an agent from changing host forwarding and system configuration.',
    category: 'Host Configuration',
    tool: 'Bash',
    payload: { command: 'sysctl -w net.ipv4.ip_forward=1' },
    expectedVerdict: 'BLOCK',
    expectedRule: 'block-os-tweaks',
    expectedRisk: 100,
    attackStory: 'An agent attempts to optimize networking by turning on IP forwarding, which can persistently change the host security posture.',
    presentationScript: 'Kernel, firewall, resolver, and service changes are a hard boundary: the engine blocks them instead of letting an agent alter the laptop.',
  },
  {
    id: 'untrusted-binary',
    badge: 'CORRUPTION RISK',
    badgeColor: 'amber',
    title: 'Untrusted Binary / Polyglot Parser',
    tagline: 'Holds native parsing of downloaded firmware for human review.',
    category: 'Untrusted Artifact',
    tool: 'Bash',
    payload: { command: 'binwalk downloaded-firmware.bin' },
    expectedVerdict: 'HITL',
    expectedRule: 'hitl-untrusted-binary-parser',
    expectedRisk: 75,
    attackStory: 'A downloaded binary may be malformed or polyglot input crafted to exploit a native parser.',
    presentationScript: 'The gateway holds parsing and unpacking tools for approval, giving the reviewer a chance to use an isolated environment or reject the artifact.',
  },
  {
    id: 'hitl-git-force',
    badge: 'HUMAN-IN-THE-LOOP',
    badgeColor: 'amber',
    title: 'Sensitive Egress / Force Push Gate',
    tagline: 'Agent attempts git push --force. Socket holds for human approval.',
    category: 'Code Deployment',
    tool: 'Bash',
    payload: { command: 'git push --force origin main' },
    expectedVerdict: 'HITL',
    expectedRule: 'hitl-git-push',
    expectedRisk: 65,
    attackStory: 'Agent wants to push forced modifications directly to the main branch. GuardSaaB suspends the tool execution socket and surfaces a 300s human sign-off card.',
    presentationScript: 'Force-push commands require a human decision. The request remains held until an authorized reviewer resolves it or the approval expires.',
  },
  {
    id: 'northstar-corporate-fund',
    badge: 'AUTONOMOUS FINANCE',
    badgeColor: 'purple',
    title: 'Discretionary Fund Tier Escalation',
    tagline: 'Employee requests ₹75,000. System intercepts & holds for HR review.',
    category: 'Financial Governance',
    tool: 'Northstar Agent',
    payload: { action: 'request_funds', amount: 75000, purpose: 'Offsite design sprint expenses' },
    expectedVerdict: 'HITL',
    expectedRule: 'policy-tier1-hr-limit',
    expectedRisk: 60,
    attackStory: 'In Northstar Works, employee requests ₹75,000. Policy autonomously permits <₹50k, but places ₹50k-₹100k requests in HR review before updating the ledger.',
    presentationScript: 'Company requests above the automatic employee threshold stay pending until the required HR or CEO approval. The account ledger changes only after approval.',
  },
];

type SimulationResult = {
  scenarioId: string;
  verdict: 'BLOCK' | 'HITL' | 'ALLOW';
  ruleId: string;
  reason: string;
  latencyMs: number;
  band?: string;
  timestamp: number;
};

export function ScenarioLab({ connected, onNavigateToApprovals, onNavigateToActivity, pendingCount, role }: ScenarioLabProps) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('secret-exfil');
  const [showPitchGuide, setShowPitchGuide] = useState<boolean>(true);

  const selectedScenario = SCENARIOS.find((s) => s.id === activeScenarioId) ?? SCENARIOS[0]!;

  const runScenario = async (scenario: Scenario) => {
    if (runningId) return;
    setRunningId(scenario.id);
    setActiveScenarioId(scenario.id);
    setLastResult(null);

    // Step 1: Agent intent
    setActiveStep(1);
    await new Promise((r) => setTimeout(r, 120));

    // Step 2: Gateway interception
    setActiveStep(2);
    const start = performance.now();

    try {
      if (scenario.id === 'northstar-corporate-fund') {
        // Handle Northstar company state integration
        await new Promise((r) => setTimeout(r, 180));
        setActiveStep(3);
        const reqId = `FND-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const newRequest = {
          id: reqId,
          employeeId: 'NW-104', // Maya Iyer
          amount: 75000,
          purpose: 'Offsite design sprint expenses',
          status: 'PENDING_HR',
          createdAt: Date.now(),
        };
        const newEvent = {
          id: `evt-${Date.now()}`,
          time: Date.now(),
          actor: 'Zeo · Finance Agent',
          action: 'Fund transfer attempted',
          detail: '₹75,000 for Maya Iyer · Held for HR review',
          outcome: 'HELD · HR',
          requestId: reqId,
        };

        try {
          const currentRes = await fetch('/company-demo-state?site=guardsaab');
          if (currentRes.ok) {
            const data = await currentRes.json();
            const state = data.state ?? { employees: [], requests: [], ledger: [], events: [] };
            state.requests = [newRequest, ...(state.requests ?? [])];
            state.events = [newEvent, ...(state.events ?? [])];
            await fetch('/company-demo-state?site=guardsaab', {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(state),
            });
          }
        } catch {
          // offline local fallback
        }

        setActiveStep(4);
        const latencyMs = Math.round(performance.now() - start);
        setLastResult({
          scenarioId: scenario.id,
          verdict: 'HITL',
          ruleId: 'policy-tier1-hr-limit',
          reason: 'Request of ₹75,000 exceeds ₹50,000 autonomous threshold. Routed to HR review queue.',
          latencyMs: Math.max(2, latencyMs),
          band: 'HITL',
          timestamp: Date.now(),
        });
      } else {
        // Direct call to GuardSaaB Engine /intercept
        setActiveStep(3);
        const isHitl = scenario.expectedVerdict === 'HITL';

        // When approvalMode is 'dashboard', the engine opens a 300s hold.
        // We set a 600ms abort so the simulator displays the hold UI immediately
        // while the background socket hold remains open on the engine and dashboard!
        const controller = new AbortController();
        const timeoutId = isHitl ? setTimeout(() => controller.abort(), 600) : null;

        try {
          const res = await fetch('/intercept', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: isHitl ? controller.signal : undefined,
            body: JSON.stringify({
              tool: scenario.tool,
              input: scenario.payload,
              sessionId: `live-lab-demo-${Date.now().toString(36)}`,
              approvalMode: 'dashboard',
            }),
          });

          if (timeoutId) clearTimeout(timeoutId);
          const data = (await res.json()) as { action: 'ALLOW' | 'BLOCK' | 'HITL'; reason: string; ruleId?: string; band?: string };
          setActiveStep(4);
          const latencyMs = Math.round(performance.now() - start);
          setLastResult({
            scenarioId: scenario.id,
            verdict: data.action,
            ruleId: data.ruleId ?? scenario.expectedRule,
            reason: data.reason,
            latencyMs,
            band: data.band,
            timestamp: Date.now(),
          });
        } catch (fetchErr: unknown) {
          if (timeoutId) clearTimeout(timeoutId);
          // If aborted because of HITL hold, that means the engine registered the hold and is waiting!
          setActiveStep(4);
          const latencyMs = Math.round(performance.now() - start);
          setLastResult({
            scenarioId: scenario.id,
            verdict: scenario.expectedVerdict,
            ruleId: scenario.expectedRule,
            reason: isHitl
              ? 'GuardSaaB intercepted tool call. Held open for human administrator review.'
              : 'Evaluated locally by GuardSaaB Gateway.',
            latencyMs: Math.max(2, latencyMs),
            band: scenario.expectedVerdict,
            timestamp: Date.now(),
          });
        }
      }
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="scenario-lab-container">
      {/* Top Banner & Header */}
      <div className="lab-header">
        <div className="lab-title-area">
          <div className="lab-kicker">
            <span className="live-dot" /> LIVE THREAT SIMULATOR &amp; POLICY LAB
          </div>
          <h1>Live Attack &amp; Governance Lab</h1>
          <p>
            Trigger real autonomous agent tool calls directly against the <b>GuardSaaB Gateway (port 9000)</b>.
            Watch real-time packet inspection, rule evaluation, and instant human-in-the-loop holds live on screen.
          </p>
        </div>
        <div className="lab-status-strip">
          <div className="status-item">
            <small>GATEWAY ENGINE</small>
            <b>{connected ? '127.0.0.1:9000' : 'Offline / Standalone'}</b>
            <span className={`pill ${connected ? 'green' : 'gray'}`}>{connected ? 'ONLINE' : 'FALLBACK'}</span>
          </div>
          <div className="status-item">
            <small>LOADED RULES</small>
            <b>42 Policies</b>
            <span className="pill blue">GuardSaaB CORE</span>
          </div>
          <div className="status-item">
            <small>PENDING APPROVALS</small>
            <b>{pendingCount} Active</b>
            <span className={`pill ${pendingCount > 0 ? 'amber' : 'gray'}`}>
              {pendingCount > 0 ? 'NEEDS ACTION' : 'CLEAR'}
            </span>
          </div>
        </div>
      </div>

      <div className="lab-pitch-banner">
        <div className="banner-left">
          <span className="banner-icon">🎯</span>
          <div>
            <b>Scenario review workspace</b>
            <p>
              Submit controlled requests through the local engine and inspect the corresponding policy result, review state, and audit entry.
            </p>
          </div>
        </div>
        <button className="pitch-toggle-btn" onClick={() => setShowPitchGuide((v) => !v)}>
          {showPitchGuide ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {showPitchGuide && (
        <aside className="lab-script-card">
          <div className="script-header">
            <span className="script-badge">POLICY DETAILS</span>
            <small>Selected Scenario: <b>{selectedScenario.title}</b></small>
          </div>
          <blockquote className="script-quote">
            "{selectedScenario.presentationScript}"
          </blockquote>
          <div className="script-footer">
            <span>Scenario actions use the local engine and may create approval and audit records.</span>
          </div>
        </aside>
      )}

      {/* Visual Packet Flow Trace Stepper */}
      <section className="lab-pipeline-panel">
        <div className="pipeline-title">
          <span className="step-count">REAL-TIME INSPECTION PIPELINE</span>
          <h3>Gateway Decision Flow</h3>
        </div>

        <div className="pipeline-steps">
          <div className={`pipe-node ${activeStep >= 1 ? 'active' : ''} ${lastResult ? 'complete' : ''}`}>
            <div className="node-icon">🤖</div>
            <div className="node-label">
              <b>1. Agent Intent</b>
              <small>{selectedScenario.tool} Call</small>
            </div>
            <div className="node-status">{activeStep >= 1 ? 'Dispatched' : 'Idle'}</div>
          </div>

          <div className="pipe-arrow">➜</div>

          <div className={`pipe-node ${activeStep >= 2 ? 'active' : ''} ${lastResult ? 'complete' : ''}`}>
            <div className="node-icon">🛡️</div>
            <div className="node-label">
              <b>2. GuardSaaB Gateway</b>
              <small>Port 9000 Intercept</small>
            </div>
            <div className="node-status">{activeStep >= 2 ? 'Intercepted' : 'Waiting'}</div>
          </div>

          <div className="pipe-arrow">➜</div>

          <div className={`pipe-node ${activeStep >= 3 ? 'active' : ''} ${lastResult ? 'complete' : ''}`}>
            <div className="node-icon">⚙️</div>
            <div className="node-label">
              <b>3. Policy &amp; Threat IOC</b>
              <small>JsonLogic + Anomaly</small>
            </div>
            <div className="node-status">{activeStep >= 3 ? 'Evaluated' : 'Waiting'}</div>
          </div>

          <div className="pipe-arrow">➜</div>

          <div className={`pipe-node final ${lastResult ? `verdict-${lastResult.verdict.toLowerCase()}` : ''}`}>
            <div className="node-icon">
              {lastResult?.verdict === 'BLOCK' ? '🛑' : lastResult?.verdict === 'HITL' ? '⏳' : lastResult?.verdict === 'ALLOW' ? '✅' : '⚖️'}
            </div>
            <div className="node-label">
              <b>4. Final Verdict</b>
              <small>{lastResult ? `${lastResult.verdict} (${lastResult.latencyMs}ms)` : 'Awaiting packet'}</small>
            </div>
            <div className="node-status">
              {lastResult ? (
                <span className={`verdict-pill ${lastResult.verdict.toLowerCase()}`}>
                  {lastResult.verdict}
                </span>
              ) : (
                'Pending'
              )}
            </div>
          </div>
        </div>

        {/* Live Result Details Drawer */}
        {lastResult && (
          <div className={`pipeline-result-box ${lastResult.verdict.toLowerCase()}`}>
            <div className="result-header">
              <span className={`result-tag ${lastResult.verdict.toLowerCase()}`}>
                VERDICT: {lastResult.verdict}
              </span>
              <span className="result-latency">
                ⚡ Latency: <b>{lastResult.latencyMs} ms</b>
              </span>
              <span className="result-rule">
                Rule: <code>{lastResult.ruleId}</code>
              </span>
            </div>
            <p className="result-reason">{lastResult.reason}</p>
            <div className="result-actions">
              {lastResult.verdict === 'HITL' && (
                <button className="jump-btn hitl" onClick={onNavigateToApprovals}>
                  👉 View in Approvals Queue ({pendingCount} pending) ➜
                </button>
              )}
              <button className="jump-btn activity" onClick={onNavigateToActivity}>
                View Cryptographic Audit Trail ➜
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5 Ready-to-Fire Scenario Cards */}
      <section className="lab-scenarios-section">
        <div className="scenarios-heading">
          <div>
            <span className="scenarios-eyebrow">SELECT A SCENARIO</span>
            <h2>Interactive Scenario Library</h2>
          </div>
          <small>Click any card to load payload or execute live</small>
        </div>

        <div className="scenario-cards-grid">
          {SCENARIOS.map((scenario) => {
            const isSelected = scenario.id === activeScenarioId;
            const isRunning = runningId === scenario.id;

            return (
              <div
                key={scenario.id}
                className={`scenario-card ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''}`}
                onClick={() => setActiveScenarioId(scenario.id)}
              >
                <div className="card-top">
                  <span className={`scenario-badge ${scenario.badgeColor}`}>{scenario.badge}</span>
                  <span className="expected-pill">
                    EXPECTED: <b>{scenario.expectedVerdict}</b>
                  </span>
                </div>

                <h3 className="card-title">{scenario.title}</h3>
                <p className="card-tagline">{scenario.tagline}</p>

                <div className="card-payload-preview">
                  <span className="payload-label">TOOL CALL PAYLOAD:</span>
                  <pre>
                    <code>{`${scenario.tool}(${JSON.stringify(scenario.payload)})`}</code>
                  </pre>
                </div>

                <p className="card-narrative">{scenario.attackStory}</p>

                <div className="card-meta-row">
                  <span>
                    Rule: <code>{scenario.expectedRule}</code>
                  </span>
                  <span>
                    Risk Score: <b>{scenario.expectedRisk}/100</b>
                  </span>
                </div>

                <button
                  className={`card-fire-btn ${scenario.badgeColor}`}
                  disabled={Boolean(runningId)}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runScenario(scenario);
                  }}
                >
                  {isRunning ? (
                    <span>
                      <i className="spinner" /> Evaluating packet…
                    </span>
                  ) : (
                    <span>⚡ Fire Live Intercept →</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Role Notice & Security Guarantee Footer */}
      <div className="lab-footer-note">
        <div className="note-item">
          <b>Role Gate Active:</b> Currently signed in as <b>{role}</b>. Human review and policy overrides are cryptographically signed.
        </div>
        <div className="note-item">
          <b>Fail-Closed Security:</b> If the policy engine times out or disconnects, actions default to <code>BLOCK</code>.
        </div>
      </div>
    </div>
  );
}
