/**
 * Recovery-Script: legt einen Admin-User an oder reaktiviert/promotet einen
 * existierenden User auf admin. Gedacht fuer den Fall dass alle Admins
 * deaktiviert/geloescht wurden und niemand mehr in die Plattform reinkommt.
 *
 * Usage:
 *   # Mit ENV-Vars (non-interactive):
 *   RECOVERY_USERNAME=admin RECOVERY_PASSWORD='neues-pw' \
 *     /Users/andreasbachmann/.bun/bin/bun run scripts/create-admin.ts
 *
 *   # Interaktiv (Prompt):
 *   /Users/andreasbachmann/.bun/bin/bun run scripts/create-admin.ts
 *
 * Verhalten:
 * - Username existiert nicht → neuer Admin wird angelegt.
 * - Username existiert     → User wird auf role='admin', isActive=true gesetzt.
 *                              Wenn Password angegeben, wird es ebenfalls neu gesetzt.
 * - Wenn keine User existieren, ist self-registration ueber die Login-Page der
 *   normale Weg — dieses Script ist eher fuer die "verwaiste Instanz"-Recovery.
 */

import { createInterface } from 'readline';
import { findUserByUsername, createUser, updateUser } from '../src/auth/storage';
import { hashPassword, validateUsername, validatePassword } from '../src/auth/password';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  // Production-Guard: Recovery-Script darf nicht versehentlich ueber eine
  // CI-Pipeline laufen — das waere eine persistente Admin-Backdoor.
  // Erzwinge entweder TTY (interactive shell) oder explizites Opt-In via
  // ALLOW_RECOVERY_SCRIPT=true. Siehe security-review M1.
  if (process.env.NODE_ENV === 'production') {
    const isTty = process.stdin.isTTY === true;
    const explicitOptIn = process.env.ALLOW_RECOVERY_SCRIPT === 'true';
    if (!isTty && !explicitOptIn) {
      console.error(
        '[create-admin] BLOCKED in NODE_ENV=production without TTY.\n' +
        'This script can mint admin accounts and must not run from CI.\n' +
        'If you really mean to run it: set ALLOW_RECOVERY_SCRIPT=true and re-run.\n'
      );
      process.exit(1);
    }
    console.warn('[create-admin] WARNING: running in production. Logging this invocation.');
  }

  let username = process.env.RECOVERY_USERNAME ?? '';
  let password = process.env.RECOVERY_PASSWORD ?? '';

  if (!username) {
    username = await prompt('Username fuer Admin: ');
  }
  if (!username) {
    console.error('[create-admin] Kein Username angegeben — abort.');
    process.exit(1);
  }

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    console.error('[create-admin] Username ungueltig:', usernameValidation.errors.join(', '));
    process.exit(1);
  }

  const existing = await findUserByUsername(username);

  if (!password && (!existing || password)) {
    // Bei neuem User immer Passwort verlangen. Bei existierendem nur wenn
    // explizit aenderlich (sonst behalten wir das alte).
    password = await prompt(existing ? 'Neues Passwort (leer lassen = altes behalten): ' : 'Passwort: ');
  }

  if (password) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.error('[create-admin] Passwort ungueltig:', passwordValidation.errors.join(', '));
      process.exit(1);
    }
  } else if (!existing) {
    console.error('[create-admin] Neuer User braucht ein Passwort — abort.');
    process.exit(1);
  }

  if (existing) {
    const updates: Parameters<typeof updateUser>[1] = {
      role: 'admin',
      isActive: true,
    };
    if (password) {
      updates.passwordHash = await hashPassword(password);
    }
    const updated = await updateUser(existing.id, updates);
    console.log(`[create-admin] User "${username}" auf admin promoted/reaktiviert${password ? ' (Passwort neu gesetzt)' : ''}. id=${updated?.id}`);
    return;
  }

  const created = await createUser({
    username,
    password,
    role: 'admin',
  });
  console.log(`[create-admin] Neuer Admin "${username}" angelegt. id=${created.id}`);
}

main().catch((err) => {
  console.error('[create-admin] Fatal error:', err);
  process.exit(1);
});
