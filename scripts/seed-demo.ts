/**
 * Seed deterministic demo fixture for hackathon presentation:
 * 1. Allowed Read (Safe inspection)
 * 2. Blocked Destructive Action (Policy prevention)
 * 3. Human-Review Request (HITL pending in review queue)
 */
import { request } from 'node:http';

const PORT = Number(process.env.ENGINE_PORT ?? 9000);

function sendJson(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = request({
      host: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {},
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 500, data: d ? JSON.parse(d) : null });
        } catch {
          resolve({ status: res.statusCode ?? 500, data: d });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`[GuardSaaB Demo Seeder] Connecting to engine on 127.0.0.1:${PORT}...`);
  try {
    const health = await sendJson('GET', '/health');
    if (health.status !== 200) {
      console.error(`Engine not healthy (HTTP ${health.status}). Start engine first: npm run engine`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Cannot connect to engine on 127.0.0.1:${PORT}. Make sure it is running: npm run engine`);
    process.exit(1);
  }

  console.log('Seeding scenario 1: Harmless Read -> ALLOWED');
  await sendJson('POST', '/intercept', {
    tool: 'Read',
    input: { file_path: 'README.md' },
    sessionId: 'demo-session-safe',
  });

  console.log('Seeding scenario 2: Blocked Destructive Action -> POLICY BLOCKED');
  await sendJson('POST', '/intercept', {
    tool: 'Bash',
    input: { command: 'rm -rf /production-database' },
    sessionId: 'demo-session-attack',
  });

  console.log('Seeding scenario 3: High-Risk Action -> HELD FOR HITL REVIEW');
  // Trigger a held request asynchronously so it stays pending in the approval queue
  const holdReq = request({
    host: '127.0.0.1',
    port: PORT,
    path: '/intercept',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  holdReq.write(JSON.stringify({
    tool: 'Bash',
    input: { command: 'git push --force origin main' },
    sessionId: 'demo-session-review',
  }));
  holdReq.end();

  // Wait briefly for engine to register the violation
  await new Promise((r) => setTimeout(r, 400));
  const pending = await sendJson('GET', '/pending');
  console.log(`\nDemo fixture seeded successfully!`);
  console.log(`- Total pending reviews in queue: ${pending.data?.pending?.length ?? 0}`);
  console.log(`- Open GuardSaaB Console: http://127.0.0.1:5174/ or http://127.0.0.1:9000/`);
  console.log(`- Open Northstar Works: http://127.0.0.1:5173/`);
}

main().catch((err) => {
  console.error('Failed to seed demo fixture:', err);
  process.exit(1);
});
