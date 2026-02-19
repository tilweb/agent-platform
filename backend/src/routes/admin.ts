/**
 * Admin API Routes
 *
 * Admin-only endpoints for system management and audit logs.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { authMiddleware, getCurrentUser } from '../auth/middleware';
import { parseIntSafe } from '../utils/parseIntSafe';
import { internalError } from '../utils/errorHandler';
import {
  getAuditLogs,
  searchAuditLogs,
  AuditCategory,
  AuditAction,
  type AuditEntry,
} from '../services/auditLog';
import { usageTrackingService } from '../services/usageTracking';

export const adminRoutes = new Hono();

// Apply auth middleware to all routes
adminRoutes.use('*', authMiddleware);

/**
 * Admin-only middleware
 */
const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = getCurrentUser(c);
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin-Rechte erforderlich' }, 403);
  }
  await next();
};

// Apply admin check to all routes
adminRoutes.use('*', requireAdmin);

/**
 * GET /api/admin/audit-logs - List audit log entries with filters
 *
 * Query params:
 * - startDate: YYYY-MM-DD (default: 7 days ago)
 * - endDate: YYYY-MM-DD (default: today)
 * - category: AuditCategory filter
 * - action: AuditAction filter
 * - userId: Filter by user ID
 * - success: Filter by success (true/false)
 * - limit: Max entries to return (default: 100)
 * - offset: Pagination offset (default: 0)
 */
adminRoutes.get('/audit-logs', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const category = c.req.query('category') as AuditCategory | undefined;
    const action = c.req.query('action') as AuditAction | undefined;
    const userId = c.req.query('userId');
    const successParam = c.req.query('success');
    const limit = parseIntSafe(c.req.query('limit'), 100);
    const offset = parseIntSafe(c.req.query('offset'), 0);

    // Parse success param
    let success: boolean | undefined;
    if (successParam === 'true') success = true;
    if (successParam === 'false') success = false;

    // Search with filters
    const allEntries = await searchAuditLogs({
      startDate,
      endDate,
      category,
      action,
      userId,
      success,
    });

    // Sort by timestamp descending (newest first)
    allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    return c.json({
      entries,
      total,
      limit,
      offset,
      hasMore: offset + entries.length < total,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/audit-logs/stats - Get audit log statistics
 *
 * Returns aggregated statistics for dashboard display.
 */
adminRoutes.get('/audit-logs/stats', async (c) => {
  try {
    const days = parseIntSafe(c.req.query('days'), 7);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const entries = await getAuditLogs(
      startDate.toISOString().split('T')[0]!,
      endDate.toISOString().split('T')[0]!
    );

    // Calculate statistics
    const stats = {
      totalEvents: entries.length,

      // By category
      byCategory: {} as Record<string, number>,

      // By action (top 10)
      byAction: {} as Record<string, number>,

      // Success/failure ratio
      successCount: 0,
      failureCount: 0,

      // Security events
      securityEvents: 0,

      // Logins per day
      loginsByDay: {} as Record<string, { success: number; failed: number }>,

      // Recent security alerts
      recentSecurityAlerts: [] as AuditEntry[],

      // Active users (unique user IDs)
      activeUsers: new Set<string>(),
    };

    for (const entry of entries) {
      // By category
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;

      // By action
      stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;

      // Success/failure
      if (entry.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
      }

      // Security events
      if (entry.category === AuditCategory.SECURITY) {
        stats.securityEvents++;
        if (stats.recentSecurityAlerts.length < 10) {
          stats.recentSecurityAlerts.push(entry);
        }
      }

      // Logins by day
      if (entry.action === AuditAction.LOGIN_SUCCESS || entry.action === AuditAction.LOGIN_FAILED) {
        const day = entry.timestamp.split('T')[0]!;
        if (!stats.loginsByDay[day]) {
          stats.loginsByDay[day] = { success: 0, failed: 0 };
        }
        if (entry.action === AuditAction.LOGIN_SUCCESS) {
          stats.loginsByDay[day]!.success++;
        } else {
          stats.loginsByDay[day]!.failed++;
        }
      }

      // Active users
      if (entry.userId) {
        stats.activeUsers.add(entry.userId);
      }
    }

    // Sort security alerts by timestamp (newest first)
    stats.recentSecurityAlerts.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Convert Set to count
    const activeUserCount = stats.activeUsers.size;

    // Get top 10 actions
    const topActions = Object.entries(stats.byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    return c.json({
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days,
      },
      totalEvents: stats.totalEvents,
      byCategory: stats.byCategory,
      topActions,
      successRate: stats.totalEvents > 0
        ? Math.round((stats.successCount / stats.totalEvents) * 100)
        : 100,
      securityEvents: stats.securityEvents,
      recentSecurityAlerts: stats.recentSecurityAlerts,
      loginsByDay: stats.loginsByDay,
      activeUserCount,
    });
  } catch (error: any) {
    console.error('Error fetching audit stats:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/audit-logs/categories - List available categories
 */
adminRoutes.get('/audit-logs/categories', async (c) => {
  return c.json({
    categories: Object.values(AuditCategory),
    actions: Object.values(AuditAction),
  });
});

// =============================================================================
// Usage Tracking Routes
// =============================================================================

/**
 * GET /api/admin/usage - Get usage summary
 *
 * Query params:
 * - startDate: YYYY-MM-DD (default: 30 days ago)
 * - endDate: YYYY-MM-DD (default: today)
 */
adminRoutes.get('/usage', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const summary = await usageTrackingService.getUsageSummary(startDate, endDate);
    return c.json(summary);
  } catch (error: any) {
    console.error('Error fetching usage summary:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/usage/users - Get usage totals per user
 *
 * Query params:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
adminRoutes.get('/usage/users', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const userTotals = await usageTrackingService.getUserTotals(startDate, endDate);
    return c.json({ users: userTotals });
  } catch (error: any) {
    console.error('Error fetching user usage:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/usage/users/:id - Get usage for a specific user
 *
 * Query params:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
adminRoutes.get('/usage/users/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const usage = await usageTrackingService.getUsageByUser(userId, startDate, endDate);
    return c.json({ userId, usage });
  } catch (error: any) {
    console.error('Error fetching user usage:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/usage/models - Get usage grouped by model
 *
 * Query params:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
adminRoutes.get('/usage/models', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const byModel = await usageTrackingService.getUsageByModel(startDate, endDate);
    return c.json({ models: byModel });
  } catch (error: any) {
    console.error('Error fetching model usage:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/admin/usage/export - Export usage data as CSV
 *
 * Query params:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
adminRoutes.get('/usage/export', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const csv = await usageTrackingService.exportAsCsv(startDate, endDate);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="usage_export_${startDate || 'all'}_${endDate || 'all'}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting usage:', error);
    return internalError(c, error);
  }
});
