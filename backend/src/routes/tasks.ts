/**
 * Tasks API Routes
 *
 * REST endpoints for managing background tasks.
 * All routes require authentication - each user can only access their own tasks.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware, requireUserId, getCurrentUser } from '../auth';
import { internalError } from '../utils/errorHandler';
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskProgress,
  setTaskResult,
  enqueueTask,
  dequeueNextTask,
  removeFromQueue,
  getQueueStatus,
  getQueueSettings,
  updateQueueSettings,
  cancelTask,
  pauseTask,
  resumeTask,
  retryTask,
  recoverTasks,
  cleanupOldTasks,
  type CreateTaskParams,
  type TaskFilter,
  type TaskStatus,
  type TaskPriority,
} from '../services/taskService';

export const tasksRoutes = new Hono();

// Require authentication for all task routes
tasksRoutes.use('/*', authMiddleware);

// Event emitter for task updates (will be set by executor)
type TaskUpdateCallback = (taskId: string, event: string, data: any) => void;
let taskUpdateCallback: TaskUpdateCallback | null = null;

export function setTaskUpdateCallback(callback: TaskUpdateCallback | null): void {
  taskUpdateCallback = callback;
}

export function emitTaskUpdate(taskId: string, event: string, data: any): void {
  if (taskUpdateCallback) {
    taskUpdateCallback(taskId, event, data);
  }
}

// ============================================
// Task CRUD
// ============================================

// POST /api/tasks - Create a new task
tasksRoutes.post('/', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();

    const {
      title,
      description,
      type = 'simple',
      priority,
      trigger,
      assigned_agent,
      steps,
      config,
      schedule,
      enqueue = true,
    } = body;

    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    if (!trigger) {
      return c.json({ error: 'Trigger is required' }, 400);
    }

    const params: CreateTaskParams = {
      title,
      description,
      type,
      priority,
      trigger,
      userId,  // Associate task with current user
      assigned_agent,
      steps,
      config,
      schedule,
      created_by: 'user',
    };

    const task = await createTask(params);

    // Automatically enqueue unless explicitly disabled
    if (enqueue && !schedule?.enabled) {
      await enqueueTask(task.id, priority);
    }

    return c.json(task, 201);
  } catch (error: any) {
    console.error('Error creating task:', error);
    return internalError(c, error);
  }
});

// GET /api/tasks - List all tasks for current user
tasksRoutes.get('/', async (c) => {
  try {
    const userId = requireUserId(c);
    const status = c.req.query('status') as TaskStatus | undefined;
    const type = c.req.query('type');
    const priority = c.req.query('priority') as TaskPriority | undefined;
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');

    const filter: TaskFilter = {
      userId,  // Filter by current user
    };

    if (status) {
      // Support comma-separated statuses
      if (status.includes(',')) {
        filter.status = status.split(',') as TaskStatus[];
      } else {
        filter.status = status;
      }
    }

    if (type) {
      filter.type = type as any;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (limit) {
      filter.limit = parseInt(limit, 10);
    }

    if (offset) {
      filter.offset = parseInt(offset, 10);
    }

    const result = await listTasks(filter);

    return c.json(result);
  } catch (error: any) {
    console.error('Error listing tasks:', error);
    return c.json({ error: 'Failed to list tasks' }, 500);
  }
});

// GET /api/tasks/queue - Get queue status
tasksRoutes.get('/queue', async (c) => {
  try {
    const status = await getQueueStatus();
    const { isExecutorRunning, getActiveTaskCount } = await import('../services/taskExecutor');
    return c.json({
      ...status,
      executor_running: isExecutorRunning(),
      executing_count: getActiveTaskCount(),
    });
  } catch (error: any) {
    console.error('Error getting queue status:', error);
    return c.json({ error: 'Failed to get queue status' }, 500);
  }
});

// Admin guard for queue/executor management
function requireAdmin(c: any): Response | null {
  const user = getCurrentUser(c);
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin-Rechte erforderlich' }, 403);
  }
  return null;
}

// POST /api/tasks/executor/start - Start the executor (admin only)
tasksRoutes.post('/executor/start', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  try {
    const { startExecutor } = await import('../services/taskExecutor');
    await startExecutor();
    return c.json({ status: 'started' });
  } catch (error: any) {
    console.error('Error starting executor:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/executor/stop - Stop the executor (admin only)
tasksRoutes.post('/executor/stop', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  try {
    const { stopExecutor } = await import('../services/taskExecutor');
    stopExecutor();
    return c.json({ status: 'stopped' });
  } catch (error: any) {
    console.error('Error stopping executor:', error);
    return internalError(c, error);
  }
});

// PUT /api/tasks/queue/settings - Update queue settings (admin only)
tasksRoutes.put('/queue/settings', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  try {
    const body = await c.req.json();
    const settings = await updateQueueSettings(body);
    return c.json(settings);
  } catch (error: any) {
    console.error('Error updating queue settings:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/queue/pause - Pause the queue (admin only)
tasksRoutes.post('/queue/pause', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  try {
    const settings = await updateQueueSettings({ paused: true });
    return c.json({ paused: settings.paused });
  } catch (error: any) {
    console.error('Error pausing queue:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/queue/resume - Resume the queue (admin only)
tasksRoutes.post('/queue/resume', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  try {
    const settings = await updateQueueSettings({ paused: false });
    return c.json({ paused: settings.paused });
  } catch (error: any) {
    console.error('Error resuming queue:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/recover - Recover tasks after server restart
tasksRoutes.post('/recover', async (c) => {
  try {
    const result = await recoverTasks();
    return c.json(result);
  } catch (error: any) {
    console.error('Error recovering tasks:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/cleanup - Cleanup old tasks
tasksRoutes.post('/cleanup', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const days = body.older_than_days || 30;
    const deleted = await cleanupOldTasks(days);
    return c.json({ deleted, older_than_days: days });
  } catch (error: any) {
    console.error('Error cleaning up tasks:', error);
    return internalError(c, error);
  }
});

// GET /api/tasks/stream/all - SSE stream for ALL task updates (dashboard)
tasksRoutes.get('/stream/all', async (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial queue status
    const status = await getQueueStatus();
    await stream.writeSSE({
      event: 'init',
      data: JSON.stringify(status),
    });

    // Set up global listener
    const listener = async (taskId: string, event: string, data: any) => {
      try {
        await stream.writeSSE({
          event,
          data: JSON.stringify({ taskId, ...data }),
        });
      } catch {
        removeGlobalTaskListener(listener);
      }
    };

    addGlobalTaskListener(listener);

    // Heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: '' });
      } catch {
        clearInterval(heartbeat);
        removeGlobalTaskListener(listener);
      }
    }, 15000);

    // Keep open for 2 hours max
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        clearInterval(heartbeat);
        removeGlobalTaskListener(listener);
        resolve();
      }, 2 * 60 * 60 * 1000);
    });
  });
});

// GET /api/tasks/:id - Get task details
tasksRoutes.get('/:id', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    const task = await getTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Check ownership
    if (task.userId && task.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json(task);
  } catch (error: any) {
    console.error('Error getting task:', error);
    return c.json({ error: 'Failed to get task' }, 500);
  }
});

// GET /api/tasks/:id/result - Get full task result
tasksRoutes.get('/:id/result', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    const task = await getTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Check ownership
    if (task.userId && task.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    if (!task.result_file) {
      return c.json({ error: 'No result available' }, 404);
    }

    try {
      const content = await Bun.file(task.result_file).text();
      const result = JSON.parse(content);
      return c.json(result);
    } catch (err) {
      console.error('Error reading result file:', err);
      return c.json({ error: 'Failed to read result' }, 500);
    }
  } catch (error: any) {
    console.error('Error getting task result:', error);
    return c.json({ error: 'Failed to get task result' }, 500);
  }
});

// PUT /api/tasks/:id - Update task
tasksRoutes.put('/:id', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership before update
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const body = await c.req.json();
    const task = await updateTask(taskId, body);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json(task);
  } catch (error: any) {
    console.error('Error updating task:', error);
    return internalError(c, error);
  }
});

// DELETE /api/tasks/:id - Delete task
tasksRoutes.delete('/:id', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership before delete
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const deleted = await deleteTask(taskId);

    if (!deleted) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return internalError(c, error);
  }
});

// ============================================
// Task Actions
// ============================================

// POST /api/tasks/:id/enqueue - Add task to queue
tasksRoutes.post('/:id/enqueue', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    await enqueueTask(taskId, body.priority);

    const task = await getTask(taskId);
    return c.json(task);
  } catch (error: any) {
    console.error('Error enqueueing task:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/:id/cancel - Cancel task
tasksRoutes.post('/:id/cancel', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // First try to abort if running
    const { cancelRunningTask } = await import('../services/taskExecutor');
    cancelRunningTask(taskId);

    const task = await cancelTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    emitTaskUpdate(taskId, 'cancelled', { task });

    return c.json(task);
  } catch (error: any) {
    console.error('Error cancelling task:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/:id/pause - Pause task
tasksRoutes.post('/:id/pause', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const task = await pauseTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    emitTaskUpdate(taskId, 'paused', { task });

    return c.json(task);
  } catch (error: any) {
    console.error('Error pausing task:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/:id/resume - Resume paused task
tasksRoutes.post('/:id/resume', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const task = await resumeTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    emitTaskUpdate(taskId, 'resumed', { task });

    return c.json(task);
  } catch (error: any) {
    console.error('Error resuming task:', error);
    return internalError(c, error);
  }
});

// POST /api/tasks/:id/retry - Retry failed task
tasksRoutes.post('/:id/retry', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  try {
    // Check ownership
    const existingTask = await getTask(taskId);
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (existingTask.userId && existingTask.userId !== userId) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const task = await retryTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json(task);
  } catch (error: any) {
    console.error('Error retrying task:', error);
    return internalError(c, error);
  }
});

// ============================================
// Task Streaming (SSE)
// ============================================

// Store active SSE connections per task
const taskStreams = new Map<string, Set<(event: string, data: any) => void>>();

// Global listeners for all task updates (dashboard view)
const globalTaskListeners = new Set<(taskId: string, event: string, data: any) => void>();

export function addTaskStreamListener(taskId: string, listener: (event: string, data: any) => void): void {
  if (!taskStreams.has(taskId)) {
    taskStreams.set(taskId, new Set());
  }
  taskStreams.get(taskId)!.add(listener);
}

export function removeTaskStreamListener(taskId: string, listener: (event: string, data: any) => void): void {
  const listeners = taskStreams.get(taskId);
  if (listeners) {
    listeners.delete(listener);
    if (listeners.size === 0) {
      taskStreams.delete(taskId);
    }
  }
}

export function addGlobalTaskListener(listener: (taskId: string, event: string, data: any) => void): void {
  globalTaskListeners.add(listener);
}

export function removeGlobalTaskListener(listener: (taskId: string, event: string, data: any) => void): void {
  globalTaskListeners.delete(listener);
}

export function broadcastTaskUpdate(taskId: string, event: string, data: any): void {
  // Notify task-specific listeners
  const listeners = taskStreams.get(taskId);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event, data);
      } catch (e) {
        // Listener failed, remove it
        listeners.delete(listener);
      }
    }
  }

  // Notify global listeners
  for (const listener of globalTaskListeners) {
    try {
      listener(taskId, event, data);
    } catch (e) {
      globalTaskListeners.delete(listener);
    }
  }
}

// GET /api/tasks/:id/stream - SSE stream for task updates
tasksRoutes.get('/:id/stream', async (c) => {
  const userId = requireUserId(c);
  const taskId = c.req.param('id');

  // Check if task exists
  const task = await getTask(taskId);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Check ownership
  if (task.userId && task.userId !== userId) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Send initial state
    await stream.writeSSE({
      event: 'init',
      data: JSON.stringify(task),
    });

    // Set up listener for updates
    const listener = async (event: string, data: any) => {
      try {
        await stream.writeSSE({
          event,
          data: JSON.stringify(data),
        });
      } catch {
        // Stream closed
        removeTaskStreamListener(taskId, listener);
      }
    };

    addTaskStreamListener(taskId, listener);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: '' });
      } catch {
        clearInterval(heartbeat);
        removeTaskStreamListener(taskId, listener);
      }
    }, 15000);

    // Keep stream open until task completes or client disconnects
    // The stream will be closed by the client or when the task completes
    await new Promise<void>((resolve) => {
      const checkComplete = async () => {
        const currentTask = await getTask(taskId);
        if (!currentTask ||
            currentTask.status === 'completed' ||
            currentTask.status === 'failed' ||
            currentTask.status === 'cancelled') {
          clearInterval(heartbeat);
          clearInterval(checkInterval);
          removeTaskStreamListener(taskId, listener);
          resolve();
        }
      };

      const checkInterval = setInterval(checkComplete, 5000);

      // Also resolve after 30 minutes max (timeout)
      setTimeout(() => {
        clearInterval(heartbeat);
        clearInterval(checkInterval);
        removeTaskStreamListener(taskId, listener);
        resolve();
      }, 30 * 60 * 1000);
    });
  });
});

// ============================================
// Internal API (for executor)
// ============================================

// These functions are called internally by the task executor
// and also broadcast updates to connected SSE clients

export async function notifyTaskStarted(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  if (task) {
    broadcastTaskUpdate(taskId, 'started', { task });
  }
}

export async function notifyTaskProgress(taskId: string, progress: any): Promise<void> {
  await updateTaskProgress(taskId, progress);
  const task = await getTask(taskId);
  if (task) {
    broadcastTaskUpdate(taskId, 'progress', { task, progress });
  }
}

export async function notifyTaskStepStarted(taskId: string, stepId: string): Promise<void> {
  await updateTaskProgress(taskId, {
    progress: 0, // Will be recalculated
    step_status: { step_id: stepId, status: 'in_progress' },
  });
  const task = await getTask(taskId);
  if (task) {
    broadcastTaskUpdate(taskId, 'step_started', { task, step_id: stepId });
  }
}

export async function notifyTaskStepCompleted(taskId: string, stepId: string, output?: string): Promise<void> {
  await updateTaskProgress(taskId, {
    progress: 0,
    step_status: { step_id: stepId, status: 'completed', output },
  });
  const task = await getTask(taskId);
  if (task) {
    // Calculate new progress
    const completedSteps = task.steps.filter(s => s.status === 'completed').length;
    const newProgress = Math.round((completedSteps / task.total_steps) * 100);
    await updateTaskProgress(taskId, { progress: newProgress, current_step: completedSteps });

    const updatedTask = await getTask(taskId);
    broadcastTaskUpdate(taskId, 'step_completed', { task: updatedTask, step_id: stepId });
  }
}

export async function notifyTaskCompleted(taskId: string, resultFile?: string, summary?: string): Promise<void> {
  if (resultFile) {
    await setTaskResult(taskId, resultFile, summary);
  }
  await updateTaskStatus(taskId, 'completed');
  const task = await getTask(taskId);
  if (task) {
    broadcastTaskUpdate(taskId, 'completed', { task });
  }
}

export async function notifyTaskFailed(taskId: string, error: string): Promise<void> {
  await updateTaskStatus(taskId, 'failed', error);
  const task = await getTask(taskId);
  if (task) {
    broadcastTaskUpdate(taskId, 'failed', { task, error });
  }
}
