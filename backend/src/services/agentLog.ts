/**
 * Agent Log Service
 *
 * Persists agent execution logs as JSONL files per session.
 * Used for debugging and observability in the Agent Log Panel.
 */

import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  eventType: string;
  agentId?: string;
  message: string;
  data?: Record<string, any>;
  durationMs?: number;
}

const AGENT_LOG_DIR = resolve(process.cwd(), '../data/agent-logs');

async function ensureLogDir(): Promise<void> {
  if (!existsSync(AGENT_LOG_DIR)) {
    await mkdir(AGENT_LOG_DIR, { recursive: true });
  }
}

function generateId(): string {
  return `alog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Write a single log entry to the session's JSONL file.
 */
export async function writeAgentLog(
  sessionId: string,
  entry: Omit<AgentLogEntry, 'id' | 'timestamp' | 'sessionId'>
): Promise<void> {
  await ensureLogDir();

  const full: AgentLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    sessionId,
    ...entry,
  };

  const logFile = resolve(AGENT_LOG_DIR, `${sessionId}.jsonl`);
  const line = JSON.stringify(full) + '\n';

  try {
    const existing = existsSync(logFile) ? await readFile(logFile, 'utf-8') : '';
    await writeFile(logFile, existing + line, 'utf-8');
  } catch (error) {
    console.error('[AgentLog] Failed to write entry:', error);
  }
}

/**
 * Read all log entries for a session.
 */
export async function readAgentLog(sessionId: string): Promise<AgentLogEntry[]> {
  const logFile = resolve(AGENT_LOG_DIR, `${sessionId}.jsonl`);

  if (!existsSync(logFile)) {
    return [];
  }

  try {
    const content = await readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries: AgentLogEntry[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch (error) {
    console.error('[AgentLog] Failed to read log:', error);
    return [];
  }
}

/**
 * Delete the log file for a session.
 */
export async function deleteAgentLog(sessionId: string): Promise<void> {
  const logFile = resolve(AGENT_LOG_DIR, `${sessionId}.jsonl`);

  if (existsSync(logFile)) {
    try {
      await unlink(logFile);
    } catch (error) {
      console.error('[AgentLog] Failed to delete log:', error);
    }
  }
}
