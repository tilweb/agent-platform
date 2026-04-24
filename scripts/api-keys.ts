/**
 * API-Key CLI
 *
 * Usage:
 *   bun run scripts/api-keys.ts create --label "EMMA" --scope service --service-name emma \
 *     --permissions "app:wzbar-matcher:classify" --rate 60/60
 *   bun run scripts/api-keys.ts list
 *   bun run scripts/api-keys.ts show <id>
 *   bun run scripts/api-keys.ts revoke <id>
 */

import { createKey, revokeKey, listKeys } from '../backend/src/public-api/keys/service';
import { loadKeyById } from '../backend/src/public-api/keys/storage';
import type { ApiKeyScope, ScopeType } from '../backend/src/public-api/types';

type ArgMap = Record<string, string | string[] | true>;

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: ArgMap } {
  const [command = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags: ArgMap = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[name] = true;
      } else {
        const existing = flags[name];
        if (Array.isArray(existing)) existing.push(next);
        else if (typeof existing === 'string') flags[name] = [existing, next];
        else flags[name] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

function requireFlag(flags: ArgMap, name: string): string {
  const v = flags[name];
  if (typeof v !== 'string') throw new Error(`--${name} is required`);
  return v;
}

function coercePermissions(flags: ArgMap): string[] {
  const v = flags['permissions'];
  if (!v) throw new Error('--permissions is required (comma-separated or repeat flag)');
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  throw new Error('--permissions invalid');
}

function parseRate(input: string | undefined): { requests: number; windowSec: number } | undefined {
  if (!input) return undefined;
  const match = input.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) throw new Error(`--rate must be "<requests>/<seconds>", got "${input}"`);
  return { requests: Number(match[1]), windowSec: Number(match[2]) };
}

function buildScope(flags: ArgMap): ApiKeyScope {
  const type = requireFlag(flags, 'scope') as ScopeType;
  if (type === 'service') {
    return { type, serviceName: requireFlag(flags, 'service-name') };
  }
  if (type === 'org') {
    return { type, orgId: requireFlag(flags, 'org-id') };
  }
  if (type === 'user') {
    return { type, userId: requireFlag(flags, 'user-id') };
  }
  throw new Error(`--scope must be service|org|user, got "${type}"`);
}

function printHelp(): void {
  console.log(`API-Key CLI

Commands:
  create    Create a new API key
  list      List all keys (summary)
  show      Show a single key by id
  revoke    Revoke (deactivate) a key by id
  help      This message

create flags:
  --label "My Key"                         human-readable label
  --scope service|org|user                 scope type
  --service-name emma                      when scope=service
  --org-id org_xxx                         when scope=org
  --user-id user_xxx                       when scope=user
  --permissions "app:wzbar-matcher:*"      comma-separated or repeat flag
  --rate 60/60                             requests/windowSec (default 60/60)
  --created-by user_xxx                    who minted the key (default: "cli")
  --expires 2027-01-01T00:00:00Z           optional expiration

show / revoke:
  <id>                                     positional key id
`);
}

async function cmdCreate(flags: ArgMap): Promise<void> {
  const label = requireFlag(flags, 'label');
  const scope = buildScope(flags);
  const permissions = coercePermissions(flags);
  const rateLimit = parseRate(typeof flags['rate'] === 'string' ? flags['rate'] : undefined);
  const createdBy = typeof flags['created-by'] === 'string' ? flags['created-by'] : 'cli';
  const expiresAt = typeof flags['expires'] === 'string' ? flags['expires'] : null;

  const { key, rawKey } = await createKey({ label, scope, permissions, rateLimit, createdBy, expiresAt });

  console.log(`✓ Created API key`);
  console.log(`  id:          ${key.id}`);
  console.log(`  label:       ${key.label}`);
  console.log(`  scope:       ${key.scope.type}${scopeIdentifier(key.scope) ? ' (' + scopeIdentifier(key.scope) + ')' : ''}`);
  console.log(`  permissions: ${key.permissions.join(', ')}`);
  console.log(`  rateLimit:   ${key.rateLimit.requests}/${key.rateLimit.windowSec}s`);
  console.log();
  console.log(`  RAW KEY (shown only once — copy now):`);
  console.log(`  ${rawKey}`);
}

async function cmdList(): Promise<void> {
  const keys = await listKeys();
  if (keys.length === 0) {
    console.log('No API keys.');
    return;
  }
  for (const k of keys) {
    const status = k.isActive ? 'active' : 'revoked';
    const ident = scopeIdentifier(k.scope);
    console.log(`${k.id}  [${status}]  ${k.label}  — ${k.scope.type}${ident ? ':' + ident : ''}  perms=${k.permissions.length}  rate=${k.rateLimit.requests}/${k.rateLimit.windowSec}s  lastUsed=${k.lastUsedAt ?? '—'}`);
  }
}

async function cmdShow(positional: string[]): Promise<void> {
  const id = positional[0];
  if (!id) throw new Error('usage: show <id>');
  const k = await loadKeyById(id);
  if (!k) {
    console.error(`Key not found: ${id}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ ...k, hashedKey: '<redacted>' }, null, 2));
}

async function cmdRevoke(positional: string[]): Promise<void> {
  const id = positional[0];
  if (!id) throw new Error('usage: revoke <id>');
  const k = await revokeKey(id);
  if (!k) {
    console.error(`Key not found: ${id}`);
    process.exit(1);
  }
  console.log(`✓ Revoked ${k.id} (${k.label}) at ${k.revokedAt}`);
}

function scopeIdentifier(scope: ApiKeyScope): string | null {
  if (scope.type === 'service') return scope.serviceName ?? null;
  if (scope.type === 'org') return scope.orgId ?? null;
  if (scope.type === 'user') return scope.userId ?? null;
  return null;
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  try {
    switch (command) {
      case 'create': return cmdCreate(flags);
      case 'list':   return cmdList();
      case 'show':   return cmdShow(positional);
      case 'revoke': return cmdRevoke(positional);
      default:       printHelp(); return;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
