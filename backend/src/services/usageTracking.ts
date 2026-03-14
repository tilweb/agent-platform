/**
 * Usage Tracking Service
 *
 * Tracks LLM usage (prompt counts, not tokens) per user per model
 * for Fair-Use Policy monitoring.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';

// Usage context passed to LLM calls
export interface UsageContext {
  userId?: string;              // Direct user (Chat, Agents)
  triggeringUserId?: string;    // User who triggered indirect call
  source: 'chat' | 'delegation' | 'image_analysis' | 'indexer' | 'search' | 'contract' | 'extraction';
  operation?: string;           // e.g. 'kb_index', 'smart_search'
  resourceId?: string;          // e.g. collectionId, contractId
}

// Single usage entry stored in JSONL
export interface UsageEntry {
  id: string;                   // usage_${timestamp}_${random}
  timestamp: string;            // ISO-String
  userId?: string;
  triggeringUserId?: string;
  provider: string;             // Provider ID (e.g. 'adacor')
  model: string;                // Model ID (e.g. 'mistral-3-24b-128k')
  source: string;
  operation?: string;
  resourceId?: string;
  prompts: number;              // Always 1 per LLM call
}

// Summary statistics
export interface UsageSummary {
  totalPrompts: number;
  activeUsers: number;
  topModel: { model: string; count: number } | null;
  byUser: Array<{ userId: string; prompts: number; percentage: number }>;
  byModel: Array<{ model: string; prompts: number; percentage: number }>;
  bySource: Array<{ source: string; prompts: number; percentage: number }>;
  startDate: string;
  endDate: string;
}

// User totals for quick access
export interface UserUsageTotals {
  userId: string;
  totalPrompts: number;
  byModel: Record<string, number>;
  bySource: Record<string, number>;
  lastUsed: string;
}

const USAGE_DIR = resolve(process.cwd(), '../data/usage');

/**
 * Generate unique ID for usage entry
 */
function generateUsageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `usage_${timestamp}_${random}`;
}

/**
 * Get current log file path (monthly rotation)
 */
function getCurrentLogFile(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return join(USAGE_DIR, `usage_${year}-${month}.jsonl`);
}

/**
 * Get log file path for a specific month
 */
function getLogFileForMonth(year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0');
  return join(USAGE_DIR, `usage_${year}-${monthStr}.jsonl`);
}

/**
 * Ensure usage log directory exists
 */
async function ensureUsageDir(): Promise<void> {
  if (!existsSync(USAGE_DIR)) {
    await mkdir(USAGE_DIR, { recursive: true });
  }
}

/**
 * Write usage entry to log file
 */
async function writeUsageEntry(entry: UsageEntry): Promise<void> {
  await ensureUsageDir();
  const logFile = getCurrentLogFile();
  const line = JSON.stringify(entry) + '\n';

  try {
    const existingContent = existsSync(logFile)
      ? await readFile(logFile, 'utf-8')
      : '';
    await writeFile(logFile, existingContent + line, 'utf-8');
  } catch (error) {
    console.error('[UsageTracking] Failed to write entry:', error);
  }
}

/**
 * Read entries from a date range
 */
async function readEntries(startDate?: string, endDate?: string): Promise<UsageEntry[]> {
  const entries: UsageEntry[] = [];
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get all months in range
  const months: { year: number; month: number }[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
    current.setMonth(current.getMonth() + 1);
  }

  // Read entries from each month file
  for (const { year, month } of months) {
    const logFile = getLogFileForMonth(year, month);
    if (!existsSync(logFile)) continue;

    try {
      const content = await readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry: UsageEntry = JSON.parse(line);
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= start && entryDate <= end) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return entries;
}

class UsageTrackingService {
  /**
   * Track a single LLM call
   */
  async track(context: UsageContext, provider: string, model: string): Promise<void> {
    const entry: UsageEntry = {
      id: generateUsageId(),
      timestamp: new Date().toISOString(),
      userId: context.userId,
      triggeringUserId: context.triggeringUserId,
      provider,
      model,
      source: context.source,
      operation: context.operation,
      resourceId: context.resourceId,
      prompts: 1,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const user = entry.userId || entry.triggeringUserId || 'system';
      console.log(`[UsageTracking] ${entry.source}: ${user} -> ${model}`);
    }

    await writeUsageEntry(entry);
  }

  /**
   * Get usage summary for a date range
   */
  async getUsageSummary(startDate?: string, endDate?: string): Promise<UsageSummary> {
    const entries = await readEntries(startDate, endDate);

    // Calculate totals
    const userCounts: Record<string, number> = {};
    const modelCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    for (const entry of entries) {
      const userId = entry.userId || entry.triggeringUserId || 'system';
      userCounts[userId] = (userCounts[userId] || 0) + entry.prompts;
      modelCounts[entry.model] = (modelCounts[entry.model] || 0) + entry.prompts;
      sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + entry.prompts;
    }

    const totalPrompts = entries.reduce((sum, e) => sum + e.prompts, 0);

    // Find top model
    let topModel: { model: string; count: number } | null = null;
    for (const [model, count] of Object.entries(modelCounts)) {
      if (!topModel || count > topModel.count) {
        topModel = { model, count };
      }
    }

    // Build sorted arrays with percentages
    const byUser = Object.entries(userCounts)
      .map(([userId, prompts]) => ({
        userId,
        prompts,
        percentage: totalPrompts > 0 ? Math.round((prompts / totalPrompts) * 100) : 0,
      }))
      .sort((a, b) => b.prompts - a.prompts);

    const byModel = Object.entries(modelCounts)
      .map(([model, prompts]) => ({
        model,
        prompts,
        percentage: totalPrompts > 0 ? Math.round((prompts / totalPrompts) * 100) : 0,
      }))
      .sort((a, b) => b.prompts - a.prompts);

    const bySource = Object.entries(sourceCounts)
      .map(([source, prompts]) => ({
        source,
        prompts,
        percentage: totalPrompts > 0 ? Math.round((prompts / totalPrompts) * 100) : 0,
      }))
      .sort((a, b) => b.prompts - a.prompts);

    return {
      totalPrompts,
      activeUsers: Object.keys(userCounts).length,
      topModel,
      byUser,
      byModel,
      bySource,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
      endDate: endDate || new Date().toISOString().split('T')[0]!,
    };
  }

  /**
   * Get totals per user
   */
  async getUserTotals(startDate?: string, endDate?: string): Promise<Record<string, UserUsageTotals>> {
    const entries = await readEntries(startDate, endDate);
    const totals: Record<string, UserUsageTotals> = {};

    for (const entry of entries) {
      const userId = entry.userId || entry.triggeringUserId || 'system';

      if (!totals[userId]) {
        totals[userId] = {
          userId,
          totalPrompts: 0,
          byModel: {},
          bySource: {},
          lastUsed: entry.timestamp,
        };
      }

      const userTotal = totals[userId]!;
      userTotal.totalPrompts += entry.prompts;
      userTotal.byModel[entry.model] = (userTotal.byModel[entry.model] || 0) + entry.prompts;
      userTotal.bySource[entry.source] = (userTotal.bySource[entry.source] || 0) + entry.prompts;

      if (entry.timestamp > userTotal.lastUsed) {
        userTotal.lastUsed = entry.timestamp;
      }
    }

    return totals;
  }

  /**
   * Get usage entries for a specific user
   */
  async getUsageByUser(userId: string, startDate?: string, endDate?: string): Promise<UsageEntry[]> {
    const entries = await readEntries(startDate, endDate);
    return entries.filter(
      e => e.userId === userId || e.triggeringUserId === userId
    );
  }

  /**
   * Get usage grouped by model
   */
  async getUsageByModel(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    const entries = await readEntries(startDate, endDate);
    const byModel: Record<string, number> = {};

    for (const entry of entries) {
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.prompts;
    }

    return byModel;
  }

  /**
   * Export usage data as CSV
   */
  async exportAsCsv(startDate?: string, endDate?: string): Promise<string> {
    const entries = await readEntries(startDate, endDate);

    // CSV header
    const header = ['Timestamp', 'User', 'Provider', 'Model', 'Source', 'Operation', 'ResourceId', 'Prompts'];
    const rows = [header.join(';')];

    // CSV rows
    for (const entry of entries) {
      const row = [
        entry.timestamp,
        entry.userId || entry.triggeringUserId || 'system',
        entry.provider,
        entry.model,
        entry.source,
        entry.operation || '',
        entry.resourceId || '',
        String(entry.prompts),
      ];
      rows.push(row.join(';'));
    }

    return rows.join('\n');
  }
}

export const usageTrackingService = new UsageTrackingService();
