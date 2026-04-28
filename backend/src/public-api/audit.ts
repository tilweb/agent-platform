/**
 * Public-API Audit-Log — Postgres-backed (append-only).
 *
 * Frueher JSONL-Files pro Monat unter data/audit/api-public/. Jetzt
 * direkter Insert in `audit.public_api`. Schreibfehler werden geloggt
 * aber nicht weitergeworfen — Request-Pfad bleibt robust.
 */

import { getDb } from '../db';
import { auditPublicApi } from '../db/schema/audit';
import type { AuditEntry } from './types';

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditPublicApi).values({
      id: entry.requestId,
      timestamp: entry.timestamp,
      apiKeyId: entry.apiKeyId,
      scopeType: entry.scopeType,
      scopeId: entry.scopeId,
      method: entry.method,
      path: entry.path,
      appId: entry.appId,
      functionId: entry.functionId,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      durationMs: entry.durationMs,
    });
  } catch (err) {
    console.error('[public-api/audit] write failed:', err);
  }
}
