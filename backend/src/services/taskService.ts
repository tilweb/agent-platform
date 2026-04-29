/**
 * Task Service — Postgres-backed (Drizzle).
 *
 * Frueher: YAML-Files unter data/tasks/ + queue.yaml mit aktiver/pending-Liste.
 * Jetzt: Eine Row pro Task in `tasks.tasks`. Die Queue ist abgeleitet aus
 * dem Status: pending/queued = pending-Queue, running/in_progress = active.
 * Queue-Settings sind In-Memory mit konstanten Defaults — Override via
 * App-Registry-Metadata nachruestbar.
 */

import { and, eq, desc, inArray, gte, lte, count, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { tasks as tasksTable, taskResults as taskResultsTable } from '../db/schema/tasks';

// ============================================
// Types
// ============================================

export type TaskStatus = 'pending' | 'queued' | 'in_progress' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'simple' | 'deep-research' | 'multi-step' | 'scheduled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskStep {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  error?: string;
  output?: string;
}

export interface TaskConfig {
  max_iterations: number;
  timeout_minutes: number;
  notify_on_complete: boolean;
  auto_retry_on_failure: boolean;
  max_retries?: number;
  context?: string;
}

export interface TaskSchedule {
  enabled: boolean;
  cron?: string;
  run_at?: string;
  last_run?: string;
  next_run?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  userId?: string;
  created_by: 'user' | 'agent' | 'scheduled' | 'supervisor';
  source_session_id?: string;
  trigger: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  status: TaskStatus;
  progress: number;
  current_step: number;
  total_steps: number;
  error?: string;
  retry_count?: number;
  assigned_agent?: string;
  plan_file?: string;
  steps: TaskStep[];
  result_file?: string;
  result_summary?: string;
  config: TaskConfig;
  schedule?: TaskSchedule;
}

export interface QueueEntry {
  task_id: string;
  priority: TaskPriority;
  queued_at?: string;
  started_at?: string;
}

export interface QueueSettings {
  max_concurrent_tasks: number;
  default_priority: TaskPriority;
  default_timeout_minutes: number;
  paused: boolean;
}

export interface TaskQueue {
  updated_at: string;
  active: QueueEntry[];
  pending: QueueEntry[];
  settings: QueueSettings;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  trigger: string;
  userId?: string;
  created_by?: 'user' | 'agent' | 'scheduled' | 'supervisor';
  source_session_id?: string;
  assigned_agent?: string;
  steps?: Array<{ name: string }>;
  config?: Partial<TaskConfig>;
  schedule?: TaskSchedule;
}

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType;
  priority?: TaskPriority;
  userId?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface TaskListResult {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  stats: TaskStats;
}

export interface TaskProgress {
  progress: number;
  current_step?: number;
  step_status?: {
    step_id: string;
    status: TaskStep['status'];
    output?: string;
    error?: string;
  };
  message?: string;
}

export interface QueueStatus {
  active_count: number;
  pending_count: number;
  max_concurrent: number;
  paused: boolean;
  active_tasks: Array<{ id: string; title: string; progress: number }>;
  pending_tasks: Array<{ id: string; title: string; priority: TaskPriority }>;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: TaskConfig = {
  max_iterations: 50,
  timeout_minutes: 30,
  notify_on_complete: true,
  auto_retry_on_failure: false,
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const ACTIVE_STATUSES: TaskStatus[] = ['running', 'in_progress'];
const PENDING_STATUSES: TaskStatus[] = ['pending', 'queued'];

const queueSettings: QueueSettings = {
  max_concurrent_tasks: 2,
  default_priority: 'normal',
  default_timeout_minutes: 30,
  paused: false,
};

// ============================================
// Helpers
// ============================================

function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}${random}`;
}

interface TaskPayload {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  created_by: 'user' | 'agent' | 'scheduled' | 'supervisor';
  source_session_id?: string;
  trigger: string;
  progress: number;
  current_step: number;
  total_steps: number;
  error?: string;
  assigned_agent?: string;
  plan_file?: string;
  steps: TaskStep[];
  result_file?: string;
  result_summary?: string;
  config: TaskConfig;
  schedule?: TaskSchedule;
}

function rowToTask(row: typeof tasksTable.$inferSelect): Task {
  const payload = (row.payload ?? {}) as Partial<TaskPayload>;
  return {
    id: row.id,
    title: payload.title ?? '',
    description: payload.description ?? '',
    type: payload.type ?? 'simple',
    priority: payload.priority ?? 'normal',
    userId: row.userId ?? undefined,
    created_by: payload.created_by ?? 'user',
    source_session_id: payload.source_session_id,
    trigger: payload.trigger ?? '',
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    started_at: row.startedAt ?? undefined,
    completed_at: row.finishedAt ?? undefined,
    status: row.status as TaskStatus,
    progress: payload.progress ?? 0,
    current_step: payload.current_step ?? 0,
    total_steps: payload.total_steps ?? 0,
    error: payload.error,
    retry_count: row.attempts ?? undefined,
    assigned_agent: payload.assigned_agent,
    plan_file: payload.plan_file,
    steps: payload.steps ?? [],
    result_file: payload.result_file,
    result_summary: payload.result_summary,
    config: payload.config ?? DEFAULT_CONFIG,
    schedule: payload.schedule,
  };
}

function taskToRow(task: Task) {
  const payload: TaskPayload = {
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    created_by: task.created_by,
    source_session_id: task.source_session_id,
    trigger: task.trigger,
    progress: task.progress,
    current_step: task.current_step,
    total_steps: task.total_steps,
    error: task.error,
    assigned_agent: task.assigned_agent,
    plan_file: task.plan_file,
    steps: task.steps,
    result_file: task.result_file,
    result_summary: task.result_summary,
    config: task.config,
    schedule: task.schedule,
  };
  return {
    id: task.id,
    userId: task.userId ?? null,
    status: task.status,
    kind: task.type,
    payload: payload as never,
    attempts: task.retry_count ?? 0,
    maxAttempts: task.config.max_retries ?? 3,
    scheduledAt: task.schedule?.run_at ?? null,
    startedAt: task.started_at ?? null,
    finishedAt: task.completed_at ?? null,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// ============================================
// Queue Management (in-memory settings, DB-derived state)
// ============================================

export async function loadQueue(): Promise<TaskQueue> {
  const db = getDb();
  const activeRows = await db.select().from(tasksTable).where(inArray(tasksTable.status, ACTIVE_STATUSES));
  const pendingRows = await db.select().from(tasksTable).where(inArray(tasksTable.status, PENDING_STATUSES));

  const active: QueueEntry[] = activeRows.map(row => ({
    task_id: row.id,
    priority: ((row.payload ?? {}) as Partial<TaskPayload>).priority ?? 'normal',
    started_at: row.startedAt ?? undefined,
  }));

  const pending: QueueEntry[] = pendingRows
    .map(row => ({
      task_id: row.id,
      priority: ((row.payload ?? {}) as Partial<TaskPayload>).priority ?? 'normal',
      queued_at: row.updatedAt,
    }))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return {
    updated_at: new Date().toISOString(),
    active,
    pending,
    settings: { ...queueSettings },
  };
}

export async function saveQueue(_queue: TaskQueue): Promise<void> {
  /* Queue ist DB-derived — kein separates Persistieren mehr. */
}

export async function getQueueSettings(): Promise<QueueSettings> {
  return { ...queueSettings };
}

export async function updateQueueSettings(updates: Partial<QueueSettings>): Promise<QueueSettings> {
  Object.assign(queueSettings, updates);
  return { ...queueSettings };
}

// ============================================
// Task CRUD
// ============================================

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: generateTaskId(),
    title: params.title,
    description: params.description || '',
    type: params.type,
    priority: params.priority || queueSettings.default_priority,
    userId: params.userId,
    created_by: params.created_by || 'user',
    source_session_id: params.source_session_id,
    trigger: params.trigger,
    created_at: now,
    updated_at: now,
    status: 'pending',
    progress: 0,
    current_step: 0,
    total_steps: params.steps?.length || 0,
    assigned_agent: params.assigned_agent,
    steps: params.steps?.map((step, index) => ({
      id: `step_${index + 1}`,
      name: step.name,
      status: 'pending' as const,
    })) || [],
    config: {
      ...DEFAULT_CONFIG,
      timeout_minutes: queueSettings.default_timeout_minutes,
      ...params.config,
    },
    schedule: params.schedule,
  };
  await saveTask(task);
  return task;
}

export async function saveTask(task: Task): Promise<void> {
  task.updated_at = new Date().toISOString();
  const db = getDb();
  const row = taskToRow(task);
  await db.insert(tasksTable).values(row).onConflictDoUpdate({
    target: tasksTable.id,
    set: {
      userId: row.userId,
      status: row.status,
      kind: row.kind,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      scheduledAt: row.scheduledAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      updatedAt: row.updatedAt,
    },
  });
}

export async function getTask(taskId: string): Promise<Task | null> {
  const db = getDb();
  const rows = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  return rows[0] ? rowToTask(rows[0]) : null;
}

export async function listTasks(filter?: TaskFilter): Promise<TaskListResult> {
  const db = getDb();
  const conditions = [];
  if (filter?.userId) conditions.push(eq(tasksTable.userId, filter.userId));
  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    conditions.push(inArray(tasksTable.status, statuses));
  }
  if (filter?.type) conditions.push(eq(tasksTable.kind, filter.type));
  if (filter?.created_after) conditions.push(gte(tasksTable.createdAt, filter.created_after));
  if (filter?.created_before) conditions.push(lte(tasksTable.createdAt, filter.created_before));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = filter?.offset || 0;
  const limit = filter?.limit || 20;

  const rows = await db.select().from(tasksTable).where(whereClause).orderBy(desc(tasksTable.createdAt)).limit(limit).offset(offset);
  const tasks = rows.map(rowToTask);
  const filtered = filter?.priority ? tasks.filter(t => t.priority === filter.priority) : tasks;

  const statsConditions = filter?.userId ? [eq(tasksTable.userId, filter.userId)] : [];
  const totalRow = await db.select({ n: count() }).from(tasksTable).where(statsConditions.length ? and(...statsConditions) : undefined);

  const statsByStatus: Record<string, number> = {};
  const statsRows = await db
    .select({ status: tasksTable.status, n: count() })
    .from(tasksTable)
    .where(statsConditions.length ? and(...statsConditions) : undefined)
    .groupBy(tasksTable.status);
  for (const r of statsRows) statsByStatus[r.status] = r.n;

  const stats: TaskStats = {
    total: totalRow[0]?.n ?? 0,
    pending: (statsByStatus.pending || 0) + (statsByStatus.queued || 0),
    running: (statsByStatus.running || 0) + (statsByStatus.in_progress || 0),
    completed: statsByStatus.completed || 0,
    failed: statsByStatus.failed || 0,
    cancelled: statsByStatus.cancelled || 0,
  };

  const totalFilteredRow = await db.select({ n: count() }).from(tasksTable).where(whereClause);
  const totalFiltered = totalFilteredRow[0]?.n ?? 0;

  return {
    tasks: filtered,
    total: totalFiltered,
    limit,
    offset,
    hasMore: offset + limit < totalFiltered,
    stats,
  };
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  const updated = { ...task, ...updates, id: task.id };
  await saveTask(updated);
  return updated;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(tasksTable).where(eq(tasksTable.id, taskId)).returning({ id: tasksTable.id });
  return res.length > 0;
}

// ============================================
// Status Updates
// ============================================

export async function updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  task.status = status;
  task.error = error;
  if (status === 'in_progress' && !task.started_at) task.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    task.completed_at = new Date().toISOString();
  }
  await saveTask(task);
  return task;
}

export async function updateTaskProgress(taskId: string, progress: TaskProgress): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  task.progress = progress.progress;
  if (progress.current_step !== undefined) task.current_step = progress.current_step;
  if (progress.step_status) {
    const step = task.steps.find(s => s.id === progress.step_status!.step_id);
    if (step) {
      step.status = progress.step_status.status;
      if (progress.step_status.status === 'in_progress') step.started_at = new Date().toISOString();
      if (progress.step_status.status === 'completed' || progress.step_status.status === 'failed') {
        step.completed_at = new Date().toISOString();
      }
      if (progress.step_status.output) step.output = progress.step_status.output;
      if (progress.step_status.error) step.error = progress.step_status.error;
    }
  }
  await saveTask(task);
  return task;
}

export async function setTaskResult(taskId: string, resultFile: string, summary?: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  task.result_file = resultFile;
  task.result_summary = summary;
  await saveTask(task);
  return task;
}

// ============================================
// Queue Operations
// ============================================

export async function enqueueTask(taskId: string, priority?: TaskPriority): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.status === 'queued' || task.status === 'in_progress' || task.status === 'running') return;
  if (priority) task.priority = priority;
  task.status = 'queued';
  await saveTask(task);
}

export async function dequeueNextTask(): Promise<Task | null> {
  if (queueSettings.paused) return null;
  const db = getDb();
  const activeRow = await db.select({ n: count() }).from(tasksTable).where(inArray(tasksTable.status, ACTIVE_STATUSES));
  if ((activeRow[0]?.n ?? 0) >= queueSettings.max_concurrent_tasks) return null;

  const pendingRows = await db.select().from(tasksTable).where(inArray(tasksTable.status, PENDING_STATUSES));
  if (pendingRows.length === 0) return null;
  const sorted = pendingRows.map(rowToTask).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const next = sorted[0]!;

  next.status = 'in_progress';
  next.started_at = new Date().toISOString();
  await saveTask(next);
  return next;
}

export async function removeFromQueue(taskId: string): Promise<void> {
  void taskId; /* Queue ist DB-derived; Caller setzt status um */
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = await loadQueue();
  const activeTasks: QueueStatus['active_tasks'] = [];
  const pendingTasks: QueueStatus['pending_tasks'] = [];
  for (const entry of queue.active) {
    const task = await getTask(entry.task_id);
    if (task) activeTasks.push({ id: task.id, title: task.title, progress: task.progress });
  }
  for (const entry of queue.pending) {
    const task = await getTask(entry.task_id);
    if (task) pendingTasks.push({ id: task.id, title: task.title, priority: entry.priority });
  }
  return {
    active_count: queue.active.length,
    pending_count: queue.pending.length,
    max_concurrent: queueSettings.max_concurrent_tasks,
    paused: queueSettings.paused,
    active_tasks: activeTasks,
    pending_tasks: pendingTasks,
  };
}

// ============================================
// Task Actions
// ============================================

export async function cancelTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return task;
  task.status = 'cancelled';
  task.completed_at = new Date().toISOString();
  await saveTask(task);
  return task;
}

export async function pauseTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  if (task.status !== 'in_progress') return task;
  task.status = 'paused';
  await saveTask(task);
  return task;
}

export async function resumeTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  if (task.status !== 'paused') return task;
  task.status = 'in_progress';
  await saveTask(task);
  return task;
}

export async function retryTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  if (!['failed', 'cancelled'].includes(task.status)) return task;
  const maxRetries = task.config.max_retries ?? 3;
  if ((task.retry_count || 0) >= maxRetries) {
    console.warn(`Task ${taskId} has exceeded max retries (${maxRetries})`);
    return task;
  }
  task.retry_count = (task.retry_count || 0) + 1;
  task.status = 'pending';
  task.progress = 0;
  task.current_step = 0;
  task.error = undefined;
  task.started_at = undefined;
  task.completed_at = undefined;
  task.result_file = undefined;
  task.result_summary = undefined;
  task.steps = task.steps.map(step => ({
    ...step,
    status: 'pending' as const,
    started_at: undefined,
    completed_at: undefined,
    error: undefined,
    output: undefined,
  }));
  await saveTask(task);
  await enqueueTask(taskId, task.priority);
  return task;
}

export async function scheduleRetry(taskId: string, error: string): Promise<boolean> {
  const task = await getTask(taskId);
  if (!task) return false;
  if (!task.config.auto_retry_on_failure) return false;
  const maxRetries = task.config.max_retries ?? 3;
  const currentRetries = task.retry_count || 0;
  if (currentRetries >= maxRetries) {
    console.log(`Task ${taskId} exceeded max retries, not scheduling retry`);
    return false;
  }
  void error;
  const baseDelay = 30000;
  const delay = baseDelay * Math.pow(2, currentRetries);
  console.log(`Scheduling retry for task ${taskId} in ${delay / 1000}s (attempt ${currentRetries + 1}/${maxRetries})`);
  setTimeout(async () => {
    try { await retryTask(taskId); } catch (err) { console.error(`Failed to retry task ${taskId}:`, err); }
  }, delay);
  return true;
}

// ============================================
// Scheduled Tasks
// ============================================

export async function getScheduledTasks(): Promise<Task[]> {
  const result = await listTasks();
  return result.tasks.filter(t => t.schedule?.enabled);
}

export async function checkScheduledTasks(): Promise<Task[]> {
  const scheduledTasks = await getScheduledTasks();
  const now = new Date();
  const tasksToRun: Task[] = [];
  for (const task of scheduledTasks) {
    if (!task.schedule) continue;
    if (task.schedule.run_at) {
      const runAt = new Date(task.schedule.run_at);
      if (runAt <= now && task.status === 'pending') tasksToRun.push(task);
    }
  }
  return tasksToRun;
}

// ============================================
// Cleanup
// ============================================

export async function cleanupOldTasks(olderThanDays = 30): Promise<number> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffIso = cutoff.toISOString();
  const res = await db
    .delete(tasksTable)
    .where(and(
      inArray(tasksTable.status, ['completed', 'failed', 'cancelled']),
      lt(tasksTable.createdAt, cutoffIso),
    ))
    .returning({ id: tasksTable.id });
  return res.length;
}

// ============================================
// Recovery (server restart)
// ============================================

export async function recoverTasks(): Promise<{ recovered: number; failed: number }> {
  const db = getDb();
  const orphans = await db.select().from(tasksTable).where(inArray(tasksTable.status, ACTIVE_STATUSES));
  let recovered = 0;
  for (const row of orphans) {
    await db
      .update(tasksTable)
      .set({ status: 'queued', updatedAt: new Date().toISOString() })
      .where(eq(tasksTable.id, row.id));
    recovered++;
  }
  console.log(`Task recovery: ${recovered} tasks re-queued, 0 tasks not found`);
  return { recovered, failed: 0 };
}

export { taskResultsTable };
