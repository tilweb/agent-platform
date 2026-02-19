/**
 * Task Service
 *
 * Manages background tasks including CRUD operations and queue management.
 * Tasks are persisted as YAML files in data/tasks/
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'yaml';
import { generateId } from '../utils/id';

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
  cron?: string;  // Cron expression
  run_at?: string;  // ISO date for one-time scheduled tasks
  last_run?: string;
  next_run?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;

  // Owner
  userId?: string;  // User who owns this task

  // Origin
  created_by: 'user' | 'agent' | 'scheduled' | 'supervisor';
  source_session_id?: string;
  trigger: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;

  // Status
  status: TaskStatus;
  progress: number;
  current_step: number;
  total_steps: number;
  error?: string;
  retry_count?: number;

  // Execution
  assigned_agent?: string;
  plan_file?: string;

  // Steps
  steps: TaskStep[];

  // Result
  result_file?: string;
  result_summary?: string;

  // Config
  config: TaskConfig;

  // Scheduling
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
  userId?: string;  // Owner of the task
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
  userId?: string;  // Filter by owner
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

const TASKS_DIR = resolve(process.cwd(), '../data/tasks');
const QUEUE_FILE = resolve(TASKS_DIR, 'queue.yaml');

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

// ============================================
// Helper Functions
// ============================================

function generateTaskId(): string {
  return generateId('task');
}

function getTaskFilePath(taskId: string): string {
  return resolve(TASKS_DIR, `${taskId}.yaml`);
}

async function ensureTasksDir(): Promise<void> {
  if (!existsSync(TASKS_DIR)) {
    await mkdir(TASKS_DIR, { recursive: true });
  }
}

// ============================================
// Queue Management
// ============================================

// Simple in-memory mutex to prevent concurrent read-modify-write on queue.yaml
let queueLock: Promise<void> = Promise.resolve();

/**
 * Execute a callback with exclusive access to the queue file.
 * Prevents race conditions when multiple requests modify the queue simultaneously.
 */
export async function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = queueLock;
  queueLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

export async function loadQueue(): Promise<TaskQueue> {
  await ensureTasksDir();

  if (!existsSync(QUEUE_FILE)) {
    const defaultQueue: TaskQueue = {
      updated_at: '',
      active: [],
      pending: [],
      settings: {
        max_concurrent_tasks: 2,
        default_priority: 'normal',
        default_timeout_minutes: 30,
        paused: false,
      },
    };
    await saveQueue(defaultQueue);
    return defaultQueue;
  }

  const content = await readFile(QUEUE_FILE, 'utf-8');
  return yaml.parse(content) as TaskQueue;
}

export async function saveQueue(queue: TaskQueue): Promise<void> {
  await ensureTasksDir();
  queue.updated_at = new Date().toISOString();

  const yamlContent = yaml.stringify(queue, {
    indent: 2,
    lineWidth: 0,
  });

  await writeFile(QUEUE_FILE, yamlContent, 'utf-8');
}

export async function getQueueSettings(): Promise<QueueSettings> {
  const queue = await loadQueue();
  return queue.settings;
}

export async function updateQueueSettings(updates: Partial<QueueSettings>): Promise<QueueSettings> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    queue.settings = { ...queue.settings, ...updates };
    await saveQueue(queue);
    return queue.settings;
  });
}

// ============================================
// Task CRUD
// ============================================

export async function createTask(params: CreateTaskParams): Promise<Task> {
  await ensureTasksDir();

  const now = new Date().toISOString();
  const queue = await loadQueue();

  const task: Task = {
    id: generateTaskId(),
    title: params.title,
    description: params.description || '',
    type: params.type,
    priority: params.priority || queue.settings.default_priority,
    userId: params.userId,  // Store owner
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
      timeout_minutes: queue.settings.default_timeout_minutes,
      ...params.config,
    },
    schedule: params.schedule,
  };

  await saveTask(task);
  return task;
}

export async function saveTask(task: Task): Promise<void> {
  await ensureTasksDir();
  task.updated_at = new Date().toISOString();

  const yamlContent = yaml.stringify(task, {
    indent: 2,
    lineWidth: 0,
  });

  await writeFile(getTaskFilePath(task.id), yamlContent, 'utf-8');
}

export async function getTask(taskId: string): Promise<Task | null> {
  const filePath = getTaskFilePath(taskId);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  return yaml.parse(content) as Task;
}

export async function listTasks(filter?: TaskFilter): Promise<TaskListResult> {
  await ensureTasksDir();

  const files = await readdir(TASKS_DIR);
  const taskFiles = files.filter(f => f.startsWith('task_') && f.endsWith('.yaml'));

  const tasks: Task[] = [];

  for (const file of taskFiles) {
    const content = await readFile(resolve(TASKS_DIR, file), 'utf-8');
    const task = yaml.parse(content) as Task;
    tasks.push(task);
  }

  // Filter by userId first for stats calculation (user should only see their own stats)
  const userTasks = filter?.userId ? tasks.filter(t => t.userId === filter.userId) : tasks;

  // Calculate stats for user's tasks
  const stats: TaskStats = {
    total: userTasks.length,
    pending: userTasks.filter(t => t.status === 'pending' || t.status === 'queued').length,
    running: userTasks.filter(t => t.status === 'running' || t.status === 'in_progress').length,
    completed: userTasks.filter(t => t.status === 'completed').length,
    failed: userTasks.filter(t => t.status === 'failed').length,
    cancelled: userTasks.filter(t => t.status === 'cancelled').length,
  };

  // Apply filters
  let filtered = tasks;

  // Filter by userId first (most important for multi-user isolation)
  if (filter?.userId) {
    filtered = filtered.filter(t => t.userId === filter.userId);
  }

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    filtered = filtered.filter(t => statuses.includes(t.status));
  }

  if (filter?.type) {
    filtered = filtered.filter(t => t.type === filter.type);
  }

  if (filter?.priority) {
    filtered = filtered.filter(t => t.priority === filter.priority);
  }

  if (filter?.created_after) {
    const after = new Date(filter.created_after).getTime();
    filtered = filtered.filter(t => new Date(t.created_at).getTime() >= after);
  }

  if (filter?.created_before) {
    const before = new Date(filter.created_before).getTime();
    filtered = filtered.filter(t => new Date(t.created_at).getTime() <= before);
  }

  // Sort by created_at descending (newest first)
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = filtered.length;
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 20;

  // Apply pagination
  const paginated = filtered.slice(offset, offset + limit);

  return {
    tasks: paginated,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    stats,
  };
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  const updated = { ...task, ...updates, id: task.id }; // Preserve ID
  await saveTask(updated);
  return updated;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const filePath = getTaskFilePath(taskId);

  if (!existsSync(filePath)) {
    return false;
  }

  // Remove from queue if present
  const queue = await loadQueue();
  queue.active = queue.active.filter(e => e.task_id !== taskId);
  queue.pending = queue.pending.filter(e => e.task_id !== taskId);
  await saveQueue(queue);

  // Delete task file
  await unlink(filePath);
  return true;
}

// ============================================
// Task Status Updates
// ============================================

export async function updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  task.status = status;
  task.error = error;

  if (status === 'in_progress' && !task.started_at) {
    task.started_at = new Date().toISOString();
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    task.completed_at = new Date().toISOString();

    // Remove from queue
    const queue = await loadQueue();
    queue.active = queue.active.filter(e => e.task_id !== taskId);
    await saveQueue(queue);
  }

  await saveTask(task);
  return task;
}

export async function updateTaskProgress(taskId: string, progress: TaskProgress): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  task.progress = progress.progress;

  if (progress.current_step !== undefined) {
    task.current_step = progress.current_step;
  }

  if (progress.step_status) {
    const step = task.steps.find(s => s.id === progress.step_status!.step_id);
    if (step) {
      step.status = progress.step_status.status;

      if (progress.step_status.status === 'in_progress') {
        step.started_at = new Date().toISOString();
      }

      if (progress.step_status.status === 'completed' || progress.step_status.status === 'failed') {
        step.completed_at = new Date().toISOString();
      }

      if (progress.step_status.output) {
        step.output = progress.step_status.output;
      }

      if (progress.step_status.error) {
        step.error = progress.step_status.error;
      }
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
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  await withQueueLock(async () => {
    const queue = await loadQueue();
    const taskPriority = priority || task.priority;

    // Check if already in queue
    const inActive = queue.active.some(e => e.task_id === taskId);
    const inPending = queue.pending.some(e => e.task_id === taskId);

    if (inActive || inPending) {
      return; // Already queued
    }

    // Add to pending queue
    const entry: QueueEntry = {
      task_id: taskId,
      priority: taskPriority,
      queued_at: new Date().toISOString(),
    };

    queue.pending.push(entry);

    // Sort pending by priority
    queue.pending.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    // Update task status
    task.status = 'queued';
    await saveTask(task);

    await saveQueue(queue);
  });
}

export async function dequeueNextTask(): Promise<Task | null> {
  return withQueueLock(async () => {
    const queue = await loadQueue();

    // Check if we can run more tasks
    if (queue.settings.paused) {
      return null;
    }

    if (queue.active.length >= queue.settings.max_concurrent_tasks) {
      return null;
    }

    if (queue.pending.length === 0) {
      return null;
    }

    // Get next task (already sorted by priority)
    const entry = queue.pending.shift()!;
    const task = await getTask(entry.task_id);

    if (!task) {
      // Task was deleted, save and try next (recursive call will acquire its own lock)
      await saveQueue(queue);
      return null;
    }

    // Move to active
    queue.active.push({
      task_id: entry.task_id,
      priority: entry.priority,
      started_at: new Date().toISOString(),
    });

    await saveQueue(queue);

    // Update task status
    task.status = 'in_progress';
    task.started_at = new Date().toISOString();
    await saveTask(task);

    return task;
  });
}

export async function removeFromQueue(taskId: string): Promise<void> {
  return withQueueLock(async () => {
    const queue = await loadQueue();

    queue.active = queue.active.filter(e => e.task_id !== taskId);
    queue.pending = queue.pending.filter(e => e.task_id !== taskId);

    await saveQueue(queue);
  });
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = await loadQueue();

  const activeTasks: QueueStatus['active_tasks'] = [];
  const pendingTasks: QueueStatus['pending_tasks'] = [];

  for (const entry of queue.active) {
    const task = await getTask(entry.task_id);
    if (task) {
      activeTasks.push({
        id: task.id,
        title: task.title,
        progress: task.progress,
      });
    }
  }

  for (const entry of queue.pending) {
    const task = await getTask(entry.task_id);
    if (task) {
      pendingTasks.push({
        id: task.id,
        title: task.title,
        priority: entry.priority,
      });
    }
  }

  return {
    active_count: queue.active.length,
    pending_count: queue.pending.length,
    max_concurrent: queue.settings.max_concurrent_tasks,
    paused: queue.settings.paused,
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

  // Only cancel if not already completed
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return task;
  }

  await removeFromQueue(taskId);

  task.status = 'cancelled';
  task.completed_at = new Date().toISOString();
  await saveTask(task);

  return task;
}

export async function pauseTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  if (task.status !== 'in_progress') {
    return task;
  }

  task.status = 'paused';
  await saveTask(task);

  // Keep in active queue but mark as paused
  return task;
}

export async function resumeTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  if (task.status !== 'paused') {
    return task;
  }

  task.status = 'in_progress';
  await saveTask(task);

  return task;
}

export async function retryTask(taskId: string): Promise<Task | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  // Only retry failed or cancelled tasks
  if (!['failed', 'cancelled'].includes(task.status)) {
    return task;
  }

  // Check max retries
  const maxRetries = task.config.max_retries ?? 3;
  if ((task.retry_count || 0) >= maxRetries) {
    console.warn(`Task ${taskId} has exceeded max retries (${maxRetries})`);
    return task;
  }

  // Increment retry count
  task.retry_count = (task.retry_count || 0) + 1;

  // Reset task state
  task.status = 'pending';
  task.progress = 0;
  task.current_step = 0;
  task.error = undefined;
  task.started_at = undefined;
  task.completed_at = undefined;
  task.result_file = undefined;
  task.result_summary = undefined;

  // Reset step states
  task.steps = task.steps.map(step => ({
    ...step,
    status: 'pending' as const,
    started_at: undefined,
    completed_at: undefined,
    error: undefined,
    output: undefined,
  }));

  await saveTask(task);

  // Re-enqueue
  await enqueueTask(taskId, task.priority);

  return task;
}

/**
 * Schedule automatic retry with exponential backoff
 */
export async function scheduleRetry(taskId: string, error: string): Promise<boolean> {
  const task = await getTask(taskId);
  if (!task) return false;

  // Check if auto-retry is enabled
  if (!task.config.auto_retry_on_failure) {
    return false;
  }

  // Check max retries
  const maxRetries = task.config.max_retries ?? 3;
  const currentRetries = task.retry_count || 0;

  if (currentRetries >= maxRetries) {
    console.log(`Task ${taskId} exceeded max retries, not scheduling retry`);
    return false;
  }

  // Calculate delay with exponential backoff (30s, 1m, 2m, 4m, ...)
  const baseDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, currentRetries);

  console.log(`Scheduling retry for task ${taskId} in ${delay / 1000}s (attempt ${currentRetries + 1}/${maxRetries})`);

  // Schedule retry
  setTimeout(async () => {
    try {
      await retryTask(taskId);
    } catch (err) {
      console.error(`Failed to retry task ${taskId}:`, err);
    }
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

    // One-time scheduled task
    if (task.schedule.run_at) {
      const runAt = new Date(task.schedule.run_at);
      if (runAt <= now && task.status === 'pending') {
        tasksToRun.push(task);
      }
    }

    // Cron-based scheduling would need a cron parser library
    // For now, we'll skip cron support and add it later if needed
  }

  return tasksToRun;
}

// ============================================
// Cleanup
// ============================================

export async function cleanupOldTasks(olderThanDays: number = 30): Promise<number> {
  const result = await listTasks();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  let deleted = 0;

  for (const task of result.tasks) {
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      const completedAt = task.completed_at ? new Date(task.completed_at) : new Date(task.created_at);
      if (completedAt < cutoff) {
        await deleteTask(task.id);
        deleted++;
      }
    }
  }

  return deleted;
}

// ============================================
// Recovery (for server restart)
// ============================================

export async function recoverTasks(): Promise<{ recovered: number; failed: number }> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    let recovered = 0;
    let failed = 0;

    // Check active tasks - they were interrupted
    for (const entry of queue.active) {
      const task = await getTask(entry.task_id);
      if (!task) {
        failed++;
        continue;
      }

      // Re-queue the task to resume
      task.status = 'queued';
      await saveTask(task);

      // Move back to pending queue
      queue.pending.unshift({
        task_id: entry.task_id,
        priority: entry.priority,
        queued_at: new Date().toISOString(),
      });

      recovered++;
    }

    // Clear active queue
    queue.active = [];

    // Sort pending by priority
    queue.pending.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    await saveQueue(queue);

    console.log(`Task recovery: ${recovered} tasks re-queued, ${failed} tasks not found`);

    return { recovered, failed };
  });
}
