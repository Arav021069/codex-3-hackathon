import { spawn, execSync, ChildProcess } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const COMPANY_URL = 'http://127.0.0.1:5173/';
const GUARDSAAB_URL = 'http://127.0.0.1:5174/';
const ENGINE_URL = 'http://127.0.0.1:9000/health';

function log(msg: string) {
  console.log(`[GuardSaaB Demo] ${msg}`);
}

async function waitUrl(url: string, timeoutMs: number = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function openBrowser(url: string) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // Ignore browser opener failure
  }
}

async function main() {
  console.log(`\n================================================================`);
  console.log(`            GUARDSAAB  |  NORTHSTAR WORKS`);
  console.log(`               Unified Presentation Launcher`);
  console.log(`================================================================\n`);

  // Credentials check
  const creds = join(ROOT, 'credentials.txt');
  const credsExample = join(ROOT, 'credentials.example.txt');
  if (!existsSync(creds) && existsSync(credsExample)) {
    log('credentials.txt not found. Initializing from credentials.example.txt...');
    copyFileSync(credsExample, creds);
  }

  // Docker check & PostgreSQL startup
  log('[1/4] Starting PostgreSQL container...');
  try {
    execSync('docker compose up -d --wait postgres', { stdio: 'inherit' });
    log('PostgreSQL is ready on 127.0.0.1:54329');
  } catch (err) {
    console.error('[ERROR] Failed to start PostgreSQL. Make sure Docker is running.');
    process.exit(1);
  }

  const procs: ChildProcess[] = [];
  const cleanup = () => {
    log('Stopping background services...');
    for (const p of procs) {
      if (p.pid && !p.killed) {
        try {
          if (process.platform === 'win32') {
            execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
          } else {
            p.kill('SIGTERM');
          }
        } catch {
          // ignore
        }
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Start Engine
  log('[2/4] Starting GuardSaaB Engine...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const engineProc = spawn(npmCmd, ['run', 'engine:local'], { stdio: 'inherit' });
  procs.push(engineProc);

  log('Waiting for engine health check on :9000...');
  const engineReady = await waitUrl(ENGINE_URL, 60000);
  if (!engineReady) {
    console.error('[ERROR] Engine did not become healthy in time.');
    cleanup();
    process.exit(1);
  }
  log('Engine is ready and connected to PostgreSQL.');

  // Start Frontends
  log('[3/4] Starting frontends (:5173 Company Portal & :5174 GuardSaaB Console)...');
  const companyProc = spawn(npmCmd, ['run', 'dev:company'], { stdio: 'inherit' });
  procs.push(companyProc);

  const consoleProc = spawn(npmCmd, ['run', 'dev:guardsaab'], { stdio: 'inherit' });
  procs.push(consoleProc);

  await Promise.all([waitUrl(COMPANY_URL, 45000), waitUrl(GUARDSAAB_URL, 45000)]);

  // Check Ollama
  log('[4/4] Checking Ollama local model availability...');
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      log('Ollama is online with local model(s).');
    }
  } catch {
    log('Note: Ollama not detected on :11434 (offline fallback will be active).');
  }

  console.log(`\n================================================================`);
  console.log(` READY FOR PRESENTATION`);
  console.log(` Northstar Works company website:  ${COMPANY_URL}`);
  console.log(` GuardSaaB governance console:     ${GUARDSAAB_URL}`);
  console.log(` Engine health:                   ${ENGINE_URL}`);
  console.log(` Press Ctrl+C in this terminal to shut down.`);
  console.log(`================================================================\n`);

  openBrowser(COMPANY_URL);
  openBrowser(GUARDSAAB_URL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
