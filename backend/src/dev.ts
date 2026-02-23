/**
 * Dev entry point — wraps index.ts and reloads env on .env changes.
 * Only used by `bun run dev`, not in production.
 */
import { watch, readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dir, '../../.env');
watch(envPath, () => {
  console.log('\n[Dev] .env geändert — Umgebungsvariablen neu geladen');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = value;
    }
  } catch (err) {
    console.error('[Dev] .env konnte nicht geladen werden:', err);
  }
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
