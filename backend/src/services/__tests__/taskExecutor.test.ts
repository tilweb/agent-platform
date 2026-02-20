/**
 * Tests for the Task Executor Service (backend/src/services/taskExecutor.ts)
 *
 * All external dependencies (taskService, routes/tasks, agents/loop, memory,
 * notificationService, fs/promises, fs, paths) are mocked so no real I/O or
 * network calls occur.  Mocks must be declared BEFORE the dynamic import of
 * the module under test.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Written files: path -> JSON string
  files: {} as Record<string, string>,
  // Controls whether mkdir throws
  mkdirShouldThrow: false,
  // Controls existsSync result for RESULTS_DIR
  resultsDirExists: true,

  // taskService mock state
  queueSettings: {
    max_concurrent_tasks: 5,
    default_priority: "normal" as const,
    default_timeout_minutes: 30,
    paused: false,
  },
  dequeuedTask: null as any,
  updatedStatuses: [] as Array<{ taskId: string; status: string }>,
  scheduledRetryTaskId: null as string | null,
  scheduleRetryShouldReturn: false,

  // routes/tasks mock state
  broadcastCalls: [] as Array<{ taskId: string; event: string; data: any }>,
  notifyStartedIds: [] as string[],
  notifyProgressCalls: [] as Array<{ taskId: string; progress: any }>,
  notifyCompletedCalls: [] as Array<{ taskId: string; resultFile: string; summary: string }>,
  notifyFailedCalls: [] as Array<{ taskId: string; error: string }>,

  // agents/loop mock state
  // – events yielded per execution
  agentEvents: [] as any[],
  // – if set, runAgentLoop throws this error
  agentLoopShouldThrow: false,
  agentLoopError: new Error("agent error"),
  // – last prompt received by the mock loop
  capturedPrompt: "" as string,

  // memory mock state
  sessionIdCounter: 0,
  addedMessages: [] as Array<{ sessionId: string; message: any }>,
  saveConversationCalls: [] as string[],
  saveChatHistoryCalls: [] as string[],
  chatOwnerMap: {} as Record<string, string | null>,

  // notificationService mock state
  notifyCompletedServiceCalls: [] as Array<{ userId: string; task: any }>,
  notifyFailedServiceCalls: [] as Array<{ userId: string; task: any; error: string }>,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE the dynamic import of the module
// ---------------------------------------------------------------------------

// Provide all path constants so any transitive consumer of utils/paths works.
const TEST_DATA_ROOT = "/tmp/test-task-executor";
mock.module("../../utils/paths", () => ({
  DATA_DIR: TEST_DATA_ROOT,
  AUTH_DIR: `${TEST_DATA_ROOT}/auth`,
  USERS_DIR: `${TEST_DATA_ROOT}/auth/users`,
  SESSIONS_DIR: `${TEST_DATA_ROOT}/auth/sessions`,
  GROUPS_DIR: `${TEST_DATA_ROOT}/auth/groups`,
  OAUTH_STATES_DIR: `${TEST_DATA_ROOT}/auth/oauth-states`,
  CHATS_DIR: `${TEST_DATA_ROOT}/chats`,
  CONVERSATIONS_DIR: `${TEST_DATA_ROOT}/conversations`,
  CHAT_UPLOADS_DIR: `${TEST_DATA_ROOT}/chat-uploads`,
  CHAT_FOLDERS_FILE: `${TEST_DATA_ROOT}/chats/chat-folders.yaml`,
  CONFIG_DIR: `${TEST_DATA_ROOT}/config`,
  PROVIDERS_CONFIG: `${TEST_DATA_ROOT}/config/providers.yaml`,
  AGENTS_CONFIG: `${TEST_DATA_ROOT}/config/agents.md`,
  MCP_SERVERS_CONFIG: `${TEST_DATA_ROOT}/config/mcp-servers.yaml`,
  AGENTS_DIR: `${TEST_DATA_ROOT}/agents`,
  KB_BASE: `${TEST_DATA_ROOT}/knowledge-base`,
  KB_COLLECTIONS_FILE: `${TEST_DATA_ROOT}/knowledge-base/collections.yaml`,
  KB_INCOMING_DIR: `${TEST_DATA_ROOT}/knowledge-base/incoming`,
  TASKS_DIR: `${TEST_DATA_ROOT}/tasks`,
  TASK_RESULTS_DIR: `${TEST_DATA_ROOT}/tasks/results`,
  GENERATED_IMAGES_DIR: `${TEST_DATA_ROOT}/generated-images`,
  EXPORTS_DIR: `${TEST_DATA_ROOT}/exports`,
  MEMORY_SESSIONS_DIR: `${TEST_DATA_ROOT}/memory/sessions`,
  MEMORY_USERS_DIR: `${TEST_DATA_ROOT}/memory/users`,
  SPACES_DIR: `${TEST_DATA_ROOT}/spaces`,
  TABLES_DIR: `${TEST_DATA_ROOT}/tables`,
  CONNECTIONS_DIR: `${TEST_DATA_ROOT}/connections`,
  SKILLS_DIR: `${TEST_DATA_ROOT}/skills`,
  PLUGINS_DIR: `${TEST_DATA_ROOT}/plugins`,
  PLUGINS_CONFIGS_DIR: `${TEST_DATA_ROOT}/config/plugins`,
  PLUGINS_INSTALLED_DIR: `${TEST_DATA_ROOT}/plugins/installed`,
  PLUGINS_REGISTRY_FILE: `${TEST_DATA_ROOT}/plugins/registry.yaml`,
  CUSTOM_TOOLS_DIR: `${TEST_DATA_ROOT}/tools/custom`,
  APPS_DIR: `${TEST_DATA_ROOT}/apps`,
  APPS_REGISTRY: `${TEST_DATA_ROOT}/apps/registry.yaml`,
  USAGE_DIR: `${TEST_DATA_ROOT}/usage`,
  AUDIT_DIR: `${TEST_DATA_ROOT}/audit`,
  NOTIFICATIONS_DIR: `${TEST_DATA_ROOT}/notifications`,
  TEMP_DIR: `${TEST_DATA_ROOT}/temp`,
  MARKITDOWN_API_URL: "",
  MARKITDOWN_API_KEY: "",
}));

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string) => {
    if (mockState.mkdirShouldThrow) throw new Error("writeFile failed");
    mockState.files[path] = content;
  },
  mkdir: async (_path: string, _opts?: any) => {
    if (mockState.mkdirShouldThrow) throw new Error("mkdir failed");
  },
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(`ENOENT: ${path}`);
    err.code = "ENOENT";
    throw err;
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    if (path.includes("results")) return mockState.resultsDirExists;
    return mockState.files[path] !== undefined;
  },
}));

mock.module("path", () => ({
  resolve: (...parts: string[]) => parts.filter(Boolean).join("/"),
  join: (...parts: string[]) => parts.filter(Boolean).join("/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
  basename: (p: string) => p.split("/").pop() || "",
}));

mock.module("../taskService", () => ({
  getQueueSettings: async () => ({ ...mockState.queueSettings }),
  dequeueNextTask: async () => {
    const t = mockState.dequeuedTask;
    mockState.dequeuedTask = null; // consume once
    return t;
  },
  updateTaskStatus: async (taskId: string, status: string) => {
    mockState.updatedStatuses.push({ taskId, status });
  },
  updateTaskProgress: async (_taskId: string, _progress: number) => {},
  setTaskResult: async (_taskId: string, _result: any) => {},
  scheduleRetry: async (taskId: string, _error: string) => {
    mockState.scheduledRetryTaskId = taskId;
    return mockState.scheduleRetryShouldReturn;
  },
}));

mock.module("../../routes/tasks", () => ({
  broadcastTaskUpdate: (taskId: string, event: string, data: any) => {
    mockState.broadcastCalls.push({ taskId, event, data });
  },
  notifyTaskStarted: async (taskId: string) => {
    mockState.notifyStartedIds.push(taskId);
  },
  notifyTaskProgress: async (taskId: string, progress: any) => {
    mockState.notifyProgressCalls.push({ taskId, progress });
  },
  notifyTaskCompleted: async (taskId: string, resultFile: string, summary: string) => {
    mockState.notifyCompletedCalls.push({ taskId, resultFile, summary });
  },
  notifyTaskFailed: async (taskId: string, error: string) => {
    mockState.notifyFailedCalls.push({ taskId, error });
  },
}));

// The agents/loop mock captures the prompt and yields agentEvents from mockState.
// This single declaration is used by all test suites — no per-test re-mocking needed.
mock.module("../../agents/loop", () => ({
  runAgentLoop: async function* (_sessionId: string, prompt: string, _opts: any) {
    mockState.capturedPrompt = prompt;
    if (mockState.agentLoopShouldThrow) throw mockState.agentLoopError;
    for (const event of mockState.agentEvents) yield event;
  },
}));

mock.module("../memory", () => ({
  generateSessionId: () => `session-${++mockState.sessionIdCounter}`,
  addMessage: (sessionId: string, message: any) => {
    mockState.addedMessages.push({ sessionId, message });
  },
  saveConversation: async (sessionId: string) => {
    mockState.saveConversationCalls.push(sessionId);
  },
  saveChatHistory: async (sessionId: string) => {
    mockState.saveChatHistoryCalls.push(sessionId);
  },
  getChatOwnerId: async (sessionId: string) => {
    return mockState.chatOwnerMap[sessionId] ?? null;
  },
}));

mock.module("../notificationService", () => ({
  notificationService: {
    notifyTaskCompleted: async (userId: string, task: any) => {
      mockState.notifyCompletedServiceCalls.push({ userId, task });
    },
    notifyTaskFailed: async (userId: string, task: any, error: string) => {
      mockState.notifyFailedServiceCalls.push({ userId, task, error });
    },
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  startExecutor,
  stopExecutor,
  isExecutorRunning,
  getActiveTaskCount,
  cancelRunningTask,
  getRunningTaskStatus,
} = await import("../taskExecutor");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid Task object */
function makeTask(overrides: Partial<any> = {}): any {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Do something useful",
    type: "simple" as const,
    priority: "normal" as const,
    created_by: "user" as const,
    trigger: "manual",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "queued" as const,
    progress: 0,
    current_step: 0,
    total_steps: 0,
    steps: [],
    config: {
      max_iterations: 5,
      timeout_minutes: 30,
      notify_on_complete: false,
      auto_retry_on_failure: false,
    },
    ...overrides,
  };
}

/** Wait for async task processing to settle */
async function flushAsync(ms = 80): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Reset every field in mockState back to clean defaults */
function resetMockState() {
  mockState.files = {};
  mockState.mkdirShouldThrow = false;
  mockState.resultsDirExists = true;
  mockState.queueSettings = {
    max_concurrent_tasks: 5,
    default_priority: "normal",
    default_timeout_minutes: 30,
    paused: false,
  };
  mockState.dequeuedTask = null;
  mockState.updatedStatuses = [];
  mockState.scheduledRetryTaskId = null;
  mockState.scheduleRetryShouldReturn = false;
  mockState.broadcastCalls = [];
  mockState.notifyStartedIds = [];
  mockState.notifyProgressCalls = [];
  mockState.notifyCompletedCalls = [];
  mockState.notifyFailedCalls = [];
  mockState.agentEvents = [];
  mockState.agentLoopShouldThrow = false;
  mockState.agentLoopError = new Error("agent error");
  mockState.capturedPrompt = "";
  mockState.sessionIdCounter = 0;
  mockState.addedMessages = [];
  mockState.saveConversationCalls = [];
  mockState.saveChatHistoryCalls = [];
  mockState.chatOwnerMap = {};
  mockState.notifyCompletedServiceCalls = [];
  mockState.notifyFailedServiceCalls = [];
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("isExecutorRunning()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should return false before the executor has been started", () => {
    expect(isExecutorRunning()).toBe(false);
  });

  test("should return true after startExecutor() is called", async () => {
    await startExecutor();
    expect(isExecutorRunning()).toBe(true);
    stopExecutor();
  });

  test("should return false after stopExecutor() is called", async () => {
    await startExecutor();
    stopExecutor();
    expect(isExecutorRunning()).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("startExecutor()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should transition isRunning to true", async () => {
    await startExecutor();
    expect(isExecutorRunning()).toBe(true);
    stopExecutor();
  });

  test("should be idempotent when called twice", async () => {
    await startExecutor();
    await startExecutor(); // second call should be a no-op
    expect(isExecutorRunning()).toBe(true);
    stopExecutor();
  });

  test("should not throw when results directory already exists", async () => {
    mockState.resultsDirExists = true;
    await expect(startExecutor()).resolves.toBeUndefined();
    stopExecutor();
  });

  test("should create results directory when it does not exist", async () => {
    mockState.resultsDirExists = false;
    await expect(startExecutor()).resolves.toBeUndefined();
    stopExecutor();
  });
});

// ---------------------------------------------------------------------------

describe("stopExecutor()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should be a no-op when executor is not running", () => {
    expect(() => stopExecutor()).not.toThrow();
    expect(isExecutorRunning()).toBe(false);
  });

  test("should stop a running executor", async () => {
    await startExecutor();
    stopExecutor();
    expect(isExecutorRunning()).toBe(false);
  });

  test("should be safe to call multiple times when already stopped", () => {
    stopExecutor();
    stopExecutor();
    expect(isExecutorRunning()).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("getActiveTaskCount()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should return 0 when no tasks are executing", () => {
    expect(getActiveTaskCount()).toBe(0);
  });

  test("should return 0 after all tasks complete", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "task-active" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(getActiveTaskCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("cancelRunningTask()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should return false for a task that is not running", () => {
    const result = cancelRunningTask("non-existent-task");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("getRunningTaskStatus()", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should return null for a task that is not running", () => {
    expect(getRunningTaskStatus("unknown-id")).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("task execution — success path", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should call notifyTaskStarted with the task ID", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t1" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyStartedIds).toContain("t1");
  });

  test("should update task status to 'running'", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t2" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const running = mockState.updatedStatuses.find(
      (u) => u.taskId === "t2" && u.status === "running"
    );
    expect(running).toBeDefined();
  });

  test("should call notifyTaskCompleted after successful execution", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t3" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyCompletedCalls.some((c) => c.taskId === "t3")).toBe(true);
  });

  test("should write a result JSON file to the results directory", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "Hello" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t4" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const writtenPaths = Object.keys(mockState.files);
    const resultPath = writtenPaths.find((p) => p.includes("t4-result.json"));
    expect(resultPath).toBeDefined();
    const result = JSON.parse(mockState.files[resultPath!]!);
    expect(result).toHaveProperty("response");
    expect(result).toHaveProperty("toolCalls");
    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("completedAt");
  });

  test("should accumulate response_chunk content in the result file", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "Hello " },
      { type: "response_chunk", content: "World" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t5" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const resultPath = Object.keys(mockState.files).find((p) => p.includes("t5-result.json"));
    expect(resultPath).toBeDefined();
    const result = JSON.parse(mockState.files[resultPath!]!);
    expect(result.response).toBe("Hello World");
  });

  test("should record tool_end events in the result file toolCalls array", async () => {
    mockState.agentEvents = [
      { type: "tool_start", toolName: "search", toolArgs: '{"q":"test"}' },
      { type: "tool_end", toolName: "search", toolArgs: '{"q":"test"}', toolResult: "result data" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t6" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const resultPath = Object.keys(mockState.files).find((p) => p.includes("t6-result.json"));
    expect(resultPath).toBeDefined();
    const result = JSON.parse(mockState.files[resultPath!]!);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("search");
    expect(result.toolCalls[0].result).toBe("result data");
  });

  test("should emit broadcast events for thinking", async () => {
    mockState.agentEvents = [
      { type: "thinking" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t7" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const thinkingCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t7" && c.event === "thinking"
    );
    expect(thinkingCall).toBeDefined();
  });

  test("should emit broadcast events for response_chunk", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "partial output" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t8" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const responseCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t8" && c.event === "response"
    );
    expect(responseCall).toBeDefined();
    expect(responseCall!.data.content).toBe("partial output");
  });

  test("should emit broadcast events for tool_start", async () => {
    mockState.agentEvents = [
      { type: "tool_start", toolName: "calculator", toolArgs: '{"a":1}' },
      { type: "tool_end", toolName: "calculator", toolArgs: '{"a":1}', toolResult: "42" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t9" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const toolStartCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t9" && c.event === "tool_start"
    );
    expect(toolStartCall).toBeDefined();
    expect(toolStartCall!.data.tool).toBe("calculator");
  });

  test("should emit broadcast events for tool_end", async () => {
    mockState.agentEvents = [
      { type: "tool_end", toolName: "calc", toolArgs: "{}", toolResult: "42" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t10" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const toolEndCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t10" && c.event === "tool_end"
    );
    expect(toolEndCall).toBeDefined();
  });

  test("should emit broadcast events for delegation_start", async () => {
    mockState.agentEvents = [
      { type: "delegation_start", agentId: "sub-agent", task: "sub-task" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t11" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const delegationCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t11" && c.event === "delegation_start"
    );
    expect(delegationCall).toBeDefined();
    expect(delegationCall!.data.agent).toBe("sub-agent");
  });

  test("should emit broadcast events for delegation_end", async () => {
    mockState.agentEvents = [
      { type: "delegation_end", agentId: "sub-agent", toolResult: "ok" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t12" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const delegationEndCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t12" && c.event === "delegation_end"
    );
    expect(delegationEndCall).toBeDefined();
  });

  test("should emit broadcast events for skill_activated", async () => {
    mockState.agentEvents = [
      { type: "skill_activated", skillId: "sk1", skillName: "Search Skill" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t13" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const skillCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t13" && c.event === "skill_activated"
    );
    expect(skillCall).toBeDefined();
    expect(skillCall!.data.skillId).toBe("sk1");
    expect(skillCall!.data.skillName).toBe("Search Skill");
  });

  test("should emit progress via notifyTaskProgress on workflow_step event", async () => {
    mockState.agentEvents = [
      { type: "workflow_step", stepIndex: 0, totalSteps: 4, workflowProgress: 25 },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t14" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const progressCall = mockState.notifyProgressCalls.find((c) => c.taskId === "t14");
    expect(progressCall).toBeDefined();
    expect(progressCall!.progress.progress).toBe(25);
  });

  test("should emit 100% progress on done event", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t15" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const progressCall = mockState.notifyProgressCalls.find(
      (c) => c.taskId === "t15" && c.progress.progress === 100
    );
    expect(progressCall).toBeDefined();
  });

  test("should not emit duplicate progress notifications for unchanged progress", async () => {
    mockState.agentEvents = [
      { type: "workflow_step", stepIndex: 0, totalSteps: 4, workflowProgress: 50 },
      { type: "workflow_step", stepIndex: 0, totalSteps: 4, workflowProgress: 50 }, // duplicate
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t16" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const progressAt50 = mockState.notifyProgressCalls.filter(
      (c) => c.taskId === "t16" && c.progress.progress === 50
    );
    expect(progressAt50).toHaveLength(1);
  });

  test("should post result back to source session when source_session_id is set", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "t17",
      source_session_id: "session-abc",
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const msg = mockState.addedMessages.find((m) => m.sessionId === "session-abc");
    expect(msg).toBeDefined();
    expect(msg!.message.role).toBe("assistant");
    expect(msg!.message.content).toContain("Test Task");
  });

  test("should save conversation after posting result to source session", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "t18",
      source_session_id: "session-xyz",
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.saveConversationCalls).toContain("session-xyz");
  });

  test("should not post to source session when source_session_id is absent", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t19", source_session_id: undefined });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.addedMessages).toHaveLength(0);
  });

  test("should send completion notification when notify_on_complete is true", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "t20",
      source_session_id: "notify-session",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: true,
        auto_retry_on_failure: false,
      },
    });
    mockState.chatOwnerMap["notify-session"] = "user-42";

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const notif = mockState.notifyCompletedServiceCalls.find((c) => c.userId === "user-42");
    expect(notif).toBeDefined();
  });

  test("should not send completion notification when notify_on_complete is false", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "t21",
      source_session_id: "session-no-notify",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: false,
        auto_retry_on_failure: false,
      },
    });
    mockState.chatOwnerMap["session-no-notify"] = "user-99";

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyCompletedServiceCalls).toHaveLength(0);
  });

  test("should use assigned_agent from task when specified", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "t22",
      assigned_agent: "research-agent",
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyCompletedCalls.some((c) => c.taskId === "t22")).toBe(true);
  });

  test("should default to supervisor agent when assigned_agent is absent", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "t23", assigned_agent: undefined });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyCompletedCalls.some((c) => c.taskId === "t23")).toBe(true);
  });

  test("should truncate tool_end result to 500 chars in broadcast data", async () => {
    const longResult = "x".repeat(600);
    mockState.agentEvents = [
      { type: "tool_end", toolName: "bigTool", toolArgs: "{}", toolResult: longResult },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "t24" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const toolEndCall = mockState.broadcastCalls.find(
      (c) => c.taskId === "t24" && c.event === "tool_end"
    );
    expect(toolEndCall).toBeDefined();
    expect(toolEndCall!.data.result.length).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("task execution — failure path", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should call notifyTaskFailed when agent loop throws", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.agentLoopError = new Error("LLM unavailable");
    mockState.dequeuedTask = makeTask({ id: "fail-1" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyFailedCalls.some((c) => c.taskId === "fail-1")).toBe(true);
  });

  test("should include the error message in notifyTaskFailed", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.agentLoopError = new Error("LLM unavailable");
    mockState.dequeuedTask = makeTask({ id: "fail-2" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const failedCall = mockState.notifyFailedCalls.find((c) => c.taskId === "fail-2");
    expect(failedCall!.error).toBe("LLM unavailable");
  });

  test("should call scheduleRetry when agent loop throws", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.dequeuedTask = makeTask({ id: "fail-3" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.scheduledRetryTaskId).toBe("fail-3");
  });

  test("should handle error event from agent loop by calling notifyTaskFailed", async () => {
    mockState.agentEvents = [
      { type: "error", content: "Internal error from agent" },
    ];
    mockState.dequeuedTask = makeTask({ id: "fail-4" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyFailedCalls.some((c) => c.taskId === "fail-4")).toBe(true);
    const failedCall = mockState.notifyFailedCalls.find((c) => c.taskId === "fail-4");
    expect(failedCall!.error).toBe("Internal error from agent");
  });

  test("should broadcast error event to task channel", async () => {
    mockState.agentEvents = [
      { type: "error", content: "Something broke" },
    ];
    mockState.dequeuedTask = makeTask({ id: "fail-5" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const errorBroadcast = mockState.broadcastCalls.find(
      (c) => c.taskId === "fail-5" && c.event === "error"
    );
    expect(errorBroadcast).toBeDefined();
    expect(errorBroadcast!.data.message).toBe("Something broke");
  });

  test("should send failure notification when notify_on_complete is true and task fails", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.agentLoopError = new Error("crash");
    mockState.dequeuedTask = makeTask({
      id: "fail-6",
      source_session_id: "fail-session",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: true,
        auto_retry_on_failure: false,
      },
    });
    mockState.chatOwnerMap["fail-session"] = "user-fail";

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const notif = mockState.notifyFailedServiceCalls.find((c) => c.userId === "user-fail");
    expect(notif).toBeDefined();
    expect(notif!.error).toBe("crash");
  });

  test("should not send failure notification when notify_on_complete is false", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.dequeuedTask = makeTask({
      id: "fail-7",
      source_session_id: "no-notify-session",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: false,
        auto_retry_on_failure: false,
      },
    });
    mockState.chatOwnerMap["no-notify-session"] = "user-x";

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyFailedServiceCalls).toHaveLength(0);
  });

  test("should remove the task from activeTasks after failure", async () => {
    mockState.agentLoopShouldThrow = true;
    mockState.dequeuedTask = makeTask({ id: "fail-8" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(getActiveTaskCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("queue gate — paused and capacity checks", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should not dequeue a task when the queue is paused", async () => {
    mockState.queueSettings.paused = true;
    mockState.dequeuedTask = makeTask({ id: "paused-task" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyStartedIds).not.toContain("paused-task");
  });

  test("should not exceed max_concurrent_tasks capacity of 0", async () => {
    mockState.queueSettings.max_concurrent_tasks = 0;
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "over-capacity" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.notifyStartedIds).not.toContain("over-capacity");
  });
});

// ---------------------------------------------------------------------------

describe("buildTaskPrompt — prompt construction", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should use description as prompt when provided", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "prompt-1",
      title: "My Title",
      description: "Detailed description here",
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.capturedPrompt).toContain("Detailed description here");
  });

  test("should fall back to title when description is empty", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "prompt-2",
      title: "Fallback Title",
      description: "",
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.capturedPrompt).toContain("Fallback Title");
  });

  test("should append steps with title and description to the prompt", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "prompt-3",
      description: "Base task",
      steps: [
        { id: "s1", name: "Step 1", title: "Gather Data", description: "Collect info", status: "pending" },
        { id: "s2", name: "Step 2", title: "Analyze", status: "pending" },
      ],
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.capturedPrompt).toContain("Gather Data");
    expect(mockState.capturedPrompt).toContain("Collect info");
    expect(mockState.capturedPrompt).toContain("Analyze");
  });

  test("should append config.context to the prompt when present", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "prompt-4",
      description: "Do the thing",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: false,
        auto_retry_on_failure: false,
        context: "Use the staging environment",
      },
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.capturedPrompt).toContain("Use the staging environment");
  });

  test("should not include context section when config.context is absent", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({
      id: "prompt-5",
      description: "Simple task",
      config: {
        max_iterations: 5,
        timeout_minutes: 30,
        notify_on_complete: false,
        auto_retry_on_failure: false,
        context: undefined,
      },
    });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    expect(mockState.capturedPrompt).not.toContain("Kontext:");
  });
});

// ---------------------------------------------------------------------------

describe("generateSummary — via notifyTaskCompleted summary argument", () => {
  beforeEach(() => {
    resetMockState();
    stopExecutor();
  });

  test("should truncate response to 200 chars and append ellipsis when longer", async () => {
    const longResponse = "A".repeat(250);
    mockState.agentEvents = [
      { type: "response_chunk", content: longResponse },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "summary-1" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-1");
    expect(completedCall).toBeDefined();
    expect(completedCall!.summary).toContain("...");
    expect(completedCall!.summary.startsWith("A".repeat(200))).toBe(true);
  });

  test("should not append ellipsis when response is 200 chars or shorter", async () => {
    const shortResponse = "B".repeat(100);
    mockState.agentEvents = [
      { type: "response_chunk", content: shortResponse },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "summary-2" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-2");
    expect(completedCall!.summary).not.toContain("...");
  });

  test("should include tool names in summary when tools were used", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "Done" },
      { type: "tool_end", toolName: "search", toolArgs: "{}", toolResult: "found" },
      { type: "tool_end", toolName: "calculator", toolArgs: "{}", toolResult: "42" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "summary-3" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-3");
    expect(completedCall!.summary).toContain("search");
    expect(completedCall!.summary).toContain("calculator");
  });

  test("should deduplicate repeated tool names in summary", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "Done" },
      { type: "tool_end", toolName: "search", toolArgs: "{}", toolResult: "r1" },
      { type: "tool_end", toolName: "search", toolArgs: "{}", toolResult: "r2" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "summary-4" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-4");
    // "search" should appear only once in the deduplicated tools list
    const matches = (completedCall!.summary.match(/search/g) || []).length;
    expect(matches).toBe(1);
  });

  test("should not include Tools section when no tools were used", async () => {
    mockState.agentEvents = [
      { type: "response_chunk", content: "Pure text response" },
      { type: "done" },
    ];
    mockState.dequeuedTask = makeTask({ id: "summary-5" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-5");
    expect(completedCall!.summary).not.toContain("Tools:");
  });

  test("should produce an empty-string summary when response is empty and no tools used", async () => {
    mockState.agentEvents = [{ type: "done" }];
    mockState.dequeuedTask = makeTask({ id: "summary-6" });

    await startExecutor();
    await flushAsync(100);
    stopExecutor();

    const completedCall = mockState.notifyCompletedCalls.find((c) => c.taskId === "summary-6");
    expect(completedCall!.summary).toBe("");
  });
});
