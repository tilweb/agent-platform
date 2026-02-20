/**
 * Tests for the Task Service (backend/src/services/taskService.ts)
 *
 * The yamlStorage utility (createYamlStore), file system dependencies
 * (fs/promises, fs), path utilities, and the ID generator are mocked at the
 * module level so no real disk I/O occurs.
 *
 * The in-memory task and queue stores are reset in beforeEach to ensure each
 * test is completely independent.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import * as yaml from "yaml";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** In-memory task store: taskId -> YAML string */
  taskFiles: {} as Record<string, string>,
  /** In-memory queue file content (YAML string) or null when absent */
  queueFile: null as string | null,
  /** Incrementing counter to produce stable IDs within a test */
  idCounter: 0,
  /** Base directory used by the mock */
  tasksDir: "/tmp/test-tasks",
};

// ---------------------------------------------------------------------------
// Shared path utilities used by every path mock factory
// ---------------------------------------------------------------------------

function mockJoin(...parts: string[]): string {
  return parts
    .filter((p) => p !== undefined && p !== "")
    .join("/")
    .replace(/\/+/g, "/");
}

function mockDirname(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return "/";
  return p.slice(0, idx);
}

function mockResolve(...parts: string[]): string {
  return mockJoin(...parts);
}

function mockBasename(p: string, ext?: string): string {
  const base = p.split("/").pop() ?? "";
  if (ext && base.endsWith(ext)) return base.slice(0, base.length - ext.length);
  return base;
}

function mockExtname(p: string): string {
  const base = mockBasename(p);
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot);
}

const pathModule = {
  join: mockJoin,
  dirname: mockDirname,
  resolve: mockResolve,
  basename: mockBasename,
  extname: mockExtname,
  sep: "/",
  delimiter: ":",
  default: {
    join: mockJoin,
    dirname: mockDirname,
    resolve: mockResolve,
    basename: mockBasename,
    extname: mockExtname,
    sep: "/",
    delimiter: ":",
  },
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock the yamlStorage module.  createYamlStore is a factory that returns an
// object with ensureDir / filePath / load / save / listIds / delete methods.
// We implement an in-memory version that reads/writes mockState.taskFiles.
// The prefix filter is intentionally omitted: mockState.taskFiles only holds
// tasks, so no filtering is needed for correct test behaviour.
mock.module("../../utils/yamlStorage", () => ({
  createYamlStore: <T>(_dir: string, _options?: unknown) => {
    return {
      ensureDir: async () => {},

      filePath: (id: string) => `${mockState.tasksDir}/${id}.yaml`,

      load: async (id: string): Promise<T | null> => {
        const raw = mockState.taskFiles[id];
        if (raw === undefined) return null;
        return yaml.parse(raw) as T;
      },

      save: async (id: string, data: T): Promise<void> => {
        mockState.taskFiles[id] = yaml.stringify(data);
      },

      listIds: async (): Promise<string[]> => {
        return Object.keys(mockState.taskFiles);
      },

      delete: async (id: string): Promise<boolean> => {
        if (mockState.taskFiles[id] === undefined) return false;
        delete mockState.taskFiles[id];
        return true;
      },
    };
  },
}));

// Mock fs/promises — used by loadQueue / saveQueue for queue.yaml
const fspFactory = () => ({
  readFile: async (filePath: string) => {
    if (mockState.queueFile !== null) return mockState.queueFile;
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, open '${filePath}'`
    );
    err.code = "ENOENT";
    throw err;
  },
  writeFile: async (_filePath: string, content: string) => {
    mockState.queueFile = content;
  },
  mkdir: async () => {},
  unlink: async (filePath: string) => {
    const id = (filePath as string).replace(/^.*\//, "").replace(/\.yaml$/, "");
    delete mockState.taskFiles[id];
  },
});
mock.module("fs/promises", fspFactory);
mock.module("node:fs/promises", fspFactory);

// Mock fs — existsSync is used to check whether queue.yaml is present
const fsFactory = () => ({
  existsSync: (_filePath: string) => mockState.queueFile !== null,
});
mock.module("fs", fsFactory);
mock.module("node:fs", fsFactory);

// Mock path — provide a complete set of path utilities so no named export is
// missing regardless of which specifier (path / node:path) the runtime uses.
mock.module("path", () => pathModule);
mock.module("node:path", () => pathModule);

// Mock ID generator — yields deterministic, sequential task IDs
mock.module("../../utils/id", () => ({
  generateId: (prefix: string) => {
    mockState.idCounter += 1;
    return `${prefix}_${mockState.idCounter}`;
  },
}));

// Mock paths — only TASKS_DIR is needed by taskService
mock.module("../../utils/paths", () => ({
  TASKS_DIR: mockState.tasksDir,
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  createTask,
  getTask,
  listTasks,
  updateTask,
  deleteTask,
  saveTask,
  updateTaskStatus,
  updateTaskProgress,
  setTaskResult,
  enqueueTask,
  dequeueNextTask,
  removeFromQueue,
  loadQueue,
  saveQueue,
  getQueueSettings,
  updateQueueSettings,
  getQueueStatus,
  cancelTask,
  pauseTask,
  resumeTask,
  retryTask,
  scheduleRetry,
  getScheduledTasks,
  checkScheduledTasks,
  cleanupOldTasks,
  recoverTasks,
  withQueueLock,
} = await import("../taskService");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal CreateTaskParams object with sensible defaults */
function makeParams(overrides: Record<string, any> = {}) {
  return {
    title: "Test Task",
    description: "A test task",
    type: "simple" as const,
    trigger: "manual",
    ...overrides,
  };
}

/** Persist a ready-made Task directly into the mock store */
async function seedTask(task: Record<string, any>) {
  mockState.taskFiles[task.id] = yaml.stringify(task);
}

/** Build a minimal valid Task object */
function makeTask(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: "task_seed",
    title: "Seeded Task",
    description: "",
    type: "simple",
    priority: "normal",
    created_by: "user",
    trigger: "manual",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "pending",
    progress: 0,
    current_step: 0,
    total_steps: 0,
    steps: [],
    config: {
      max_iterations: 50,
      timeout_minutes: 30,
      notify_on_complete: true,
      auto_retry_on_failure: false,
    },
    ...overrides,
  };
}

/** Build and persist a default queue YAML so loadQueue finds a file */
function seedQueue(overrides: Record<string, any> = {}) {
  const q = {
    updated_at: new Date().toISOString(),
    active: [],
    pending: [],
    settings: {
      max_concurrent_tasks: 2,
      default_priority: "normal",
      default_timeout_minutes: 30,
      paused: false,
    },
    ...overrides,
  };
  mockState.queueFile = yaml.stringify(q);
  return q;
}

// ---------------------------------------------------------------------------
// Reset state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.taskFiles = {};
  mockState.queueFile = null;
  mockState.idCounter = 0;
});

// ===========================================================================
// createTask
// ===========================================================================

describe("createTask()", () => {
  test("should return a task with the supplied title and trigger", async () => {
    const task = await createTask(makeParams({ title: "My Task", trigger: "cron" }));
    expect(task.title).toBe("My Task");
    expect(task.trigger).toBe("cron");
  });

  test("should assign a generated ID with the task_ prefix", async () => {
    const task = await createTask(makeParams());
    expect(task.id).toBe("task_1");
  });

  test("should default status to pending", async () => {
    const task = await createTask(makeParams());
    expect(task.status).toBe("pending");
  });

  test("should default progress and step counters to zero", async () => {
    const task = await createTask(makeParams());
    expect(task.progress).toBe(0);
    expect(task.current_step).toBe(0);
    expect(task.total_steps).toBe(0);
  });

  test("should set description to empty string when not supplied", async () => {
    const task = await createTask(makeParams({ description: undefined }));
    expect(task.description).toBe("");
  });

  test("should set description when supplied", async () => {
    const task = await createTask(makeParams({ description: "My description" }));
    expect(task.description).toBe("My description");
  });

  test("should default created_by to user", async () => {
    const task = await createTask(makeParams());
    expect(task.created_by).toBe("user");
  });

  test("should respect an explicit created_by value", async () => {
    const task = await createTask(makeParams({ created_by: "agent" }));
    expect(task.created_by).toBe("agent");
  });

  test("should store userId when provided", async () => {
    const task = await createTask(makeParams({ userId: "u1" }));
    expect(task.userId).toBe("u1");
  });

  test("should store assigned_agent when provided", async () => {
    const task = await createTask(makeParams({ assigned_agent: "agent-007" }));
    expect(task.assigned_agent).toBe("agent-007");
  });

  test("should populate steps from the steps array", async () => {
    const task = await createTask(
      makeParams({ steps: [{ name: "Step A" }, { name: "Step B" }] })
    );
    expect(task.steps).toHaveLength(2);
    expect(task.steps[0].name).toBe("Step A");
    expect(task.steps[1].name).toBe("Step B");
    expect(task.total_steps).toBe(2);
  });

  test("should assign sequential IDs to steps", async () => {
    const task = await createTask(
      makeParams({ steps: [{ name: "First" }, { name: "Second" }] })
    );
    expect(task.steps[0].id).toBe("step_1");
    expect(task.steps[1].id).toBe("step_2");
  });

  test("should default step status to pending", async () => {
    const task = await createTask(makeParams({ steps: [{ name: "S1" }] }));
    expect(task.steps[0].status).toBe("pending");
  });

  test("should use the queue default_priority when no priority is supplied", async () => {
    seedQueue({
      settings: {
        default_priority: "high",
        max_concurrent_tasks: 2,
        default_timeout_minutes: 30,
        paused: false,
      },
    });
    const task = await createTask(makeParams());
    expect(task.priority).toBe("high");
  });

  test("should use the supplied priority over the queue default", async () => {
    seedQueue();
    const task = await createTask(makeParams({ priority: "urgent" }));
    expect(task.priority).toBe("urgent");
  });

  test("should use the queue default_timeout_minutes in config", async () => {
    seedQueue({
      settings: {
        max_concurrent_tasks: 2,
        default_priority: "normal",
        default_timeout_minutes: 45,
        paused: false,
      },
    });
    const task = await createTask(makeParams());
    expect(task.config.timeout_minutes).toBe(45);
  });

  test("should allow config overrides", async () => {
    const task = await createTask(
      makeParams({ config: { max_iterations: 10, notify_on_complete: false } })
    );
    expect(task.config.max_iterations).toBe(10);
    expect(task.config.notify_on_complete).toBe(false);
  });

  test("should persist the task to the store", async () => {
    const task = await createTask(makeParams({ title: "Persisted" }));
    const loaded = await getTask(task.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Persisted");
  });

  test("should store schedule when provided", async () => {
    const schedule = { enabled: true, run_at: "2026-03-01T10:00:00.000Z" };
    const task = await createTask(makeParams({ schedule }));
    expect(task.schedule).toEqual(schedule);
  });
});

// ===========================================================================
// getTask
// ===========================================================================

describe("getTask()", () => {
  test("should return the task when it exists", async () => {
    const seeded = makeTask({ id: "task_seed", title: "Existing" });
    await seedTask(seeded);
    const loaded = await getTask("task_seed");
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Existing");
  });

  test("should return null when the task does not exist", async () => {
    const result = await getTask("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// saveTask
// ===========================================================================

describe("saveTask()", () => {
  test("should persist changes to an existing task", async () => {
    const task = await createTask(makeParams());
    task.title = "Updated Title";
    await saveTask(task as any);
    const loaded = await getTask(task.id);
    expect(loaded!.title).toBe("Updated Title");
  });

  test("should update the updated_at timestamp", async () => {
    const task = await createTask(makeParams());
    const before = task.updated_at;
    await new Promise((r) => setTimeout(r, 2));
    await saveTask(task as any);
    const loaded = await getTask(task.id);
    expect(loaded!.updated_at >= before).toBe(true);
  });
});

// ===========================================================================
// listTasks
// ===========================================================================

describe("listTasks()", () => {
  test("should return an empty list when no tasks exist", async () => {
    const result = await listTasks();
    expect(result.tasks).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("should return all tasks when no filter is applied", async () => {
    await seedTask(makeTask({ id: "t1", title: "T1" }));
    await seedTask(makeTask({ id: "t2", title: "T2" }));
    const result = await listTasks();
    expect(result.tasks).toHaveLength(2);
  });

  test("should filter by single status", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    await seedTask(makeTask({ id: "t2", status: "completed" }));
    const result = await listTasks({ status: "completed" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].status).toBe("completed");
  });

  test("should filter by multiple statuses (array)", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    await seedTask(makeTask({ id: "t2", status: "completed" }));
    await seedTask(makeTask({ id: "t3", status: "failed" }));
    const result = await listTasks({ status: ["pending", "failed"] });
    expect(result.tasks).toHaveLength(2);
    const statuses = result.tasks.map((t) => t.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("failed");
  });

  test("should filter by type", async () => {
    await seedTask(makeTask({ id: "t1", type: "simple" }));
    await seedTask(makeTask({ id: "t2", type: "deep-research" }));
    const result = await listTasks({ type: "simple" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].type).toBe("simple");
  });

  test("should filter by priority", async () => {
    await seedTask(makeTask({ id: "t1", priority: "urgent" }));
    await seedTask(makeTask({ id: "t2", priority: "low" }));
    const result = await listTasks({ priority: "urgent" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].priority).toBe("urgent");
  });

  test("should filter by userId", async () => {
    await seedTask(makeTask({ id: "t1", userId: "alice" }));
    await seedTask(makeTask({ id: "t2", userId: "bob" }));
    const result = await listTasks({ userId: "alice" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].userId).toBe("alice");
  });

  test("should filter by created_after", async () => {
    await seedTask(makeTask({ id: "t1", created_at: "2026-01-01T00:00:00.000Z" }));
    await seedTask(makeTask({ id: "t2", created_at: "2026-02-01T00:00:00.000Z" }));
    const result = await listTasks({ created_after: "2026-01-15T00:00:00.000Z" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("t2");
  });

  test("should filter by created_before", async () => {
    await seedTask(makeTask({ id: "t1", created_at: "2026-01-01T00:00:00.000Z" }));
    await seedTask(makeTask({ id: "t2", created_at: "2026-02-01T00:00:00.000Z" }));
    const result = await listTasks({ created_before: "2026-01-15T00:00:00.000Z" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("t1");
  });

  test("should sort tasks by created_at descending (newest first)", async () => {
    await seedTask(makeTask({ id: "t1", created_at: "2026-01-01T00:00:00.000Z" }));
    await seedTask(makeTask({ id: "t2", created_at: "2026-02-01T00:00:00.000Z" }));
    const result = await listTasks();
    expect(result.tasks[0].id).toBe("t2");
    expect(result.tasks[1].id).toBe("t1");
  });

  test("should apply pagination with limit and offset", async () => {
    for (let i = 1; i <= 5; i++) {
      await seedTask(
        makeTask({ id: `t${i}`, created_at: `2026-0${i}-01T00:00:00.000Z` })
      );
    }
    const result = await listTasks({ limit: 2, offset: 1 });
    expect(result.tasks).toHaveLength(2);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(1);
  });

  test("should set hasMore to true when more pages exist", async () => {
    for (let i = 1; i <= 5; i++) {
      await seedTask(
        makeTask({ id: `t${i}`, created_at: `2026-0${i}-01T00:00:00.000Z` })
      );
    }
    const result = await listTasks({ limit: 2, offset: 0 });
    expect(result.hasMore).toBe(true);
  });

  test("should set hasMore to false on the last page", async () => {
    await seedTask(makeTask({ id: "t1" }));
    await seedTask(makeTask({ id: "t2" }));
    const result = await listTasks({ limit: 5, offset: 0 });
    expect(result.hasMore).toBe(false);
  });

  test("should default limit to 20 when not specified", async () => {
    const result = await listTasks();
    expect(result.limit).toBe(20);
  });

  test("should include stats scoped to userId when userId filter is active", async () => {
    await seedTask(makeTask({ id: "t1", userId: "alice", status: "completed" }));
    await seedTask(makeTask({ id: "t2", userId: "alice", status: "failed" }));
    await seedTask(makeTask({ id: "t3", userId: "bob", status: "pending" }));
    const result = await listTasks({ userId: "alice" });
    expect(result.stats.total).toBe(2);
    expect(result.stats.completed).toBe(1);
    expect(result.stats.failed).toBe(1);
  });

  test("should count queued tasks in stats.pending", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued" }));
    const result = await listTasks();
    expect(result.stats.pending).toBeGreaterThanOrEqual(1);
  });

  test("should count running/in_progress tasks in stats.running", async () => {
    await seedTask(makeTask({ id: "t1", status: "running" }));
    await seedTask(makeTask({ id: "t2", status: "in_progress" }));
    const result = await listTasks();
    expect(result.stats.running).toBe(2);
  });

  test("should count cancelled tasks in stats.cancelled", async () => {
    await seedTask(makeTask({ id: "t1", status: "cancelled" }));
    const result = await listTasks();
    expect(result.stats.cancelled).toBe(1);
  });
});

// ===========================================================================
// updateTask
// ===========================================================================

describe("updateTask()", () => {
  test("should return the updated task with applied changes", async () => {
    await seedTask(makeTask({ id: "t1", title: "Original" }));
    const updated = await updateTask("t1", { title: "Changed" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Changed");
  });

  test("should preserve the original task ID", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const updated = await updateTask("t1", { id: "should-be-ignored" } as any);
    expect(updated!.id).toBe("t1");
  });

  test("should return null when the task does not exist", async () => {
    const result = await updateTask("nonexistent", { title: "X" });
    expect(result).toBeNull();
  });

  test("should persist changes after update", async () => {
    await seedTask(makeTask({ id: "t1", progress: 0 }));
    await updateTask("t1", { progress: 75 });
    const loaded = await getTask("t1");
    expect(loaded!.progress).toBe(75);
  });
});

// ===========================================================================
// deleteTask
// ===========================================================================

describe("deleteTask()", () => {
  test("should return true when the task exists and is deleted", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const result = await deleteTask("t1");
    expect(result).toBe(true);
  });

  test("should remove the task from the store", async () => {
    await seedTask(makeTask({ id: "t1" }));
    await deleteTask("t1");
    const loaded = await getTask("t1");
    expect(loaded).toBeNull();
  });

  test("should return false when the task does not exist", async () => {
    const result = await deleteTask("nonexistent");
    expect(result).toBe(false);
  });

  test("should remove the task from the active queue before deleting", async () => {
    await seedTask(makeTask({ id: "t1" }));
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await deleteTask("t1");
    const queue = await loadQueue();
    const inActive = queue.active.some((e: any) => e.task_id === "t1");
    expect(inActive).toBe(false);
  });

  test("should remove the task from the pending queue before deleting", async () => {
    await seedTask(makeTask({ id: "t1" }));
    seedQueue({
      active: [],
      pending: [{ task_id: "t1", priority: "normal" }],
    });
    await deleteTask("t1");
    const queue = await loadQueue();
    const inPending = queue.pending.some((e: any) => e.task_id === "t1");
    expect(inPending).toBe(false);
  });
});

// ===========================================================================
// updateTaskStatus
// ===========================================================================

describe("updateTaskStatus()", () => {
  test("should update the task status", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    const updated = await updateTaskStatus("t1", "in_progress");
    expect(updated!.status).toBe("in_progress");
  });

  test("should set started_at when transitioning to in_progress", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending", started_at: undefined }));
    const updated = await updateTaskStatus("t1", "in_progress");
    expect(updated!.started_at).toBeDefined();
  });

  test("should not overwrite started_at if already set", async () => {
    const existingStart = "2026-01-01T00:00:00.000Z";
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", started_at: existingStart })
    );
    const updated = await updateTaskStatus("t1", "in_progress");
    expect(updated!.started_at).toBe(existingStart);
  });

  test("should set completed_at when task transitions to completed", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    const updated = await updateTaskStatus("t1", "completed");
    expect(updated!.completed_at).toBeDefined();
  });

  test("should set completed_at when task transitions to failed", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    const updated = await updateTaskStatus("t1", "failed");
    expect(updated!.completed_at).toBeDefined();
  });

  test("should set completed_at when task transitions to cancelled", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    const updated = await updateTaskStatus("t1", "cancelled");
    expect(updated!.completed_at).toBeDefined();
  });

  test("should store the optional error message", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    const updated = await updateTaskStatus("t1", "failed", "Something went wrong");
    expect(updated!.error).toBe("Something went wrong");
  });

  test("should remove task from active queue on completion", async () => {
    await seedTask(makeTask({ id: "t1" }));
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await updateTaskStatus("t1", "completed");
    const queue = await loadQueue();
    expect(queue.active.some((e: any) => e.task_id === "t1")).toBe(false);
  });

  test("should return null when task does not exist", async () => {
    const result = await updateTaskStatus("nonexistent", "completed");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// updateTaskProgress
// ===========================================================================

describe("updateTaskProgress()", () => {
  test("should update the progress value", async () => {
    await seedTask(makeTask({ id: "t1", progress: 0 }));
    const updated = await updateTaskProgress("t1", { progress: 50 });
    expect(updated!.progress).toBe(50);
  });

  test("should update current_step when provided", async () => {
    await seedTask(makeTask({ id: "t1", current_step: 0 }));
    const updated = await updateTaskProgress("t1", { progress: 20, current_step: 2 });
    expect(updated!.current_step).toBe(2);
  });

  test("should update a step's status when step_status is provided", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "First", status: "pending" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 0,
      step_status: { step_id: "step_1", status: "in_progress" },
    });
    expect(updated!.steps[0].status).toBe("in_progress");
  });

  test("should set step.started_at when step transitions to in_progress", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "pending" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 0,
      step_status: { step_id: "step_1", status: "in_progress" },
    });
    expect(updated!.steps[0].started_at).toBeDefined();
  });

  test("should set step.completed_at when step transitions to completed", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "in_progress" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 100,
      step_status: { step_id: "step_1", status: "completed" },
    });
    expect(updated!.steps[0].completed_at).toBeDefined();
  });

  test("should set step.completed_at when step transitions to failed", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "in_progress" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 0,
      step_status: { step_id: "step_1", status: "failed", error: "Oops" },
    });
    expect(updated!.steps[0].completed_at).toBeDefined();
  });

  test("should record step output when provided", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "in_progress" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 50,
      step_status: {
        step_id: "step_1",
        status: "completed",
        output: "result data",
      },
    });
    expect(updated!.steps[0].output).toBe("result data");
  });

  test("should record step error when provided", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "in_progress" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 0,
      step_status: {
        step_id: "step_1",
        status: "failed",
        error: "Network error",
      },
    });
    expect(updated!.steps[0].error).toBe("Network error");
  });

  test("should silently ignore step_status when step_id does not match", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        steps: [{ id: "step_1", name: "S", status: "pending" }],
      })
    );
    const updated = await updateTaskProgress("t1", {
      progress: 10,
      step_status: { step_id: "step_99", status: "completed" },
    });
    // step_1 should remain unchanged
    expect(updated!.steps[0].status).toBe("pending");
  });

  test("should return null when task does not exist", async () => {
    const result = await updateTaskProgress("nonexistent", { progress: 50 });
    expect(result).toBeNull();
  });
});

// ===========================================================================
// setTaskResult
// ===========================================================================

describe("setTaskResult()", () => {
  test("should set result_file on the task", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const updated = await setTaskResult("t1", "/data/results/t1.md");
    expect(updated!.result_file).toBe("/data/results/t1.md");
  });

  test("should set result_summary when provided", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const updated = await setTaskResult("t1", "/data/results/t1.md", "All done");
    expect(updated!.result_summary).toBe("All done");
  });

  test("should leave result_summary undefined when not supplied", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const updated = await setTaskResult("t1", "/data/results/t1.md");
    expect(updated!.result_summary).toBeUndefined();
  });

  test("should return null when task does not exist", async () => {
    const result = await setTaskResult("nonexistent", "/file.md");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// loadQueue / saveQueue
// ===========================================================================

describe("loadQueue()", () => {
  test("should return a default queue when no queue file exists", async () => {
    const queue = await loadQueue();
    expect(queue.active).toEqual([]);
    expect(queue.pending).toEqual([]);
    expect(queue.settings.max_concurrent_tasks).toBe(2);
    expect(queue.settings.default_priority).toBe("normal");
    expect(queue.settings.paused).toBe(false);
  });

  test("should parse and return an existing queue file", async () => {
    seedQueue({
      active: [{ task_id: "t1", priority: "high" }],
      pending: [],
    });
    const queue = await loadQueue();
    expect(queue.active).toHaveLength(1);
    expect(queue.active[0].task_id).toBe("t1");
  });
});

describe("saveQueue()", () => {
  test("should persist the queue and set updated_at", async () => {
    const q = {
      updated_at: "",
      active: [] as any[],
      pending: [] as any[],
      settings: {
        max_concurrent_tasks: 3,
        default_priority: "normal" as const,
        default_timeout_minutes: 30,
        paused: false,
      },
    };
    await saveQueue(q);
    const loaded = await loadQueue();
    expect(loaded.settings.max_concurrent_tasks).toBe(3);
    expect(loaded.updated_at).not.toBe("");
  });
});

// ===========================================================================
// getQueueSettings / updateQueueSettings
// ===========================================================================

describe("getQueueSettings()", () => {
  test("should return the queue settings", async () => {
    seedQueue({
      settings: {
        max_concurrent_tasks: 4,
        default_priority: "urgent",
        default_timeout_minutes: 60,
        paused: true,
      },
    });
    const settings = await getQueueSettings();
    expect(settings.max_concurrent_tasks).toBe(4);
    expect(settings.default_priority).toBe("urgent");
    expect(settings.paused).toBe(true);
  });
});

describe("updateQueueSettings()", () => {
  test("should merge partial updates into existing settings", async () => {
    seedQueue();
    const updated = await updateQueueSettings({ max_concurrent_tasks: 5 });
    expect(updated.max_concurrent_tasks).toBe(5);
    // Other settings remain unchanged
    expect(updated.default_priority).toBe("normal");
  });

  test("should persist the updated settings", async () => {
    seedQueue();
    await updateQueueSettings({ paused: true });
    const settings = await getQueueSettings();
    expect(settings.paused).toBe(true);
  });
});

// ===========================================================================
// enqueueTask
// ===========================================================================

describe("enqueueTask()", () => {
  test("should add the task to the pending queue", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending", priority: "normal" }));
    seedQueue();
    await enqueueTask("t1");
    const queue = await loadQueue();
    expect(queue.pending.some((e: any) => e.task_id === "t1")).toBe(true);
  });

  test("should update the task status to queued", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending", priority: "normal" }));
    seedQueue();
    await enqueueTask("t1");
    const task = await getTask("t1");
    expect(task!.status).toBe("queued");
  });

  test("should use the supplied priority override", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending", priority: "low" }));
    seedQueue();
    await enqueueTask("t1", "urgent");
    const queue = await loadQueue();
    const entry = queue.pending.find((e: any) => e.task_id === "t1");
    expect(entry!.priority).toBe("urgent");
  });

  test("should throw an error when the task does not exist", async () => {
    seedQueue();
    await expect(enqueueTask("nonexistent")).rejects.toThrow("not found");
  });

  test("should not add the task twice when it is already in the pending queue", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued", priority: "normal" }));
    seedQueue({ pending: [{ task_id: "t1", priority: "normal" }] });
    await enqueueTask("t1");
    const queue = await loadQueue();
    const entries = queue.pending.filter((e: any) => e.task_id === "t1");
    expect(entries).toHaveLength(1);
  });

  test("should not add the task when it is already in the active queue", async () => {
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", priority: "normal" })
    );
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await enqueueTask("t1");
    const queue = await loadQueue();
    const inPending = queue.pending.some((e: any) => e.task_id === "t1");
    expect(inPending).toBe(false);
  });

  test("should sort pending queue by priority (urgent first)", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending", priority: "low" }));
    await seedTask(makeTask({ id: "t2", status: "pending", priority: "urgent" }));
    seedQueue();
    await enqueueTask("t1");
    await enqueueTask("t2");
    const queue = await loadQueue();
    expect(queue.pending[0].task_id).toBe("t2");
    expect(queue.pending[1].task_id).toBe("t1");
  });
});

// ===========================================================================
// dequeueNextTask
// ===========================================================================

describe("dequeueNextTask()", () => {
  test("should return the highest-priority pending task and move it to active", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued", priority: "normal" }));
    seedQueue({
      pending: [
        {
          task_id: "t1",
          priority: "normal",
          queued_at: new Date().toISOString(),
        },
      ],
      active: [],
    });
    const task = await dequeueNextTask();
    expect(task).not.toBeNull();
    expect(task!.id).toBe("t1");
    expect(task!.status).toBe("in_progress");
  });

  test("should move the task from pending to active in the queue", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued", priority: "normal" }));
    seedQueue({
      pending: [
        {
          task_id: "t1",
          priority: "normal",
          queued_at: new Date().toISOString(),
        },
      ],
      active: [],
    });
    await dequeueNextTask();
    const queue = await loadQueue();
    expect(queue.active.some((e: any) => e.task_id === "t1")).toBe(true);
    expect(queue.pending.some((e: any) => e.task_id === "t1")).toBe(false);
  });

  test("should return null when the queue is paused", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued" }));
    seedQueue({
      pending: [{ task_id: "t1", priority: "normal" }],
      settings: {
        max_concurrent_tasks: 2,
        default_priority: "normal",
        default_timeout_minutes: 30,
        paused: true,
      },
    });
    const task = await dequeueNextTask();
    expect(task).toBeNull();
  });

  test("should return null when max_concurrent_tasks is already reached", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued" }));
    seedQueue({
      active: [
        { task_id: "running1", priority: "normal" },
        { task_id: "running2", priority: "normal" },
      ],
      pending: [{ task_id: "t1", priority: "normal" }],
      settings: {
        max_concurrent_tasks: 2,
        default_priority: "normal",
        default_timeout_minutes: 30,
        paused: false,
      },
    });
    const task = await dequeueNextTask();
    expect(task).toBeNull();
  });

  test("should return null when pending queue is empty", async () => {
    seedQueue({ active: [], pending: [] });
    const task = await dequeueNextTask();
    expect(task).toBeNull();
  });

  test("should set task started_at timestamp", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued" }));
    seedQueue({
      pending: [
        {
          task_id: "t1",
          priority: "normal",
          queued_at: new Date().toISOString(),
        },
      ],
      active: [],
    });
    const before = new Date().toISOString();
    const task = await dequeueNextTask();
    const after = new Date().toISOString();
    expect(task!.started_at! >= before).toBe(true);
    expect(task!.started_at! <= after).toBe(true);
  });
});

// ===========================================================================
// removeFromQueue
// ===========================================================================

describe("removeFromQueue()", () => {
  test("should remove a task from active queue", async () => {
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await removeFromQueue("t1");
    const queue = await loadQueue();
    expect(queue.active.some((e: any) => e.task_id === "t1")).toBe(false);
  });

  test("should remove a task from pending queue", async () => {
    seedQueue({
      active: [],
      pending: [{ task_id: "t1", priority: "normal" }],
    });
    await removeFromQueue("t1");
    const queue = await loadQueue();
    expect(queue.pending.some((e: any) => e.task_id === "t1")).toBe(false);
  });

  test("should not throw when task is not in queue", async () => {
    seedQueue();
    await expect(removeFromQueue("nonexistent")).resolves.toBeUndefined();
  });
});

// ===========================================================================
// getQueueStatus
// ===========================================================================

describe("getQueueStatus()", () => {
  test("should report active_count and pending_count", async () => {
    await seedTask(makeTask({ id: "t1", title: "Active Task", progress: 50 }));
    await seedTask(
      makeTask({ id: "t2", title: "Pending Task", priority: "high" })
    );
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [{ task_id: "t2", priority: "high" }],
      settings: {
        max_concurrent_tasks: 2,
        default_priority: "normal",
        default_timeout_minutes: 30,
        paused: false,
      },
    });
    const status = await getQueueStatus();
    expect(status.active_count).toBe(1);
    expect(status.pending_count).toBe(1);
  });

  test("should include task details in active_tasks", async () => {
    await seedTask(makeTask({ id: "t1", title: "Running", progress: 30 }));
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    const status = await getQueueStatus();
    expect(status.active_tasks).toHaveLength(1);
    expect(status.active_tasks[0].id).toBe("t1");
    expect(status.active_tasks[0].title).toBe("Running");
    expect(status.active_tasks[0].progress).toBe(30);
  });

  test("should include task details in pending_tasks", async () => {
    await seedTask(makeTask({ id: "t2", title: "Waiting", priority: "high" }));
    seedQueue({
      active: [],
      pending: [{ task_id: "t2", priority: "high" }],
    });
    const status = await getQueueStatus();
    expect(status.pending_tasks).toHaveLength(1);
    expect(status.pending_tasks[0].id).toBe("t2");
    expect(status.pending_tasks[0].priority).toBe("high");
  });

  test("should reflect paused flag from settings", async () => {
    seedQueue({
      settings: {
        max_concurrent_tasks: 2,
        default_priority: "normal",
        default_timeout_minutes: 30,
        paused: true,
      },
    });
    const status = await getQueueStatus();
    expect(status.paused).toBe(true);
  });

  test("should reflect max_concurrent from settings", async () => {
    seedQueue({
      settings: {
        max_concurrent_tasks: 5,
        default_priority: "normal",
        default_timeout_minutes: 30,
        paused: false,
      },
    });
    const status = await getQueueStatus();
    expect(status.max_concurrent).toBe(5);
  });

  test("should return empty arrays when queue is empty", async () => {
    seedQueue();
    const status = await getQueueStatus();
    expect(status.active_tasks).toEqual([]);
    expect(status.pending_tasks).toEqual([]);
    expect(status.active_count).toBe(0);
    expect(status.pending_count).toBe(0);
  });
});

// ===========================================================================
// cancelTask
// ===========================================================================

describe("cancelTask()", () => {
  test("should set task status to cancelled", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    seedQueue();
    const task = await cancelTask("t1");
    expect(task!.status).toBe("cancelled");
  });

  test("should set completed_at on cancellation", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    seedQueue();
    const task = await cancelTask("t1");
    expect(task!.completed_at).toBeDefined();
  });

  test("should remove the task from the queue on cancellation", async () => {
    await seedTask(makeTask({ id: "t1", status: "queued", priority: "normal" }));
    seedQueue({
      active: [],
      pending: [{ task_id: "t1", priority: "normal" }],
    });
    await cancelTask("t1");
    const queue = await loadQueue();
    expect(queue.pending.some((e: any) => e.task_id === "t1")).toBe(false);
  });

  test("should return task unchanged when already completed", async () => {
    await seedTask(makeTask({ id: "t1", status: "completed" }));
    seedQueue();
    const task = await cancelTask("t1");
    expect(task!.status).toBe("completed");
  });

  test("should return task unchanged when already failed", async () => {
    await seedTask(makeTask({ id: "t1", status: "failed" }));
    seedQueue();
    const task = await cancelTask("t1");
    expect(task!.status).toBe("failed");
  });

  test("should return task unchanged when already cancelled", async () => {
    await seedTask(makeTask({ id: "t1", status: "cancelled" }));
    seedQueue();
    const task = await cancelTask("t1");
    expect(task!.status).toBe("cancelled");
  });

  test("should return null when task does not exist", async () => {
    seedQueue();
    const result = await cancelTask("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// pauseTask
// ===========================================================================

describe("pauseTask()", () => {
  test("should pause an in_progress task", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    const task = await pauseTask("t1");
    expect(task!.status).toBe("paused");
  });

  test("should return task unchanged when not in_progress", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    const task = await pauseTask("t1");
    expect(task!.status).toBe("pending");
  });

  test("should return null when task does not exist", async () => {
    const result = await pauseTask("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// resumeTask
// ===========================================================================

describe("resumeTask()", () => {
  test("should resume a paused task to in_progress", async () => {
    await seedTask(makeTask({ id: "t1", status: "paused" }));
    const task = await resumeTask("t1");
    expect(task!.status).toBe("in_progress");
  });

  test("should return task unchanged when not paused", async () => {
    await seedTask(makeTask({ id: "t1", status: "pending" }));
    const task = await resumeTask("t1");
    expect(task!.status).toBe("pending");
  });

  test("should return null when task does not exist", async () => {
    const result = await resumeTask("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// retryTask
// ===========================================================================

describe("retryTask()", () => {
  test("should reset a failed task back to pending and re-enqueue it", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "failed",
        priority: "normal",
        progress: 80,
        error: "some error",
        retry_count: 0,
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.status).toBe("pending");
    expect(task!.progress).toBe(0);
    expect(task!.error).toBeUndefined();
  });

  test("should increment retry_count", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "failed",
        priority: "normal",
        retry_count: 1,
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
          max_retries: 3,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.retry_count).toBe(2);
  });

  test("should reset current_step, started_at, completed_at, and result fields", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "failed",
        priority: "normal",
        current_step: 3,
        started_at: "2026-01-01T00:00:00.000Z",
        completed_at: "2026-01-01T01:00:00.000Z",
        result_file: "/results/t1.md",
        result_summary: "partial",
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.current_step).toBe(0);
    expect(task!.started_at).toBeUndefined();
    expect(task!.completed_at).toBeUndefined();
    expect(task!.result_file).toBeUndefined();
    expect(task!.result_summary).toBeUndefined();
  });

  test("should reset all step statuses to pending", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "failed",
        priority: "normal",
        steps: [
          { id: "step_1", name: "S1", status: "completed" },
          { id: "step_2", name: "S2", status: "failed" },
        ],
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.steps[0].status).toBe("pending");
    expect(task!.steps[1].status).toBe("pending");
  });

  test("should return task unchanged when not failed or cancelled", async () => {
    await seedTask(makeTask({ id: "t1", status: "in_progress" }));
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.status).toBe("in_progress");
  });

  test("should return task unchanged when max retries are exceeded", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "failed",
        retry_count: 3,
        priority: "normal",
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
          max_retries: 3,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.status).toBe("failed");
  });

  test("should also work for cancelled tasks", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        status: "cancelled",
        priority: "normal",
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
        },
      })
    );
    seedQueue();
    const task = await retryTask("t1");
    expect(task!.status).toBe("pending");
  });

  test("should return null when task does not exist", async () => {
    seedQueue();
    const result = await retryTask("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// scheduleRetry
// ===========================================================================

describe("scheduleRetry()", () => {
  test("should return false when task does not exist", async () => {
    const result = await scheduleRetry("nonexistent", "error");
    expect(result).toBe(false);
  });

  test("should return false when auto_retry_on_failure is disabled", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: false,
        },
      })
    );
    const result = await scheduleRetry("t1", "some error");
    expect(result).toBe(false);
  });

  test("should return false when max retries have been reached", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        retry_count: 3,
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: true,
          max_retries: 3,
        },
      })
    );
    const result = await scheduleRetry("t1", "some error");
    expect(result).toBe(false);
  });

  test("should return true and schedule a retry when conditions are met", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        retry_count: 0,
        config: {
          max_iterations: 50,
          timeout_minutes: 30,
          notify_on_complete: true,
          auto_retry_on_failure: true,
          max_retries: 3,
        },
      })
    );
    const result = await scheduleRetry("t1", "transient error");
    expect(result).toBe(true);
  });
});

// ===========================================================================
// getScheduledTasks / checkScheduledTasks
// ===========================================================================

describe("getScheduledTasks()", () => {
  test("should return only tasks with schedule.enabled = true", async () => {
    await seedTask(
      makeTask({
        id: "t1",
        schedule: { enabled: true, run_at: "2026-03-01T10:00:00.000Z" },
      })
    );
    await seedTask(makeTask({ id: "t2", schedule: { enabled: false } }));
    await seedTask(makeTask({ id: "t3" }));
    const tasks = await getScheduledTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("t1");
  });

  test("should return an empty array when no scheduled tasks exist", async () => {
    await seedTask(makeTask({ id: "t1" }));
    const tasks = await getScheduledTasks();
    expect(tasks).toEqual([]);
  });
});

describe("checkScheduledTasks()", () => {
  test("should return a task whose run_at is in the past and status is pending", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    await seedTask(
      makeTask({
        id: "t1",
        status: "pending",
        schedule: { enabled: true, run_at: pastDate },
      })
    );
    const tasks = await checkScheduledTasks();
    expect(tasks.some((t) => t.id === "t1")).toBe(true);
  });

  test("should not return a task whose run_at is in the future", async () => {
    const futureDate = new Date(Date.now() + 60_000 * 60).toISOString();
    await seedTask(
      makeTask({
        id: "t1",
        status: "pending",
        schedule: { enabled: true, run_at: futureDate },
      })
    );
    const tasks = await checkScheduledTasks();
    expect(tasks.some((t) => t.id === "t1")).toBe(false);
  });

  test("should not return a scheduled task that is not in pending status", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    await seedTask(
      makeTask({
        id: "t1",
        status: "completed",
        schedule: { enabled: true, run_at: pastDate },
      })
    );
    const tasks = await checkScheduledTasks();
    expect(tasks.some((t) => t.id === "t1")).toBe(false);
  });
});

// ===========================================================================
// cleanupOldTasks
// ===========================================================================

describe("cleanupOldTasks()", () => {
  test("should delete completed tasks older than the threshold", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await seedTask(makeTask({ id: "t1", status: "completed", completed_at: oldDate }));
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(1);
    expect(await getTask("t1")).toBeNull();
  });

  test("should delete failed tasks older than the threshold", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await seedTask(makeTask({ id: "t1", status: "failed", completed_at: oldDate }));
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(1);
  });

  test("should delete cancelled tasks older than the threshold", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await seedTask(
      makeTask({ id: "t1", status: "cancelled", completed_at: oldDate })
    );
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(1);
  });

  test("should not delete completed tasks newer than the threshold", async () => {
    const recentDate = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    await seedTask(
      makeTask({ id: "t1", status: "completed", completed_at: recentDate })
    );
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(0);
    expect(await getTask("t1")).not.toBeNull();
  });

  test("should not delete pending tasks regardless of age", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await seedTask(
      makeTask({
        id: "t1",
        status: "pending",
        created_at: oldDate,
        completed_at: undefined,
      })
    );
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(0);
  });

  test("should use created_at as fallback when completed_at is absent", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await seedTask(
      makeTask({
        id: "t1",
        status: "completed",
        created_at: oldDate,
        completed_at: undefined,
      })
    );
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(1);
  });

  test("should return 0 when there are no tasks to clean up", async () => {
    const deleted = await cleanupOldTasks(30);
    expect(deleted).toBe(0);
  });
});

// ===========================================================================
// recoverTasks
// ===========================================================================

describe("recoverTasks()", () => {
  test("should re-queue active tasks that were interrupted", async () => {
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", priority: "normal" })
    );
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    const result = await recoverTasks();
    expect(result.recovered).toBe(1);
    expect(result.failed).toBe(0);
  });

  test("should set recovered task status to queued", async () => {
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", priority: "normal" })
    );
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await recoverTasks();
    const task = await getTask("t1");
    expect(task!.status).toBe("queued");
  });

  test("should clear the active queue after recovery", async () => {
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", priority: "normal" })
    );
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [],
    });
    await recoverTasks();
    const queue = await loadQueue();
    expect(queue.active).toHaveLength(0);
  });

  test("should move recovered task into the pending queue", async () => {
    await seedTask(
      makeTask({ id: "t1", status: "in_progress", priority: "normal" })
    );
    await seedTask(makeTask({ id: "t2", status: "queued", priority: "normal" }));
    seedQueue({
      active: [{ task_id: "t1", priority: "normal" }],
      pending: [{ task_id: "t2", priority: "normal" }],
    });
    await recoverTasks();
    const queue = await loadQueue();
    const ids = queue.pending.map((e: any) => e.task_id);
    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
  });

  test("should count missing tasks as failed", async () => {
    // active references a task that no longer exists in the task store
    seedQueue({
      active: [{ task_id: "ghost-task", priority: "normal" }],
      pending: [],
    });
    const result = await recoverTasks();
    expect(result.failed).toBe(1);
    expect(result.recovered).toBe(0);
  });

  test("should return zeros when active queue is already empty", async () => {
    seedQueue({ active: [], pending: [] });
    const result = await recoverTasks();
    expect(result.recovered).toBe(0);
    expect(result.failed).toBe(0);
  });
});

// ===========================================================================
// withQueueLock
// ===========================================================================

describe("withQueueLock()", () => {
  test("should return the result of the provided function", async () => {
    const result = await withQueueLock(async () => 42);
    expect(result).toBe(42);
  });

  test("should propagate errors thrown inside the lock", async () => {
    await expect(
      withQueueLock(async () => {
        throw new Error("inside lock error");
      })
    ).rejects.toThrow("inside lock error");
  });

  test("should execute callbacks serially when called concurrently", async () => {
    const order: number[] = [];
    const p1 = withQueueLock(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 10));
      order.push(2);
    });
    const p2 = withQueueLock(async () => {
      order.push(3);
    });
    await Promise.all([p1, p2]);
    // p1 must complete (1, 2) before p2 starts (3)
    expect(order).toEqual([1, 2, 3]);
  });
});
