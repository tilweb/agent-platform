/**
 * Dev entry point — wraps index.ts and auto-restarts on .env changes.
 * Only used by `bun run dev`, not in production.
 */
import { watch } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dir, '../../.env');
watch(envPath, () => {
  console.log('\n[Dev] .env geändert — Neustart...');
  process.exit(0);
});

// Auto-start frontend if not already running (fully detached via nohup)
const frontendDir = resolve(import.meta.dir, '../../frontend');
setTimeout(async () => {
  try {
    const check = Bun.spawn(['sh', '-c', 'lsof -i :5173 -sTCP:LISTEN -t'], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    const output = await new Response(check.stdout).text();
    if (output.trim()) return; // Frontend already running

    console.log('[Dev] Frontend nicht aktiv — starte Vite...');
    // nohup + & in sub-shell creates a fully detached process that survives backend restarts
    Bun.spawn(['sh', '-c', `cd "${frontendDir}" && nohup npm run dev > /tmp/frontend-dev.log 2>&1 &`], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } catch {
    // Ignore errors — frontend check is best-effort
  }
}, 2000);

export { default } from './index';
