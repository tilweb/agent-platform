/**
 * Audit Log Service
 *
 * Logs security-relevant actions for compliance and incident investigation.
 * Stores logs in structured JSON format for easy querying.
 */

import { appendFile, readFile, readdir, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Audit event categories
 */
export enum AuditCategory {
  AUTH = 'auth',
  USER_MANAGEMENT = 'user_management',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  ADMIN_ACTION = 'admin_action',
  SECURITY = 'security',
  SYSTEM = 'system',
}

/**
 * Audit event actions
 */
export enum AuditAction {
  // Auth
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  SESSION_EXPIRED = 'session_expired',

  // User Management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET = 'password_reset',

  // Data Access
  CHAT_ACCESSED = 'chat_accessed',
  CHAT_SHARED = 'chat_shared',
  CHAT_SHARE_REVOKED = 'chat_share_revoked',
  KNOWLEDGE_ACCESSED = 'knowledge_accessed',
  CONNECTION_ACCESSED = 'connection_accessed',

  // Data Modification
  CHAT_CREATED = 'chat_created',
  CHAT_DELETED = 'chat_deleted',
  PROJECT_CREATED = 'project_created',
  PROJECT_DELETED = 'project_deleted',
  TOOL_CREATED = 'tool_created',
  TOOL_DELETED = 'tool_deleted',

  // Admin Actions
  PROVIDER_CONFIGURED = 'provider_configured',
  SETTINGS_CHANGED = 'settings_changed',
  GROUP_CREATED = 'group_created',
  GROUP_DELETED = 'group_deleted',
  PERMISSION_CHANGED = 'permission_changed',

  // Security
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_BLOCKED = 'csrf_blocked',
  SSRF_BLOCKED = 'ssrf_blocked',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',

  // System
  SERVICE_STARTED = 'service_started',
  SERVICE_STOPPED = 'service_stopped',
  ERROR_OCCURRED = 'error_occurred',
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: AuditAction;
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

// Audit log storage path
const AUDIT_LOG_DIR = join(process.cwd(), 'data', 'audit');

// Retention: nach N Tagen werden taegliche Log-Dateien geloescht. Default 90
// Tage — abdeckt typische Compliance-Anforderungen (DSGVO, SOC2). Konfigurierbar
// via ENV. AUDIT_RETENTION_DAYS=0 deaktiviert die Cleanup. Siehe security-review M11.
const AUDIT_RETENTION_DAYS = (() => {
  const raw = process.env.AUDIT_RETENTION_DAYS;
  if (!raw) return 90;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 90;
})();

/**
 * Pseudonymisiert einen Username/Email fuer Audit-Logs. Verwendet bei
 * Failed-Login: der eingegebene Username gehoert oft gar keinem Account
 * (Tippfehler, Botnet-Scan), darf also nicht im Klartext persistiert werden.
 * Der Hash erlaubt Korrelation (mehrere Failed-Logins fuer gleichen Wert)
 * ohne PII zu speichern. Siehe security-review I4.
 */
function pseudonymizeUsername(username: string): string {
  const hash = createHash('sha256').update(username.toLowerCase().trim()).digest('hex').slice(0, 16);
  return `usr_${hash}`;
}

/**
 * Generate unique ID for audit entry
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `audit_${timestamp}_${random}`;
}

/**
 * Get current log file path (daily rotation)
 */
function getCurrentLogFile(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(AUDIT_LOG_DIR, `audit_${date}.jsonl`);
}

/**
 * Ensure audit log directory exists
 */
async function ensureLogDir(): Promise<void> {
  if (!existsSync(AUDIT_LOG_DIR)) {
    await mkdir(AUDIT_LOG_DIR, { recursive: true });
  }
}

/**
 * Write audit entry to log file.
 *
 * Nutzt fs.appendFile (POSIX O_APPEND-atomar fuer Zeilen unter PIPE_BUF),
 * statt das alte read-modify-write-Pattern — das verlor unter Concurrent-
 * Logins Eintraege (zwei Requests lesen 1000 Zeilen, beide schreiben 1001
 * zurueck → der zweite ueberschreibt den ersten). Siehe security-review M11.
 */
async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  await ensureLogDir();
  const logFile = getCurrentLogFile();
  const line = JSON.stringify(entry) + '\n';
  try {
    await appendFile(logFile, line, 'utf-8');
  } catch (error) {
    console.error('[AuditLog] Failed to write entry:', error);
  }
}

/**
 * Loescht Audit-Log-Dateien aelter als AUDIT_RETENTION_DAYS. Wird beim
 * Service-Start einmal aufgerufen plus alle 24h. Idempotent.
 */
export async function cleanupOldAuditLogs(): Promise<{ deleted: string[]; kept: number }> {
  if (AUDIT_RETENTION_DAYS <= 0) {
    return { deleted: [], kept: 0 };
  }
  await ensureLogDir();
  const cutoffMs = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs).toISOString().split('T')[0]!;
  let files: string[] = [];
  try {
    files = await readdir(AUDIT_LOG_DIR);
  } catch {
    return { deleted: [], kept: 0 };
  }
  const deleted: string[] = [];
  let kept = 0;
  for (const file of files) {
    const match = file.match(/^audit_(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (!match || !match[1]) continue;
    if (match[1] < cutoffDate) {
      try {
        await unlink(join(AUDIT_LOG_DIR, file));
        deleted.push(file);
      } catch (err) {
        console.error('[AuditLog] Failed to delete old log:', file, err);
      }
    } else {
      kept++;
    }
  }
  if (deleted.length > 0) {
    console.log(`[AuditLog] Retention: deleted ${deleted.length} old log files (${AUDIT_RETENTION_DAYS}d), kept ${kept}.`);
  }
  return { deleted, kept };
}

/**
 * Cleanup-Scheduler: einmalig beim Import + alle 24 Stunden.
 * Failures werden geschluckt — Audit-Log soll niemals den Service brechen.
 */
function scheduleAuditCleanup(): void {
  cleanupOldAuditLogs().catch((err) =>
    console.error('[AuditLog] Initial retention sweep failed:', err),
  );
  setInterval(() => {
    cleanupOldAuditLogs().catch((err) =>
      console.error('[AuditLog] Scheduled retention sweep failed:', err),
    );
  }, 24 * 60 * 60 * 1000);
}
scheduleAuditCleanup();

/**
 * Log an audit event
 */
export async function audit(
  category: AuditCategory,
  action: AuditAction,
  options: {
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    category,
    action,
    userId: options.userId,
    username: options.username,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    details: options.details,
    success: options.success !== false,
    errorMessage: options.errorMessage,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[AuditLog]', entry.action, entry.username || entry.userId || 'system', entry.resourceId || '');
  }

  // Write to file
  await writeAuditEntry(entry);
}

/**
 * Convenience functions for common audit events
 */

export async function auditLogin(
  success: boolean,
  username: string,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  // Bei Failed-Login Username NICHT im Klartext loggen — der eingegebene
  // String gehoert haeufig gar keinem Account (Tippfehler, Bot-Scan), waere
  // also Eingabe-PII ohne legitime Grundlage. Hash erlaubt Korrelation
  // (mehrere Failures fuer gleichen Wert → Brute-Force-Pattern erkennen).
  // Siehe security-review I4.
  const loggedUsername = success ? username : pseudonymizeUsername(username);
  await audit(
    AuditCategory.AUTH,
    success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILED,
    {
      username: loggedUsername,
      ipAddress,
      userAgent,
      success,
      errorMessage,
    }
  );
}

export async function auditLogout(
  userId: string,
  username?: string,
  ipAddress?: string
): Promise<void> {
  await audit(AuditCategory.AUTH, AuditAction.LOGOUT, {
    userId,
    username,
    ipAddress,
  });
}

export async function auditUserAction(
  action: AuditAction,
  performedBy: { userId: string; username?: string },
  targetUserId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await audit(AuditCategory.USER_MANAGEMENT, action, {
    userId: performedBy.userId,
    username: performedBy.username,
    resourceType: 'user',
    resourceId: targetUserId,
    details,
  });
}

export async function auditSecurityEvent(
  action: AuditAction,
  ipAddress?: string,
  details?: Record<string, unknown>
): Promise<void> {
  await audit(AuditCategory.SECURITY, action, {
    ipAddress,
    details,
    success: false,
  });
}

export async function auditDataAccess(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: AuditAction = AuditAction.CHAT_ACCESSED
): Promise<void> {
  await audit(AuditCategory.DATA_ACCESS, action, {
    userId,
    resourceType,
    resourceId,
  });
}

/**
 * Read audit log entries for a date range
 */
export async function getAuditLogs(
  startDate: string,
  endDate: string
): Promise<AuditEntry[]> {
  const entries: AuditEntry[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Iterate through dates
  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const logFile = join(AUDIT_LOG_DIR, `audit_${dateStr}.jsonl`);

    if (existsSync(logFile)) {
      const content = await readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  return entries;
}

/**
 * Search audit logs
 */
export async function searchAuditLogs(
  query: {
    userId?: string;
    action?: AuditAction;
    category?: AuditCategory;
    startDate?: string;
    endDate?: string;
    success?: boolean;
  }
): Promise<AuditEntry[]> {
  const startDate = query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const endDate = query.endDate || new Date().toISOString().split('T')[0]!;

  const entries = await getAuditLogs(startDate, endDate);

  return entries.filter(entry => {
    if (query.userId && entry.userId !== query.userId) return false;
    if (query.action && entry.action !== query.action) return false;
    if (query.category && entry.category !== query.category) return false;
    if (query.success !== undefined && entry.success !== query.success) return false;
    return true;
  });
}
