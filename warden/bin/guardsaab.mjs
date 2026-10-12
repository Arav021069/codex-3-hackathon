#!/usr/bin/env node
/** GuardSaaB command launcher for the local engine and policy tools. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distCli = join(root, 'dist', 'cli', 'index.js');
const args = process.argv.slice(2);
let spawnArgs;
if (existsSync(distCli)) spawnArgs = [distCli, ...args];
else if (existsSync(join(root, 'node_modules', 'tsx'))) spawnArgs = ['--import', 'tsx', join(root, 'src', 'cli', 'index.ts'), ...args];
else {
  process.stderr.write('\nGuardSaaB dependencies are missing. Run npm install, then retry (npm run build:engine is optional).\n');
  process.exit(1);
}

const child = spawn(process.execPath, spawnArgs, { stdio: 'inherit', env: { ...process.env, CB_HOME: root, AG_HOME: root } });
child.on('exit', (code) => process.exit(code ?? 0));
