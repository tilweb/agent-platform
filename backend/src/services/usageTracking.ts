/**
 * Usage Tracking Service — Postgres-backed.
 *
 * Tracks LLM usage per user per model for Fair-Use Policy monitoring.
 * Frueher JSONL-Files unter data/usage/, jetzt direkt in `audit.usage_log`.
 *
 * `triggeringUserId`, `operation`, `resourceId` und `prompts` werden in der
 * jsonb-`metadata`-Spalte gestasht — die DB-Spalten halten nur die
 * structurellen Hauptattribute (userId, providerId, modelId, source, timestamp).
 */

import { and, eq, gte, lte, or, sql as rawSql } from 'drizzle-orm';
import { getDb } from '../db';
import { usageLog } from '../db/schema/audit';

export interface UsageContext {
  userId?: string;
  triggeringUserId?: string;
  source: 'chat' | 'delegation' | 'image_analysis' | 'indexer' | 'search' | 'contract' | 'extraction';
  operation?: string;
  resourceId?: string;
}

export interface UsageEntry {
  id: string;
  timestamp: string;
  userId?: string;
  triggeringUserId?: string;
  provider: string;
  model: string;
  source: string;
  operation?: string;
  resourceId?: string;
  prompts: number;
}

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

export interface UserUsageTotals {
  userId: string;
  totalPrompts: number;
  byModel: Record<string, number>;
  bySource: Record<string, number>;
  lastUsed: string;
}

function generateUsageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `usage_${timestamp}_${random}`;
}

interface UsageMeta {
  triggeringUserId?: string;
  operation?: string;
  resourceId?: string;
  prompts?: number;
}

function rowToEntry(row: typeof usageLog.$inferSelect): UsageEntry {
  const meta = (row.metadata ?? {}) as UsageMeta;
  return {
    id: row.id,
    timestamp: row.timestamp,
    userId: row.userId ?? undefined,
    triggeringUserId: meta.triggeringUserId,
    provider: row.providerId ?? '',
    model: row.modelId ?? '',
    source: row.source ?? '',
    operation: meta.operation,
    resourceId: meta.resourceId,
    prompts: meta.prompts ?? 1,
  };
}

async function readEntries(startDate?: string, endDate?: string): Promise<UsageEntry[]> {
  const db = getDb();
  const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate ?? new Date().toISOString();
  const rows = await db
    .select()
    .from(usageLog)
    .where(and(gte(usageLog.timestamp, start), lte(usageLog.timestamp, end)));
  return rows.map(rowToEntry);
}

class UsageTrackingService {
  async track(context: UsageContext, provider: string, model: string): Promise<void> {
    const id = generateUsageId();
    const timestamp = new Date().toISOString();
    const meta: UsageMeta = {
      triggeringUserId: context.triggeringUserId,
      operation: context.operation,
      resourceId: context.resourceId,
      prompts: 1,
    };

    if (process.env.NODE_ENV === 'development') {
      const user = context.userId || context.triggeringUserId || 'system';
      console.log(`[UsageTracking] ${context.source}: ${user} -> ${model}`);
    }

    try {
      const db = getDb();
      await db.insert(usageLog).values({
        id,
        timestamp,
        userId: context.userId ?? null,
        source: context.source,
        providerId: provider,
        modelId: model,
        metadata: meta as never,
      });
    } catch (error) {
      console.error('[UsageTracking] Failed to write entry:', error);
    }
  }

  async getUsageSummary(startDate?: string, endDate?: string): Promise<UsageSummary> {
    const entries = await readEntries(startDate, endDate);

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

    let topModel: { model: string; count: number } | null = null;
    for (const [model, count] of Object.entries(modelCounts)) {
      if (!topModel || count > topModel.count) {
        topModel = { model, count };
      }
    }

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

  async getUsageByUser(userId: string, startDate?: string, endDate?: string): Promise<UsageEntry[]> {
    const db = getDb();
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate ?? new Date().toISOString();
    const rows = await db
      .select()
      .from(usageLog)
      .where(
        and(
          gte(usageLog.timestamp, start),
          lte(usageLog.timestamp, end),
          or(
            eq(usageLog.userId, userId),
            rawSql`${usageLog.metadata}->>'triggeringUserId' = ${userId}`,
          ),
        ),
      );
    return rows.map(rowToEntry);
  }

  async getUsageByModel(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    const entries = await readEntries(startDate, endDate);
    const byModel: Record<string, number> = {};
    for (const entry of entries) {
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.prompts;
    }
    return byModel;
  }

  async exportAsCsv(startDate?: string, endDate?: string): Promise<string> {
    const entries = await readEntries(startDate, endDate);
    const header = ['Timestamp', 'User', 'Provider', 'Model', 'Source', 'Operation', 'ResourceId', 'Prompts'];
    const rows = [header.join(';')];
    for (const entry of entries) {
      rows.push([
        entry.timestamp,
        entry.userId || entry.triggeringUserId || 'system',
        entry.provider,
        entry.model,
        entry.source,
        entry.operation || '',
        entry.resourceId || '',
        String(entry.prompts),
      ].join(';'));
    }
    return rows.join('\n');
  }
}

export const usageTrackingService = new UsageTrackingService();
