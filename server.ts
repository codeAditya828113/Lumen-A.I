/**
 * InsightStream Server Entry Point
 * 
 * Supports universal execution:
 * 1. `node server.ts` (Node 22 self-bootstraps with tsx ESM loader)
 * 2. `node --import tsx server.ts` (standard production launcher)
 * 3. `tsx server.ts` (dev server launcher)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isRunningWithTsx = 
  process.execArgv.some(arg => arg.includes('tsx')) || 
  process.env.__TSX_BOOTSTRAPPED__ === '1';

if (!isRunningWithTsx) {
  // Spawn child process with tsx ESM loader
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', scriptPath, ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        __TSX_BOOTSTRAPPED__: '1',
      },
    }
  );

  // Forward signals
  const forwardSignal = (sig: NodeJS.Signals) => {
    if (child.pid) {
      child.kill(sig);
    }
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    console.error('Failed to spawn tsx server process:', err);
    process.exit(1);
  });
} else {
  // Running with tsx: dynamically load the server application
  await import('./src/serverApp.ts');
}
