/**
 * Task Executor Service
 *
 * Background worker that processes tasks from the queue.
 * Runs agents independently from chat sessions.
 */

import {
  updateTaskStatus,
  updateTaskProgress,
  setTaskResult,
  dequeueNextTask,
  getQueueSettings,
  type Task,
} from './taskService';
import {
  broadcastTaskUpdate,
  notifyTaskStarted,
  notifyTaskProgress,
  notifyTaskCompleted,
  notifyTaskFailed,
} from '../routes/tasks';
import { runAgentLoop, type AgentEvent } from '../agents/loop';
import { generateSessionId, addMessage, saveChatHistory, saveConversation, getChatOwnerId } from './memory';
import { notificationService } from './notificationService';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Executor state
let isRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
const activeTasks = new Map<string, { abortController: AbortController; sessionId: string }>();

// Results directory
const RESULTS_DIR = resolve(process.cwd(), '../data/tasks/results');

/**
 * Start the task executor
 */
export async function startExecutor(): Promise<void> {
  if (isRunning) {
    console.log('Task executor already running');
    return;
  }

  // Ensure results directory exists
  if (!existsSync(RESULTS_DIR)) {
    await mkdir(RESULTS_DIR, { recursive: true });
  }

  isRunning = true;
  console.log('🚀 Task executor started');

  // Start polling loop
  pollInterval = setInterval(async () => {
    await processNextTask();
  }, 2000); // Poll every 2 seconds

  // Process immediately on start
  await processNextTask();
}

/**
 * Stop the task executor
 */
export function stopExecutor(): void {
  if (!isRunning) {
    return;
  }

  isRunning = false;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  // Cancel all active tasks
  for (const [taskId, { abortController }] of activeTasks) {
    console.log(`Aborting task ${taskId}`);
    abortController.abort();
  }
  activeTasks.clear();

  console.log('Task executor stopped');
}

/**
 * Check if executor is running
 */
export function isExecutorRunning(): boolean {
  return isRunning;
}

/**
 * Get active task count
 */
export function getActiveTaskCount(): number {
  return activeTasks.size;
}

/**
 * Process the next task from the queue
 */
async function processNextTask(): Promise<void> {
  if (!isRunning) return;

  const settings = await getQueueSettings();

  // Check if paused
  if (settings.paused) {
    return;
  }

  // Check if at capacity
  if (activeTasks.size >= settings.max_concurrent_tasks) {
    return;
  }

  // Try to dequeue a task (returns full Task object)
  const task = await dequeueNextTask();
  if (!task) {
    return;
  }

  // Start processing in background (don't await)
  executeTask(task).catch((error) => {
    console.error(`Error executing task ${task.id}:`, error);
  });
}

/**
 * Execute a single task
 */
async function executeTask(task: Task): Promise<void> {
  const taskId = task.id;

  console.log(`▶️ Starting task: ${task.title} (${taskId})`);

  // Create abort controller for this task
  const abortController = new AbortController();
  const sessionId = generateSessionId();

  activeTasks.set(taskId, { abortController, sessionId });

  // Set up timeout
  const timeoutMs = (task.config.timeout_minutes || 30) * 60 * 1000;
  const timeoutId = setTimeout(() => {
    console.log(`Task ${taskId} timed out after ${task.config.timeout_minutes} minutes`);
    abortController.abort();
  }, timeoutMs);

  try {
    // Update status to running
    await updateTaskStatus(taskId, 'running');
    await notifyTaskStarted(taskId);

    // Build the task prompt
    const taskPrompt = buildTaskPrompt(task);

    // Determine which agent to use
    const agentId = task.assigned_agent || 'supervisor';

    // Collect the full response
    let fullResponse = '';
    let lastProgress = 0;
    const toolCalls: Array<{ name: string; args: string; result: string }> = [];

    // Run the agent loop
    for await (const event of runAgentLoop(sessionId, taskPrompt, { agentId })) {
      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Task was cancelled');
      }

      // Handle events
      await handleAgentEvent(taskId, event, {
        onProgress: async (progress) => {
          if (progress !== lastProgress) {
            lastProgress = progress;
            await notifyTaskProgress(taskId, { progress });
          }
        },
        onContent: (content) => {
          fullResponse += content;
        },
        onToolCall: (name, args, result) => {
          toolCalls.push({ name, args, result });
        },
      });
    }

    // Task completed successfully
    clearTimeout(timeoutId);

    // Save result to file
    const resultFile = await saveTaskResult(taskId, {
      response: fullResponse,
      toolCalls,
      sessionId,
      completedAt: new Date().toISOString(),
    });

    // Generate summary
    const summary = generateSummary(fullResponse, toolCalls);

    await notifyTaskCompleted(taskId, resultFile, summary);

    // Post result back to source chat if available
    if (task.source_session_id) {
      const resultMessage = `**Task abgeschlossen: ${task.title}**\n\n${summary}\n\n[Vollstaendiges Ergebnis anzeigen](/tasks?open=${taskId})`;
      addMessage(task.source_session_id, {
        role: 'assistant',
        content: resultMessage,
      });
      try {
        await saveConversation(task.source_session_id);
        await saveChatHistory(task.source_session_id);
      } catch (err) {
        console.warn('Failed to save chat history with task result:', err);
      }
    }

    // Send user notification if enabled
    if (task.config.notify_on_complete) {
      try {
        // Get userId from source session or fall back to creator
        let userId: string | null = null;
        if (task.source_session_id) {
          userId = await getChatOwnerId(task.source_session_id);
        }
        if (userId) {
          // Update task with summary for notification
          const updatedTask = { ...task, result_summary: summary };
          await notificationService.notifyTaskCompleted(userId, updatedTask);
        }
      } catch (err) {
        console.warn('Failed to send task completion notification:', err);
      }
    }

    console.log(`✅ Task completed: ${task.title} (${taskId})`);
  } catch (error: any) {
    clearTimeout(timeoutId);

    const errorMessage = error.message || 'Unknown error';
    console.error(`❌ Task failed: ${task.title} (${taskId}):`, errorMessage);

    await notifyTaskFailed(taskId, errorMessage);

    // Send user notification if enabled
    if (task.config.notify_on_complete) {
      try {
        let userId: string | null = null;
        if (task.source_session_id) {
          userId = await getChatOwnerId(task.source_session_id);
        }
        if (userId) {
          await notificationService.notifyTaskFailed(userId, task, errorMessage);
        }
      } catch (err) {
        console.warn('Failed to send task failure notification:', err);
      }
    }

    // Schedule automatic retry if enabled
    const { scheduleRetry } = await import('./taskService');
    const willRetry = await scheduleRetry(taskId, errorMessage);
    if (willRetry) {
      console.log(`🔄 Retry scheduled for task ${taskId}`);
    }
  } finally {
    activeTasks.delete(taskId);
  }
}

/**
 * Build the prompt for a task
 */
function buildTaskPrompt(task: Task): string {
  let prompt = task.description || task.title;

  // Add steps if defined
  if (task.steps && task.steps.length > 0) {
    prompt += '\n\nSchritte:\n';
    task.steps.forEach((step, index) => {
      prompt += `${index + 1}. ${step.title}`;
      if (step.description) {
        prompt += `: ${step.description}`;
      }
      prompt += '\n';
    });
  }

  // Add context if available
  if (task.config.context) {
    prompt += `\n\nKontext: ${task.config.context}`;
  }

  return prompt;
}

/**
 * Handle an agent event and update task accordingly
 */
interface EventHandlers {
  onProgress: (progress: number) => Promise<void>;
  onContent: (content: string) => void;
  onToolCall: (name: string, args: string, result: string) => void;
}

async function handleAgentEvent(
  taskId: string,
  event: AgentEvent,
  handlers: EventHandlers
): Promise<void> {
  switch (event.type) {
    case 'thinking':
      broadcastTaskUpdate(taskId, 'thinking', {});
      break;

    case 'response_chunk':
      if (event.content) {
        handlers.onContent(event.content);
        broadcastTaskUpdate(taskId, 'response', { content: event.content });
      }
      break;

    case 'tool_start':
      broadcastTaskUpdate(taskId, 'tool_start', {
        tool: event.toolName,
        args: event.toolArgs,
      });
      break;

    case 'tool_end':
      handlers.onToolCall(
        event.toolName || 'unknown',
        event.toolArgs || '{}',
        event.toolResult || ''
      );
      broadcastTaskUpdate(taskId, 'tool_end', {
        tool: event.toolName,
        result: event.toolResult?.substring(0, 500), // Truncate for broadcast
      });
      break;

    case 'delegation_start':
      broadcastTaskUpdate(taskId, 'delegation_start', {
        agent: event.agentId,
        task: event.task,
      });
      break;

    case 'delegation_end':
      broadcastTaskUpdate(taskId, 'delegation_end', {
        agent: event.agentId,
        result: event.toolResult?.substring(0, 500),
      });
      break;

    case 'skill_activated':
      broadcastTaskUpdate(taskId, 'skill_activated', {
        skillId: event.skillId,
        skillName: event.skillName,
      });
      break;

    case 'workflow_step':
      await handlers.onProgress(event.workflowProgress || 0);
      broadcastTaskUpdate(taskId, 'workflow_step', {
        stepIndex: event.stepIndex,
        stepAction: event.stepAction,
        totalSteps: event.totalSteps,
        progress: event.workflowProgress,
      });
      break;

    case 'error':
      broadcastTaskUpdate(taskId, 'error', { message: event.content });
      throw new Error(event.content);

    case 'done':
      await handlers.onProgress(100);
      break;
  }
}

/**
 * Save task result to file
 */
async function saveTaskResult(taskId: string, result: any): Promise<string> {
  const filename = `${taskId}-result.json`;
  const filepath = resolve(RESULTS_DIR, filename);

  await writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

  return filepath;
}

/**
 * Generate a summary from the response
 */
function generateSummary(response: string, toolCalls: Array<{ name: string }>): string {
  // Take first 200 chars of response as summary
  let summary = response.substring(0, 200);
  if (response.length > 200) {
    summary += '...';
  }

  // Add tool usage info
  if (toolCalls.length > 0) {
    const toolNames = [...new Set(toolCalls.map((t) => t.name))];
    summary += ` (Tools: ${toolNames.join(', ')})`;
  }

  return summary;
}

/**
 * Cancel a running task
 */
export function cancelRunningTask(taskId: string): boolean {
  const activeTask = activeTasks.get(taskId);
  if (activeTask) {
    activeTask.abortController.abort();
    return true;
  }
  return false;
}

/**
 * Get status of a running task
 */
export function getRunningTaskStatus(taskId: string): { sessionId: string } | null {
  const activeTask = activeTasks.get(taskId);
  if (activeTask) {
    return { sessionId: activeTask.sessionId };
  }
  return null;
}
