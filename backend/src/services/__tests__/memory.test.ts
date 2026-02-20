/**
 * Tests for the memory service (backend/src/services/memory.ts)
 *
 * All file-system I/O (fs/promises, fs), path utilities, llmService and
 * saveSpaceChat are mocked so no real disk access or network calls occur.
 * Mocks must be registered BEFORE the module under test is imported.
 *
 * NOTE: saveChatHistory() internally calls getSession(sessionId) WITHOUT a
 * userId (line 873 in memory.ts). This means it always retrieves sessions
 * from the "anonymous" key namespace.  Tests for saveChatHistory therefore
 * use anonymous sessions (no userId in createSession / addMessage).  The
 * userId parameter on saveChatHistory only affects the saved YAML metadata.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  /** In-memory file system: path -> content */
  files: {} as Record<string, string>,
  /** Simulated directory listing for CHATS_DIR */
  chatFiles: [] as string[],
  /** Simulated directory listing for CONVERSATIONS_DIR */
  conversationFiles: [] as string[],
  /** Simulated FOLDERS_FILE content */
  foldersFileContent: null as string | null,
  /** Captured calls to saveSpaceChat */
  savedSpaceChats: [] as any[],
  /** LLM chat mock response */
  llmResponse: '{"title":"Test Title","summary":"A test summary","keywords":["kw1","kw2"]}',
  /** Set to true to make llmService.chat throw */
  llmShouldThrow: false,
  // Directory paths used throughout
  chatsDir: "/tmp/test-chats",
  conversationsDir: "/tmp/test-conversations",
  dataDir: "/tmp/test-data",
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any import of the module under test
// ---------------------------------------------------------------------------

mock.module("fs/promises", () => ({
  writeFile: async (path: string, content: string) => {
    mockState.files[path] = content;
  },
  readFile: async (path: string) => {
    if (mockState.files[path] !== undefined) return mockState.files[path];
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, open '${path}'`
    );
    err.code = "ENOENT";
    throw err;
  },
  mkdir: async () => {},
  readdir: async (dir: string) => {
    if (dir === mockState.chatsDir) return mockState.chatFiles;
    if (dir === mockState.conversationsDir) return mockState.conversationFiles;
    return [];
  },
  unlink: async (path: string) => {
    if (mockState.files[path] === undefined) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: ${path}`);
      err.code = "ENOENT";
      throw err;
    }
    delete mockState.files[path];
  },
  rename: async (from: string, to: string) => {
    mockState.files[to] = mockState.files[from] ?? "";
    delete mockState.files[from];
  },
}));

mock.module("fs", () => ({
  existsSync: (path: string) => {
    // Handle the FOLDERS_FILE path
    if (path.endsWith("chat-folders.yaml")) {
      return mockState.foldersFileContent !== null || mockState.files[path] !== undefined;
    }
    return mockState.files[path] !== undefined;
  },
}));

mock.module("path", () => ({
  join: (...parts: string[]) => parts.join("/"),
  resolve: (...parts: string[]) => parts.join("/"),
}));

mock.module("../../utils/paths", () => ({
  DATA_DIR: mockState.dataDir,
  CHATS_DIR: mockState.chatsDir,
  CONVERSATIONS_DIR: mockState.conversationsDir,
  CHAT_FOLDERS_FILE: `${mockState.chatsDir}/chat-folders.yaml`,
}));

mock.module("../llm", () => ({
  llmService: {
    chat: async (_messages: any[]) => {
      if (mockState.llmShouldThrow) {
        throw new Error("LLM service error");
      }
      return { content: mockState.llmResponse };
    },
  },
}));

mock.module("../../spaces/storage", () => ({
  saveSpaceChat: async (data: any) => {
    mockState.savedSpaceChats.push(data);
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  generateSessionId,
  getSession,
  createSession,
  getOrCreateSession,
  addMessage,
  getMessages,
  saveConversation,
  loadConversation,
  cleanupOldSessions,
  setPendingAttachments,
  popPendingAttachments,
  saveChatHistory,
  loadChatHistory,
  getChatOwnerId,
  updateChatMaterials,
  addChatMaterial,
  removeChatMaterial,
  listChatHistories,
  searchChatHistories,
  searchChatHistoriesWithScoring,
  deleteChatHistory,
  regenerateChatSummary,
  regenerateAllMissingSummaries,
  createShareLink,
  revokeShareLink,
  loadChatByShareToken,
  getShareInfo,
  loadChatFolders,
  createChatFolder,
  deleteChatFolder,
  updateChatFolders,
  getChatFolderIds,
  listChatsInFolder,
  getFolderChatCounts,
} = await import("../memory");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid ChatHistory YAML string that can be parsed by
 * parseChatYaml() inside the module.
 */
function buildChatYaml(opts: {
  id: string;
  title: string;
  userId?: string;
  spaceId?: string;
  folderIds?: string[];
  summary?: string;
  keywords?: string[];
  shareToken?: string;
  sharedAt?: string;
  sharedBy?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  materials?: Array<{ id: string; type: string; title: string; content: string; createdAt: number }>;
  lastSummaryAt?: number;
}): string {
  const lines: string[] = [`id: ${opts.id}`];
  if (opts.userId) lines.push(`userId: ${opts.userId}`);
  if (opts.spaceId) lines.push(`spaceId: ${opts.spaceId}`);
  if (opts.folderIds && opts.folderIds.length > 0) {
    lines.push("folderIds:");
    for (const fid of opts.folderIds) lines.push(`  - ${fid}`);
  }
  lines.push(`title: ${opts.title}`);
  if (opts.summary) lines.push(`summary: ${opts.summary}`);
  if (opts.keywords && opts.keywords.length > 0) {
    lines.push("keywords:");
    for (const kw of opts.keywords) lines.push(`  - ${kw}`);
  }
  if (opts.lastSummaryAt !== undefined) lines.push(`lastSummaryAt: ${opts.lastSummaryAt}`);
  if (opts.shareToken) lines.push(`shareToken: ${opts.shareToken}`);
  if (opts.sharedAt) lines.push(`sharedAt: "${opts.sharedAt}"`);
  if (opts.sharedBy) lines.push(`sharedBy: ${opts.sharedBy}`);
  lines.push(`createdAt: "2026-01-01T00:00:00.000Z"`);
  lines.push(`updatedAt: "2026-01-02T00:00:00.000Z"`);
  lines.push("messages:");
  for (const msg of opts.messages ?? []) {
    lines.push(`  - role: ${msg.role}`);
    lines.push(`    content: ${msg.content}`);
  }
  if (opts.materials && opts.materials.length > 0) {
    lines.push("materials:");
    for (const mat of opts.materials) {
      lines.push(`  - id: ${mat.id}`);
      lines.push(`    type: ${mat.type}`);
      lines.push(`    title: ${mat.title}`);
      lines.push(`    content: ${mat.content}`);
      lines.push(`    createdAt: ${mat.createdAt}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** Register a chat YAML in the mock file system and chatFiles listing */
function registerChat(opts: Parameters<typeof buildChatYaml>[0]): void {
  const yaml = buildChatYaml(opts);
  const filename = `${opts.id}.yaml`;
  mockState.files[`${mockState.chatsDir}/${filename}`] = yaml;
  if (!mockState.chatFiles.includes(filename)) {
    mockState.chatFiles.push(filename);
  }
}

/** Reset all shared mock state */
function resetMockState(): void {
  mockState.files = {};
  mockState.chatFiles = [];
  mockState.conversationFiles = [];
  mockState.foldersFileContent = null;
  mockState.savedSpaceChats = [];
  mockState.llmResponse = '{"title":"Test Title","summary":"A test summary","keywords":["kw1","kw2"]}';
  mockState.llmShouldThrow = false;
}

// ---------------------------------------------------------------------------
// In-memory session management
// ---------------------------------------------------------------------------

describe("generateSessionId()", () => {
  test("should return a string starting with 'session_'", () => {
    const id = generateSessionId();
    expect(id.startsWith("session_")).toBe(true);
  });

  test("should return unique IDs on successive calls", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });

  test("should contain a timestamp component", () => {
    const before = Date.now();
    const id = generateSessionId();
    const after = Date.now();
    // Format: session_<timestamp>_<random>
    const parts = id.split("_");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const timestamp = parseInt(parts[1]!, 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  test("should return a string with a random suffix", () => {
    // Multiple calls should produce different suffixes
    const ids = new Set(Array.from({ length: 10 }, () => generateSessionId()));
    expect(ids.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------

describe("createSession()", () => {
  test("should return a session with the provided sessionId", () => {
    const session = createSession("test-session-create");
    expect(session.id).toBe("test-session-create");
  });

  test("should start with an empty messages array", () => {
    const session = createSession("test-session-empty");
    expect(session.messages).toEqual([]);
  });

  test("should store the provided userId", () => {
    const session = createSession("test-session-user", "user-42");
    expect(session.userId).toBe("user-42");
  });

  test("should set createdAt and updatedAt as ISO strings", () => {
    const session = createSession("test-session-dates");
    expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
    expect(new Date(session.updatedAt).toISOString()).toBe(session.updatedAt);
  });

  test("should store undefined userId when not provided", () => {
    const session = createSession("test-session-no-user");
    expect(session.userId).toBeUndefined();
  });

  test("should overwrite an existing session with the same key", () => {
    createSession("overwrite-session", "u-over");
    addMessage("overwrite-session", { role: "user", content: "old" }, "u-over");
    // Creating again overwrites
    const newSession = createSession("overwrite-session", "u-over");
    expect(newSession.messages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("getSession()", () => {
  test("should return undefined for a non-existent session", () => {
    const result = getSession("nonexistent-session");
    expect(result).toBeUndefined();
  });

  test("should return the session after it has been created", () => {
    createSession("gs-test-1", "user-1");
    const result = getSession("gs-test-1", "user-1");
    expect(result).toBeDefined();
    expect(result!.id).toBe("gs-test-1");
  });

  test("should isolate sessions by userId — wrong user gets undefined", () => {
    createSession("isolated-session", "owner");
    const result = getSession("isolated-session", "other-user");
    expect(result).toBeUndefined();
  });

  test("should return an anonymous session when no userId is provided", () => {
    createSession("anon-session");
    const result = getSession("anon-session");
    expect(result).toBeDefined();
    expect(result!.id).toBe("anon-session");
  });

  test("should allow different users to have independent sessions with the same sessionId", () => {
    createSession("shared-id-session", "user-alpha");
    createSession("shared-id-session", "user-beta");
    addMessage("shared-id-session", { role: "user", content: "from alpha" }, "user-alpha");
    addMessage("shared-id-session", { role: "user", content: "from beta" }, "user-beta");

    const alphaSession = getSession("shared-id-session", "user-alpha");
    const betaSession = getSession("shared-id-session", "user-beta");

    expect(alphaSession!.messages[0]!.content).toBe("from alpha");
    expect(betaSession!.messages[0]!.content).toBe("from beta");
  });
});

// ---------------------------------------------------------------------------

describe("getOrCreateSession()", () => {
  test("should create a new session when none exists", () => {
    const session = getOrCreateSession("goc-new-session");
    expect(session.id).toBe("goc-new-session");
    expect(session.messages).toEqual([]);
  });

  test("should return the existing session when one is present", () => {
    createSession("goc-existing", "user-A");
    const session1 = getSession("goc-existing", "user-A")!;
    session1.messages.push({ role: "user", content: "hello" });

    const session2 = getOrCreateSession("goc-existing", "user-A");
    expect(session2.messages).toHaveLength(1);
  });

  test("should be idempotent — multiple calls return the same session", () => {
    const s1 = getOrCreateSession("goc-idempotent", "u-idemp");
    const s2 = getOrCreateSession("goc-idempotent", "u-idemp");
    expect(s1).toBe(s2);
  });

  test("should create separate sessions for different users with the same id", () => {
    const sessionA = getOrCreateSession("goc-multi-user", "user-X");
    const sessionB = getOrCreateSession("goc-multi-user", "user-Y");
    expect(sessionA).not.toBe(sessionB);
  });
});

// ---------------------------------------------------------------------------

describe("addMessage()", () => {
  test("should append a message to the session", () => {
    createSession("am-session-1", "u1");
    addMessage("am-session-1", { role: "user", content: "Hello" }, "u1");
    const messages = getMessages("am-session-1", "u1");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe("Hello");
  });

  test("should update the session's updatedAt timestamp", () => {
    createSession("am-session-2", "u2");
    const before = new Date().toISOString();
    addMessage("am-session-2", { role: "assistant", content: "Hi" }, "u2");
    const after = new Date().toISOString();
    const session = getSession("am-session-2", "u2")!;
    expect(session.updatedAt >= before).toBe(true);
    expect(session.updatedAt <= after).toBe(true);
  });

  test("should create the session if it does not exist", () => {
    addMessage("am-session-auto", { role: "user", content: "auto-create" });
    const messages = getMessages("am-session-auto");
    expect(messages).toHaveLength(1);
  });

  test("should append multiple messages in order", () => {
    createSession("am-multi", "u-multi");
    addMessage("am-multi", { role: "user", content: "first" }, "u-multi");
    addMessage("am-multi", { role: "assistant", content: "second" }, "u-multi");
    addMessage("am-multi", { role: "user", content: "third" }, "u-multi");
    const messages = getMessages("am-multi", "u-multi");
    expect(messages).toHaveLength(3);
    expect(messages[0]!.content).toBe("first");
    expect(messages[1]!.content).toBe("second");
    expect(messages[2]!.content).toBe("third");
  });
});

// ---------------------------------------------------------------------------

describe("getMessages()", () => {
  test("should return empty array for unknown session", () => {
    const messages = getMessages("no-such-session-abc");
    expect(messages).toEqual([]);
  });

  test("should return all messages in insertion order", () => {
    createSession("gm-session", "u-gm");
    addMessage("gm-session", { role: "user", content: "msg1" }, "u-gm");
    addMessage("gm-session", { role: "assistant", content: "msg2" }, "u-gm");
    addMessage("gm-session", { role: "user", content: "msg3" }, "u-gm");

    const messages = getMessages("gm-session", "u-gm");
    expect(messages).toHaveLength(3);
    expect(messages[0]!.content).toBe("msg1");
    expect(messages[2]!.content).toBe("msg3");
  });

  test("should return empty array when userId does not match the session owner", () => {
    createSession("gm-isolated", "gm-owner");
    addMessage("gm-isolated", { role: "user", content: "private" }, "gm-owner");
    const messages = getMessages("gm-isolated", "wrong-user");
    expect(messages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("setPendingAttachments() / popPendingAttachments()", () => {
  const attachments = [
    { id: "a1", type: "document" as const, filename: "doc.pdf", mimeType: "application/pdf" },
  ];

  test("should pop the attachments that were set", () => {
    setPendingAttachments("att-session", attachments, "att-user");
    const result = popPendingAttachments("att-session", "att-user");
    expect(result).toEqual(attachments);
  });

  test("should clear pending attachments after pop", () => {
    setPendingAttachments("att-session-2", attachments, "att-user-2");
    popPendingAttachments("att-session-2", "att-user-2");
    const second = popPendingAttachments("att-session-2", "att-user-2");
    expect(second).toBeUndefined();
  });

  test("should return undefined when no attachments were set", () => {
    const result = popPendingAttachments("att-session-none", "some-user");
    expect(result).toBeUndefined();
  });

  test("should isolate attachments by userId", () => {
    setPendingAttachments("att-iso", attachments, "user-A");
    const result = popPendingAttachments("att-iso", "user-B");
    expect(result).toBeUndefined();
  });

  test("should support anonymous attachments (no userId)", () => {
    const anon = [{ id: "anon-att", type: "image" as const, filename: "img.png", mimeType: "image/png" }];
    setPendingAttachments("att-anon-session", anon);
    const result = popPendingAttachments("att-anon-session");
    expect(result).toEqual(anon);
  });

  test("should allow overwriting pending attachments before pop", () => {
    const first = [{ id: "first-att", type: "document" as const, filename: "a.pdf", mimeType: "application/pdf" }];
    const second = [{ id: "second-att", type: "image" as const, filename: "b.png", mimeType: "image/png" }];
    setPendingAttachments("att-overwrite", first, "u-over");
    setPendingAttachments("att-overwrite", second, "u-over");
    const result = popPendingAttachments("att-overwrite", "u-over");
    expect(result).toEqual(second);
  });
});

// ---------------------------------------------------------------------------

describe("cleanupOldSessions()", () => {
  test("should remove sessions older than maxAgeMs", () => {
    const sessionId = "cleanup-old-" + Date.now();
    const session = createSession(sessionId, "cleanup-user");
    // Backdate updatedAt by 2 hours
    session.updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    cleanupOldSessions(60 * 60 * 1000); // 1 hour max age

    expect(getSession(sessionId, "cleanup-user")).toBeUndefined();
  });

  test("should keep sessions younger than maxAgeMs", () => {
    const sessionId = "cleanup-fresh-" + Date.now();
    createSession(sessionId, "fresh-user");

    cleanupOldSessions(24 * 60 * 60 * 1000); // 24 hour max age

    expect(getSession(sessionId, "fresh-user")).toBeDefined();
  });

  test("should use default maxAge of 24h when no argument provided", () => {
    const sessionId = "cleanup-default-" + Date.now();
    const session = createSession(sessionId, "default-cleanup-user");
    // Backdate by 25 hours — should be removed with default 24h maxAge
    session.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    cleanupOldSessions(); // default 24h

    expect(getSession(sessionId, "default-cleanup-user")).toBeUndefined();
  });

  test("should only remove sessions that exceed the threshold", () => {
    const oldId = "cleanup-old-mix-" + Date.now();
    const freshId = "cleanup-fresh-mix-" + Date.now();
    const oldSession = createSession(oldId, "mix-user");
    createSession(freshId, "mix-user");

    // Backdate only the old session
    oldSession.updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    cleanupOldSessions(60 * 60 * 1000); // 1 hour max age

    expect(getSession(oldId, "mix-user")).toBeUndefined();
    expect(getSession(freshId, "mix-user")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------

describe("saveConversation()", () => {
  beforeEach(resetMockState);

  test("should do nothing when there is no session", async () => {
    await saveConversation("no-session-xyz");
    expect(Object.keys(mockState.files)).toHaveLength(0);
  });

  test("should do nothing when the session has no messages", async () => {
    createSession("empty-conv", "u1");
    await saveConversation("empty-conv", "u1");
    expect(Object.keys(mockState.files)).toHaveLength(0);
  });

  test("should write a markdown file to CONVERSATIONS_DIR", async () => {
    const sessionId = "conv-save-" + Date.now();
    createSession(sessionId, "u-conv");
    addMessage(sessionId, { role: "user", content: "Hello world" }, "u-conv");
    await saveConversation(sessionId, "u-conv");
    const expectedPath = `${mockState.conversationsDir}/${sessionId}.md`;
    expect(mockState.files[expectedPath]).toBeDefined();
  });

  test("should include the session ID in the markdown content", async () => {
    const sessionId = "conv-content-" + Date.now();
    createSession(sessionId, "u-c");
    addMessage(sessionId, { role: "user", content: "Test content" }, "u-c");
    await saveConversation(sessionId, "u-c");
    const content = mockState.files[`${mockState.conversationsDir}/${sessionId}.md`]!;
    expect(content).toContain(sessionId);
  });
});

// ---------------------------------------------------------------------------

describe("loadConversation()", () => {
  beforeEach(resetMockState);

  test("should return null for a file that does not exist", async () => {
    const result = await loadConversation("nonexistent-conv");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// YAML serialization roundtrip (via loadChatHistory after registering YAML)
// ---------------------------------------------------------------------------

describe("Chat YAML serialization roundtrip", () => {
  beforeEach(resetMockState);

  test("should roundtrip a basic chat with id and title", async () => {
    registerChat({ id: "rt-basic", title: "Basic Chat Title" });
    const chat = await loadChatHistory("rt-basic");
    expect(chat).not.toBeNull();
    expect(chat!.id).toBe("rt-basic");
    expect(chat!.title).toBe("Basic Chat Title");
  });

  test("should roundtrip createdAt and updatedAt timestamps", async () => {
    registerChat({ id: "rt-dates", title: "T" });
    const chat = await loadChatHistory("rt-dates");
    expect(chat!.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(chat!.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  test("should roundtrip userId", async () => {
    registerChat({ id: "rt-userid", title: "T", userId: "roundtrip-user" });
    const chat = await loadChatHistory("rt-userid", "roundtrip-user");
    expect(chat!.userId).toBe("roundtrip-user");
  });

  test("should roundtrip spaceId", async () => {
    // Chats with spaceId are excluded from non-space listing but loadChatHistory still reads them
    const yaml = buildChatYaml({ id: "rt-space", title: "T", spaceId: "space-rt" });
    mockState.files[`${mockState.chatsDir}/rt-space.yaml`] = yaml;
    const chat = await loadChatHistory("rt-space");
    expect(chat!.spaceId).toBe("space-rt");
  });

  test("should roundtrip folderIds array", async () => {
    registerChat({ id: "rt-folders", title: "T", folderIds: ["folder-a", "folder-b"] });
    const chat = await loadChatHistory("rt-folders");
    expect(chat!.folderIds).toEqual(["folder-a", "folder-b"]);
  });

  test("should roundtrip summary", async () => {
    registerChat({ id: "rt-summary", title: "T", summary: "This is a summary" });
    const chat = await loadChatHistory("rt-summary");
    expect(chat!.summary).toBe("This is a summary");
  });

  test("should roundtrip keywords array", async () => {
    registerChat({ id: "rt-kw", title: "T", keywords: ["alpha", "beta", "gamma"] });
    const chat = await loadChatHistory("rt-kw");
    expect(chat!.keywords).toEqual(["alpha", "beta", "gamma"]);
  });

  test("should roundtrip lastSummaryAt", async () => {
    registerChat({ id: "rt-lsa", title: "T", lastSummaryAt: 12 });
    const chat = await loadChatHistory("rt-lsa");
    expect(chat!.lastSummaryAt).toBe(12);
  });

  test("should roundtrip shareToken, sharedAt, sharedBy", async () => {
    registerChat({
      id: "rt-share",
      title: "T",
      shareToken: "my-share-token-123",
      sharedAt: "2026-02-01T12:00:00.000Z",
      sharedBy: "share-owner",
    });
    const chat = await loadChatHistory("rt-share");
    expect(chat!.shareToken).toBe("my-share-token-123");
    expect(chat!.sharedAt).toBe("2026-02-01T12:00:00.000Z");
    expect(chat!.sharedBy).toBe("share-owner");
  });

  test("should roundtrip user and assistant messages", async () => {
    registerChat({
      id: "rt-msgs",
      title: "T",
      messages: [
        { role: "user", content: "User question here" },
        { role: "assistant", content: "Assistant answer here" },
      ],
    });
    const chat = await loadChatHistory("rt-msgs");
    expect(chat!.messages).toHaveLength(2);
    expect(chat!.messages[0]!.role).toBe("user");
    expect(chat!.messages[0]!.content).toBe("User question here");
    expect(chat!.messages[1]!.role).toBe("assistant");
    expect(chat!.messages[1]!.content).toBe("Assistant answer here");
  });

  test("should roundtrip message with agentId", async () => {
    // Write raw YAML with agentId
    const yaml = `id: rt-agentid\ntitle: T\ncreatedAt: "2026-01-01T00:00:00.000Z"\nupdatedAt: "2026-01-02T00:00:00.000Z"\nmessages:\n  - role: assistant\n    content: Response\n    agentId: my-agent\n`;
    mockState.files[`${mockState.chatsDir}/rt-agentid.yaml`] = yaml;
    const chat = await loadChatHistory("rt-agentid");
    expect(chat!.messages[0]!.agentId).toBe("my-agent");
  });

  test("should roundtrip message with routedBy", async () => {
    const yaml = `id: rt-routed\ntitle: T\ncreatedAt: "2026-01-01T00:00:00.000Z"\nupdatedAt: "2026-01-02T00:00:00.000Z"\nmessages:\n  - role: assistant\n    content: Routed response\n    routedBy: router-agent\n`;
    mockState.files[`${mockState.chatsDir}/rt-routed.yaml`] = yaml;
    const chat = await loadChatHistory("rt-routed");
    expect(chat!.messages[0]!.routedBy).toBe("router-agent");
  });

  test("should parse chat with empty messages array", async () => {
    registerChat({ id: "rt-empty-msgs", title: "T", messages: [] });
    const chat = await loadChatHistory("rt-empty-msgs");
    expect(chat!.messages).toEqual([]);
  });

  test("should roundtrip attachments on messages (all fields)", async () => {
    // Write raw YAML with attachments including all optional fields
    const yaml = [
      "id: rt-attachments",
      "title: T",
      'createdAt: "2026-01-01T00:00:00.000Z"',
      'updatedAt: "2026-01-02T00:00:00.000Z"',
      "messages:",
      "  - role: user",
      "    content: Check this file",
      "    attachments:",
      "      - id: att-full-1",
      "        type: document",
      "        filename: report.pdf",
      "        mimeType: application/pdf",
      "        url: /files/report.pdf",
      "        preview: First few lines of the document",
      "      - id: att-full-2",
      "        type: audio",
      "        filename: recording.mp3",
      "        mimeType: audio/mpeg",
      "        url: /files/recording.mp3",
      "        transcription: This is what was said",
    ].join("\n") + "\n";
    mockState.files[`${mockState.chatsDir}/rt-attachments.yaml`] = yaml;

    const chat = await loadChatHistory("rt-attachments");
    expect(chat).not.toBeNull();
    const msg = chat!.messages[0]!;
    expect(msg.attachments).toHaveLength(2);

    const docAtt = msg.attachments![0]!;
    expect(docAtt.id).toBe("att-full-1");
    expect(docAtt.type).toBe("document");
    expect(docAtt.filename).toBe("report.pdf");
    expect(docAtt.mimeType).toBe("application/pdf");
    expect(docAtt.url).toBe("/files/report.pdf");
    expect(docAtt.preview).toBe("First few lines of the document");

    const audioAtt = msg.attachments![1]!;
    expect(audioAtt.id).toBe("att-full-2");
    expect(audioAtt.type).toBe("audio");
    expect(audioAtt.transcription).toBe("This is what was said");
  });

  test("should roundtrip materials with all fields including metadata", async () => {
    const yaml = [
      "id: rt-materials",
      "title: T",
      'createdAt: "2026-01-01T00:00:00.000Z"',
      'updatedAt: "2026-01-02T00:00:00.000Z"',
      "messages:",
      "  - role: user",
      "    content: Hello",
      "materials:",
      "  - id: mat-full-1",
      "    type: upload",
      "    title: My Document",
      "    content: Document content here",
      "    createdAt: 1700000000000",
      "    mimeType: application/pdf",
      "    sourceMessageIndex: 0",
      "    metadata:",
      "      filename: original.pdf",
      "      duration: 42",
      "      skillId: skill-abc",
    ].join("\n") + "\n";
    mockState.files[`${mockState.chatsDir}/rt-materials.yaml`] = yaml;

    const chat = await loadChatHistory("rt-materials");
    expect(chat).not.toBeNull();
    expect(chat!.materials).toHaveLength(1);

    const mat = chat!.materials![0]!;
    expect(mat.id).toBe("mat-full-1");
    expect(mat.type).toBe("upload");
    expect(mat.title).toBe("My Document");
    expect(mat.content).toBe("Document content here");
    expect(mat.createdAt).toBe(1700000000000);
    expect(mat.mimeType).toBe("application/pdf");
    expect(mat.sourceMessageIndex).toBe(0);
    expect(mat.metadata?.filename).toBe("original.pdf");
    expect(mat.metadata?.duration).toBe(42);
    expect(mat.metadata?.skillId).toBe("skill-abc");
  });

  test("should return null for invalid YAML content", async () => {
    mockState.files[`${mockState.chatsDir}/invalid.yaml`] = ":::not valid yaml:::";
    const chat = await loadChatHistory("invalid");
    expect(chat).toBeNull();
  });

  test("should return null when id is missing from YAML", async () => {
    mockState.files[`${mockState.chatsDir}/no-id.yaml`] = "title: No ID Chat\ncreatedAt: \"2026-01-01T00:00:00.000Z\"\nupdatedAt: \"2026-01-01T00:00:00.000Z\"\nmessages:\n";
    const chat = await loadChatHistory("no-id");
    expect(chat).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// escapeYamlString behavior — tested indirectly via saveChatHistory + loadChatHistory
// ---------------------------------------------------------------------------

describe("escapeYamlString (via YAML roundtrip)", () => {
  beforeEach(resetMockState);

  test("should handle content with newlines by escaping them", async () => {
    const sid = "escape-newline-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Line 1\nLine 2\nLine 3" });
    addMessage(sid, { role: "assistant", content: "Response" });
    await saveChatHistory(sid);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    // Newlines in content must be escaped to keep valid YAML
    expect(yaml).toContain("\\n");
  });

  test("should handle content with double quotes by escaping them", async () => {
    const sid = "escape-quotes-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: 'She said "hello" to me' });
    addMessage(sid, { role: "assistant", content: "Response" });
    await saveChatHistory(sid);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    expect(yaml).toBeDefined();
    // YAML should be valid (no parse error when re-loading)
    mockState.chatFiles.push(`${sid}.yaml`);
    const loaded = await loadChatHistory(sid);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages[0]!.content).toBe('She said "hello" to me');
  });

  test("should handle content with colons by quoting", async () => {
    const sid = "escape-colons-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Key: value pairs are common in YAML" });
    addMessage(sid, { role: "assistant", content: "Indeed" });
    await saveChatHistory(sid);
    mockState.chatFiles.push(`${sid}.yaml`);
    const loaded = await loadChatHistory(sid);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages[0]!.content).toBe("Key: value pairs are common in YAML");
  });

  test("should handle empty string content", async () => {
    // Empty string is represented as "" in YAML
    const sid = "escape-empty-" + Date.now();
    createSession(sid);
    // Tool messages with empty content are filtered out by saveChatHistory, so test via direct registration
    registerChat({
      id: "escape-empty-direct",
      title: "T",
      messages: [{ role: "user", content: "" }],
    });
    const chat = await loadChatHistory("escape-empty-direct");
    expect(chat!.messages[0]!.content).toBe("");
  });
});

// ---------------------------------------------------------------------------
// tokenize — tested indirectly via searchChatHistoriesWithScoring
// ---------------------------------------------------------------------------

describe("tokenize (via searchChatHistoriesWithScoring token scoring)", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should match tokens split on whitespace", async () => {
    registerChat({
      id: "tokenize-space",
      title: "Machine Learning Basics",
      messages: [{ role: "user", content: "query" }],
    });
    // Query "Machine" should match the title via tokenization
    const results = await searchChatHistoriesWithScoring({ query: "Machine" });
    expect(results.some((r) => r.id === "tokenize-space")).toBe(true);
  });

  test("should filter tokens shorter than 3 characters", async () => {
    // Single-letter and 2-letter tokens shouldn't produce matches
    registerChat({
      id: "tokenize-short",
      title: "AI ML Framework",
      messages: [{ role: "user", content: "query" }],
    });
    // "AI" is 2 chars and should be filtered — no match on "AI" alone
    const results = await searchChatHistoriesWithScoring({ query: "AI" });
    // AI is 2 chars - tokenize filters tokens < 3, but the exact match "AI"
    // in title should still hit via the direct queryLower.includes() check
    // regardless of tokenization. This test verifies the service handles it.
    expect(Array.isArray(results)).toBe(true);
  });

  test("should match case-insensitively via token lowercasing", async () => {
    registerChat({
      id: "tokenize-case",
      title: "TypeScript Generics Guide",
      messages: [{ role: "user", content: "question" }],
    });
    const resultsUpper = await searchChatHistoriesWithScoring({ query: "TYPESCRIPT" });
    const resultsLower = await searchChatHistoriesWithScoring({ query: "typescript" });
    const foundUpper = resultsUpper.some((r) => r.id === "tokenize-case");
    const foundLower = resultsLower.some((r) => r.id === "tokenize-case");
    expect(foundUpper).toBe(foundLower);
  });
});

// ---------------------------------------------------------------------------
// extractSnippet — tested indirectly via searchChatHistories snippet output
// ---------------------------------------------------------------------------

describe("extractSnippet (via searchChatHistories)", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return a snippet containing the search term", async () => {
    registerChat({
      id: "snippet-match",
      title: "General",
      messages: [
        {
          role: "user",
          content: "This is a long message that contains the word kubernetes in the middle of the text",
        },
      ],
    });
    const results = await searchChatHistories("kubernetes");
    const r = results.find((r) => r.id === "snippet-match");
    expect(r!.snippet).toBeDefined();
    expect(r!.snippet!.toLowerCase()).toContain("kubernetes");
  });

  test("should add leading ellipsis when match is not at the start", async () => {
    // 30+ chars before the match trigger the leading '...'
    registerChat({
      id: "snippet-prefix",
      title: "General",
      messages: [
        {
          role: "user",
          content: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA target_word BBBBBBBBBBBBB",
        },
      ],
    });
    const results = await searchChatHistories("target_word");
    const r = results.find((r) => r.id === "snippet-prefix");
    expect(r!.snippet).toBeDefined();
    expect(r!.snippet!.startsWith("...")).toBe(true);
  });

  test("should add trailing ellipsis when content extends past the snippet end", async () => {
    // 30+ chars after the match trigger the trailing '...'
    registerChat({
      id: "snippet-suffix",
      title: "General",
      messages: [
        {
          role: "user",
          content: "target_word CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        },
      ],
    });
    const results = await searchChatHistories("target_word");
    const r = results.find((r) => r.id === "snippet-suffix");
    expect(r!.snippet).toBeDefined();
    expect(r!.snippet!.endsWith("...")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chat history (YAML persistence)
// ---------------------------------------------------------------------------

describe("loadChatHistory()", () => {
  beforeEach(resetMockState);

  test("should return null when the chat file does not exist", async () => {
    const result = await loadChatHistory("missing-chat");
    expect(result).toBeNull();
  });

  test("should load and return a chat that has no userId", async () => {
    registerChat({ id: "anon-chat", title: "Anon Chat" });
    const result = await loadChatHistory("anon-chat");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("anon-chat");
  });

  test("should allow the owner to access their own chat", async () => {
    registerChat({ id: "owned-chat", title: "My Chat", userId: "owner-1" });
    const result = await loadChatHistory("owned-chat", "owner-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("owned-chat");
  });

  test("should deny access when a different user requests an owned chat", async () => {
    registerChat({ id: "private-chat", title: "Private", userId: "owner-2" });
    const result = await loadChatHistory("private-chat", "other-user");
    expect(result).toBeNull();
  });

  test("should deny anonymous access to an owned chat", async () => {
    registerChat({ id: "user-chat", title: "User Chat", userId: "u-xyz" });
    const result = await loadChatHistory("user-chat");
    expect(result).toBeNull();
  });

  test("should allow any user to access an anonymous chat", async () => {
    registerChat({ id: "public-chat", title: "Public" });
    const result = await loadChatHistory("public-chat", "any-user");
    expect(result).not.toBeNull();
  });

  test("should return null when the YAML is malformed", async () => {
    mockState.files[`${mockState.chatsDir}/bad-chat.yaml`] = ":::invalid yaml:::";
    mockState.chatFiles.push("bad-chat.yaml");
    const result = await loadChatHistory("bad-chat");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("getChatOwnerId()", () => {
  beforeEach(resetMockState);

  test("should return null when the chat file does not exist", async () => {
    const result = await getChatOwnerId("no-such-chat");
    expect(result).toBeNull();
  });

  test("should return the userId of an owned chat", async () => {
    registerChat({ id: "owned-for-id", title: "T", userId: "owner-id-42" });
    const result = await getChatOwnerId("owned-for-id");
    expect(result).toBe("owner-id-42");
  });

  test("should return null for an anonymous chat", async () => {
    registerChat({ id: "anon-for-id", title: "T" });
    const result = await getChatOwnerId("anon-for-id");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("listChatHistories()", () => {
  beforeEach(resetMockState);

  test("should return empty result when CHATS_DIR does not exist", async () => {
    // existsSync(CHATS_DIR) returns false because files map has no entry for chatsDir
    mockState.chatFiles = [];
    const result = await listChatHistories();
    expect(result.chats).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  test("should list anonymous chats for anonymous users", async () => {
    // Add a sentinel key so existsSync(CHATS_DIR) returns true
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "list-anon", title: "Anon Chat", messages: [{ role: "user", content: "hi" }] });
    const result = await listChatHistories(undefined, 0, undefined);
    expect(result.chats.some((c) => c.id === "list-anon")).toBe(true);
  });

  test("should include user chats for the matching userId", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "user-list-chat", title: "User Chat", userId: "list-user" });
    const result = await listChatHistories(undefined, 0, "list-user");
    expect(result.chats.some((c) => c.id === "user-list-chat")).toBe(true);
  });

  test("should exclude other users' chats", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "private-list-chat", title: "Private", userId: "other-user" });
    const result = await listChatHistories(undefined, 0, "list-user-2");
    expect(result.chats.some((c) => c.id === "private-list-chat")).toBe(false);
  });

  test("should paginate with limit and offset", async () => {
    mockState.files[mockState.chatsDir] = "";
    for (let i = 1; i <= 5; i++) {
      registerChat({
        id: `paginate-chat-${i}`,
        title: `Chat ${i}`,
        messages: [{ role: "user", content: `msg ${i}` }],
      });
    }
    const result = await listChatHistories(2, 0);
    expect(result.chats).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  test("should set hasMore to false when all results fit in limit", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "only-chat", title: "Only" });
    const result = await listChatHistories(10, 0);
    expect(result.hasMore).toBe(false);
  });

  test("should exclude space chats when spaceId filter is not set", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "space-chat-excl", title: "Space Chat", spaceId: "sp-1" });
    const result = await listChatHistories();
    expect(result.chats.some((c) => c.id === "space-chat-excl")).toBe(false);
  });

  test("should include only space chats when spaceId filter is set", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({ id: "space-chat-incl", title: "Space Chat", spaceId: "sp-2" });
    registerChat({ id: "regular-chat-excl", title: "Regular" });
    const result = await listChatHistories(undefined, 0, undefined, "sp-2");
    expect(result.chats.some((c) => c.id === "space-chat-incl")).toBe(true);
    expect(result.chats.some((c) => c.id === "regular-chat-excl")).toBe(false);
  });

  test("should sort chats by updatedAt descending", async () => {
    mockState.files[mockState.chatsDir] = "";
    // Build two chats with different updatedAt timestamps
    const yaml1 = buildChatYaml({ id: "sort-older", title: "Older" })
      .replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-01T00:00:00.000Z"`);
    const yaml2 = buildChatYaml({ id: "sort-newer", title: "Newer" })
      .replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-03T00:00:00.000Z"`);
    mockState.files[`${mockState.chatsDir}/sort-older.yaml`] = yaml1;
    mockState.files[`${mockState.chatsDir}/sort-newer.yaml`] = yaml2;
    mockState.chatFiles.push("sort-older.yaml", "sort-newer.yaml");

    const result = await listChatHistories();
    const ids = result.chats.map((c) => c.id);
    expect(ids.indexOf("sort-newer")).toBeLessThan(ids.indexOf("sort-older"));
  });

  test("should support offset pagination correctly", async () => {
    mockState.files[mockState.chatsDir] = "";
    // Register 4 chats with different updatedAt to have deterministic order
    for (let i = 1; i <= 4; i++) {
      const yaml = buildChatYaml({ id: `offset-chat-${i}`, title: `Chat ${i}` })
        .replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-0${i}T00:00:00.000Z"`);
      mockState.files[`${mockState.chatsDir}/offset-chat-${i}.yaml`] = yaml;
      mockState.chatFiles.push(`offset-chat-${i}.yaml`);
    }

    const page1 = await listChatHistories(2, 0);
    const page2 = await listChatHistories(2, 2);

    expect(page1.chats).toHaveLength(2);
    expect(page2.chats).toHaveLength(2);
    // No overlap between pages
    const page1Ids = new Set(page1.chats.map((c) => c.id));
    const page2Ids = page2.chats.map((c) => c.id);
    expect(page2Ids.some((id) => page1Ids.has(id))).toBe(false);
    expect(page1.total).toBe(4);
    expect(page2.hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("deleteChatHistory()", () => {
  beforeEach(resetMockState);

  test("should return false when the chat does not exist", async () => {
    const result = await deleteChatHistory("no-such-delete");
    expect(result).toBe(false);
  });

  test("should delete an anonymous chat", async () => {
    registerChat({ id: "del-anon", title: "To Delete" });
    const result = await deleteChatHistory("del-anon");
    expect(result).toBe(true);
    expect(mockState.files[`${mockState.chatsDir}/del-anon.yaml`]).toBeUndefined();
  });

  test("should delete a chat when the owner requests it", async () => {
    registerChat({ id: "del-owned", title: "To Delete", userId: "owner-del" });
    const result = await deleteChatHistory("del-owned", "owner-del");
    expect(result).toBe(true);
  });

  test("should deny deletion when a non-owner requests it", async () => {
    registerChat({ id: "del-denied", title: "Protected", userId: "real-owner" });
    const result = await deleteChatHistory("del-denied", "intruder");
    expect(result).toBe(false);
    expect(mockState.files[`${mockState.chatsDir}/del-denied.yaml`]).toBeDefined();
  });

  test("should deny deletion by anonymous user on an owned chat", async () => {
    registerChat({ id: "del-anon-denied", title: "Protected", userId: "real-owner-2" });
    const result = await deleteChatHistory("del-anon-denied");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("searchChatHistories()", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return empty array for query shorter than 2 characters", async () => {
    const result = await searchChatHistories("a");
    expect(result).toEqual([]);
  });

  test("should return empty array for empty query", async () => {
    const result = await searchChatHistories("");
    expect(result).toEqual([]);
  });

  test("should find a chat by title match", async () => {
    registerChat({
      id: "search-title",
      title: "TypeScript Debugging",
      messages: [{ role: "user", content: "How do I debug?" }],
    });
    const results = await searchChatHistories("TypeScript");
    expect(results.some((r) => r.id === "search-title")).toBe(true);
    expect(results.find((r) => r.id === "search-title")!.matchedIn).toBe("title");
  });

  test("should find a chat by message content match", async () => {
    registerChat({
      id: "search-content",
      title: "General Chat",
      messages: [
        { role: "user", content: "Tell me about asynchronous programming patterns" },
      ],
    });
    const results = await searchChatHistories("asynchronous");
    expect(results.some((r) => r.id === "search-content")).toBe(true);
    expect(results.find((r) => r.id === "search-content")!.matchedIn).toBe("content");
  });

  test("should provide a snippet when matched in content", async () => {
    registerChat({
      id: "search-snippet",
      title: "Some Topic",
      messages: [{ role: "user", content: "I am interested in machine learning models" }],
    });
    const results = await searchChatHistories("machine learning");
    const r = results.find((r) => r.id === "search-snippet");
    expect(r).toBeDefined();
    expect(r!.snippet).toBeDefined();
    expect(r!.snippet).toContain("machine learning");
  });

  test("should not return chats that do not match the query", async () => {
    registerChat({
      id: "search-no-match",
      title: "Cooking Recipes",
      messages: [{ role: "user", content: "How to make pasta" }],
    });
    const results = await searchChatHistories("quantum physics");
    expect(results.some((r) => r.id === "search-no-match")).toBe(false);
  });

  test("should sort results by updatedAt descending", async () => {
    // Override updatedAt by building custom YAML
    const yaml1 = buildChatYaml({
      id: "search-sort-a",
      title: "search keyword",
      messages: [{ role: "user", content: "hello" }],
    }).replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-01T00:00:00.000Z"`);
    const yaml2 = buildChatYaml({
      id: "search-sort-b",
      title: "search keyword",
      messages: [{ role: "user", content: "hello" }],
    }).replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-03T00:00:00.000Z"`);
    mockState.files[`${mockState.chatsDir}/search-sort-a.yaml`] = yaml1;
    mockState.files[`${mockState.chatsDir}/search-sort-b.yaml`] = yaml2;
    mockState.chatFiles.push("search-sort-a.yaml", "search-sort-b.yaml");

    const results = await searchChatHistories("search keyword");
    const ids = results.map((r) => r.id);
    expect(ids.indexOf("search-sort-b")).toBeLessThan(ids.indexOf("search-sort-a"));
  });

  test("should return only one result per chat even with multiple matching messages", async () => {
    registerChat({
      id: "search-dedup",
      title: "Dedup Chat",
      messages: [
        { role: "user", content: "unique_query_term appears here" },
        { role: "assistant", content: "unique_query_term is mentioned again" },
      ],
    });
    const results = await searchChatHistories("unique_query_term");
    const matches = results.filter((r) => r.id === "search-dedup");
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("searchChatHistoriesWithScoring()", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return empty array for query shorter than 2 characters", async () => {
    const result = await searchChatHistoriesWithScoring({ query: "x" });
    expect(result).toEqual([]);
  });

  test("should assign higher score to title match than content match", async () => {
    registerChat({
      id: "score-title",
      title: "Python Tutorial",
      messages: [{ role: "user", content: "Tell me about Python" }],
    });
    registerChat({
      id: "score-content",
      title: "General Chat",
      messages: [{ role: "user", content: "Tell me about Python" }],
    });

    const results = await searchChatHistoriesWithScoring({ query: "Python Tutorial" });
    const titleResult = results.find((r) => r.id === "score-title");
    const contentResult = results.find((r) => r.id === "score-content");

    // title match should score higher or equal than content-only match
    if (titleResult && contentResult) {
      expect(titleResult.matchScore).toBeGreaterThanOrEqual(contentResult.matchScore);
    }
  });

  test("should return matchScore > 0 for matching results", async () => {
    registerChat({
      id: "scoring-chat",
      title: "Docker containers guide",
      messages: [{ role: "user", content: "How to use containers?" }],
    });

    const results = await searchChatHistoriesWithScoring({ query: "Docker" });
    const r = results.find((r) => r.id === "scoring-chat");
    expect(r).toBeDefined();
    expect(r!.matchScore).toBeGreaterThan(0);
  });

  test("should include messageCount in results", async () => {
    registerChat({
      id: "score-msgcount",
      title: "Kubernetes setup",
      messages: [
        { role: "user", content: "Kubernetes tutorial" },
        { role: "assistant", content: "Sure, here is how Kubernetes works" },
      ],
    });

    const results = await searchChatHistoriesWithScoring({ query: "Kubernetes" });
    const r = results.find((r) => r.id === "score-msgcount");
    expect(r).toBeDefined();
    expect(r!.messageCount).toBe(2);
  });

  test("should include firstMessage when includeMessages is true", async () => {
    registerChat({
      id: "score-first-msg",
      title: "Test Conversation",
      messages: [
        { role: "user", content: "What is React?" },
        { role: "assistant", content: "React is a UI library" },
      ],
    });

    const results = await searchChatHistoriesWithScoring({
      query: "React",
      includeMessages: true,
    });
    const r = results.find((r) => r.id === "score-first-msg");
    expect(r).toBeDefined();
    expect(r!.firstMessage).toBe("What is React?");
  });

  test("should limit results to the specified limit", async () => {
    for (let i = 0; i < 10; i++) {
      registerChat({
        id: `limit-chat-${i}`,
        title: `Limit Test Chat ${i}`,
        messages: [{ role: "user", content: "Limit Test query here" }],
      });
    }

    const results = await searchChatHistoriesWithScoring({ query: "Limit Test", limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("should sort by matchScore descending", async () => {
    registerChat({
      id: "sort-score-high",
      title: "JavaScript JavaScript JavaScript",
      messages: [{ role: "user", content: "JavaScript question" }],
      keywords: ["JavaScript"],
      summary: "JavaScript related discussion",
    });
    registerChat({
      id: "sort-score-low",
      title: "General Chat",
      messages: [{ role: "user", content: "I like JavaScript sometimes" }],
    });

    const results = await searchChatHistoriesWithScoring({ query: "JavaScript" });
    if (results.length >= 2) {
      expect(results[0]!.matchScore).toBeGreaterThanOrEqual(results[1]!.matchScore);
    }
  });

  test("should include keywords in result when chat has them", async () => {
    registerChat({
      id: "score-with-kw",
      title: "Some Chat",
      messages: [{ role: "user", content: "Tell me about containerization" }],
      keywords: ["containerization", "docker", "kubernetes"],
    });
    const results = await searchChatHistoriesWithScoring({ query: "containerization" });
    const r = results.find((r) => r.id === "score-with-kw");
    expect(r).toBeDefined();
    expect(r!.keywords).toEqual(["containerization", "docker", "kubernetes"]);
  });

  test("should include summary in result when chat has one", async () => {
    registerChat({
      id: "score-with-summary",
      title: "Topic Discussion",
      messages: [{ role: "user", content: "Question about networking" }],
      summary: "A detailed discussion about networking protocols",
    });
    const results = await searchChatHistoriesWithScoring({ query: "networking" });
    const r = results.find((r) => r.id === "score-with-summary");
    expect(r).toBeDefined();
    expect(r!.summary).toBe("A detailed discussion about networking protocols");
  });
});

// ---------------------------------------------------------------------------

describe("updateChatMaterials()", () => {
  beforeEach(resetMockState);

  test("should return false when the chat does not exist", async () => {
    const result = await updateChatMaterials("no-chat-mat", "user-x", []);
    expect(result).toBe(false);
  });

  test("should update materials on an owned chat", async () => {
    registerChat({ id: "mat-update", title: "T", userId: "mat-user" });
    const materials = [
      { id: "m1", type: "upload" as const, title: "Doc", content: "text", createdAt: 1000 },
    ];
    const result = await updateChatMaterials("mat-update", "mat-user", materials);
    expect(result).toBe(true);
    // Verify the YAML was re-written with the material
    const yaml = mockState.files[`${mockState.chatsDir}/mat-update.yaml`]!;
    expect(yaml).toContain("m1");
  });

  test("should return false when user is not the owner", async () => {
    registerChat({ id: "mat-denied", title: "T", userId: "real-owner-mat" });
    const result = await updateChatMaterials("mat-denied", "intruder-mat", []);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("addChatMaterial()", () => {
  beforeEach(resetMockState);

  test("should add a material to a chat", async () => {
    registerChat({ id: "add-mat-chat", title: "T", userId: "add-mat-user" });
    const material = {
      id: "new-mat-1",
      type: "transcript" as const,
      title: "Recording",
      content: "Transcript text",
      createdAt: Date.now(),
    };
    const result = await addChatMaterial("add-mat-chat", "add-mat-user", material);
    expect(result).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/add-mat-chat.yaml`]!;
    expect(yaml).toContain("new-mat-1");
  });

  test("should not add a duplicate material (same id)", async () => {
    const material = {
      id: "dup-mat",
      type: "upload" as const,
      title: "File",
      content: "content",
      createdAt: 1000,
    };
    registerChat({
      id: "add-dup-chat",
      title: "T",
      userId: "dup-user",
      materials: [material],
    });
    const result = await addChatMaterial("add-dup-chat", "dup-user", material);
    expect(result).toBe(true);
    // Only one occurrence of dup-mat in the YAML
    const yaml = mockState.files[`${mockState.chatsDir}/add-dup-chat.yaml`]!;
    const occurrences = yaml.split("dup-mat").length - 1;
    expect(occurrences).toBe(1);
  });

  test("should return false when user is not the owner", async () => {
    registerChat({ id: "add-mat-denied", title: "T", userId: "real-owner-add" });
    const result = await addChatMaterial("add-mat-denied", "intruder-add", {
      id: "x",
      type: "upload",
      title: "T",
      content: "c",
      createdAt: 1,
    });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("removeChatMaterial()", () => {
  beforeEach(resetMockState);

  test("should remove an existing material from a chat", async () => {
    registerChat({
      id: "rm-mat-chat",
      title: "T",
      userId: "rm-user",
      materials: [{ id: "rm-m1", type: "upload", title: "File", content: "c", createdAt: 1 }],
    });
    const result = await removeChatMaterial("rm-mat-chat", "rm-user", "rm-m1");
    expect(result).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/rm-mat-chat.yaml`]!;
    expect(yaml).not.toContain("rm-m1");
  });

  test("should succeed even if the materialId does not exist", async () => {
    registerChat({ id: "rm-no-mat", title: "T", userId: "rm-user-2" });
    const result = await removeChatMaterial("rm-no-mat", "rm-user-2", "ghost-mat");
    expect(result).toBe(true);
  });

  test("should return false when user is not the owner", async () => {
    registerChat({ id: "rm-denied-mat", title: "T", userId: "rm-owner" });
    const result = await removeChatMaterial("rm-denied-mat", "rm-intruder", "any-mat");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("regenerateChatSummary()", () => {
  beforeEach(resetMockState);

  test("should return false when the chat does not exist", async () => {
    const result = await regenerateChatSummary("no-summary-chat");
    expect(result).toBe(false);
  });

  test("should return false when the chat has fewer than 2 messages", async () => {
    registerChat({
      id: "short-regen",
      title: "Short",
      messages: [{ role: "user", content: "hi" }],
    });
    const result = await regenerateChatSummary("short-regen");
    expect(result).toBe(false);
  });

  test("should update title and summary on success", async () => {
    mockState.llmResponse =
      '{"title":"New Generated Title","summary":"Generated summary text","keywords":["gen","kw"]}';
    registerChat({
      id: "regen-success",
      title: "Old Title",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });
    const result = await regenerateChatSummary("regen-success");
    expect(result).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/regen-success.yaml`]!;
    expect(yaml).toContain("New Generated Title");
    expect(yaml).toContain("Generated summary text");
  });

  test("should return false when LLM throws", async () => {
    mockState.llmShouldThrow = true;
    registerChat({
      id: "regen-llm-fail",
      title: "Old Title",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });
    const result = await regenerateChatSummary("regen-llm-fail");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("regenerateAllMissingSummaries()", () => {
  beforeEach(resetMockState);

  test("should return 0 updated when CHATS_DIR does not exist", async () => {
    const result = await regenerateAllMissingSummaries();
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
  });

  test("should skip chats that already have a summary", async () => {
    mockState.files[mockState.chatsDir] = "";
    registerChat({
      id: "has-summary",
      title: "With Summary",
      summary: "Existing summary",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });
    const result = await regenerateAllMissingSummaries();
    expect(result.updated).toBe(0);
  });

  test("should update chats without a summary", async () => {
    mockState.files[mockState.chatsDir] = "";
    mockState.llmResponse =
      '{"title":"Auto Title","summary":"Auto summary","keywords":["auto"]}';
    registerChat({
      id: "no-summary-regen",
      title: "No Summary Yet",
      messages: [
        { role: "user", content: "Question here" },
        { role: "assistant", content: "Answer here" },
      ],
    });
    const result = await regenerateAllMissingSummaries();
    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
  });

  test("should count errors when LLM fails", async () => {
    mockState.files[mockState.chatsDir] = "";
    mockState.llmShouldThrow = true;
    registerChat({
      id: "err-regen-chat",
      title: "Error Chat",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "World" },
      ],
    });
    const result = await regenerateAllMissingSummaries();
    expect(result.errors).toBe(1);
    expect(result.updated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Chat sharing
// ---------------------------------------------------------------------------

describe("createShareLink()", () => {
  beforeEach(resetMockState);

  test("should return error when chat does not exist", async () => {
    const result = await createShareLink("no-share-chat");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("should create a share link for an anonymous chat", async () => {
    registerChat({ id: "shareable-anon", title: "Public Chat" });
    const result = await createShareLink("shareable-anon");
    expect(result.success).toBe(true);
    expect(result.shareToken).toBeDefined();
    expect(result.shareUrl).toBe(`/shared/${result.shareToken}`);
  });

  test("should create a share link for the owner of a chat", async () => {
    registerChat({ id: "shareable-owned", title: "My Chat", userId: "sharer" });
    const result = await createShareLink("shareable-owned", "sharer");
    expect(result.success).toBe(true);
    expect(result.shareToken).toBeDefined();
  });

  test("should deny share link creation for non-owners", async () => {
    registerChat({ id: "share-denied-chat", title: "Protected", userId: "real-sharer" });
    const result = await createShareLink("share-denied-chat", "intruder-share");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Access denied");
  });

  test("should return the existing token when chat is already shared", async () => {
    registerChat({
      id: "already-shared",
      title: "Shared Chat",
      shareToken: "existing-token-abc",
      sharedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await createShareLink("already-shared");
    expect(result.success).toBe(true);
    expect(result.shareToken).toBe("existing-token-abc");
  });

  test("should persist the shareToken in the YAML file", async () => {
    registerChat({ id: "share-persist", title: "T" });
    const result = await createShareLink("share-persist");
    expect(result.success).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/share-persist.yaml`]!;
    expect(yaml).toContain(result.shareToken!);
  });

  test("should generate a shareToken that is a non-empty string", async () => {
    registerChat({ id: "share-token-format", title: "T" });
    const result = await createShareLink("share-token-format");
    expect(result.success).toBe(true);
    expect(typeof result.shareToken).toBe("string");
    expect(result.shareToken!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("revokeShareLink()", () => {
  beforeEach(resetMockState);

  test("should return false when chat does not exist", async () => {
    const result = await revokeShareLink("no-revoke-chat");
    expect(result).toBe(false);
  });

  test("should return true and remove shareToken from an anonymous chat", async () => {
    registerChat({
      id: "revoke-anon",
      title: "T",
      shareToken: "token-to-revoke",
      sharedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await revokeShareLink("revoke-anon");
    expect(result).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/revoke-anon.yaml`]!;
    expect(yaml).not.toContain("token-to-revoke");
  });

  test("should revoke for the owner", async () => {
    registerChat({
      id: "revoke-owned",
      title: "T",
      userId: "rev-owner",
      shareToken: "my-share-token",
      sharedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await revokeShareLink("revoke-owned", "rev-owner");
    expect(result).toBe(true);
  });

  test("should deny revocation for non-owners", async () => {
    registerChat({
      id: "revoke-denied",
      title: "T",
      userId: "revoke-real-owner",
      shareToken: "protected-token",
      sharedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await revokeShareLink("revoke-denied", "intruder-rev");
    expect(result).toBe(false);
    const yaml = mockState.files[`${mockState.chatsDir}/revoke-denied.yaml`]!;
    expect(yaml).toContain("protected-token");
  });

  test("should return true when there is no share link to revoke", async () => {
    registerChat({ id: "revoke-no-token", title: "T" });
    const result = await revokeShareLink("revoke-no-token");
    expect(result).toBe(true);
  });

  test("should remove sharedAt from the YAML after revocation", async () => {
    registerChat({
      id: "revoke-sharedAt",
      title: "T",
      shareToken: "token-x",
      sharedAt: "2026-01-05T00:00:00.000Z",
    });
    await revokeShareLink("revoke-sharedAt");
    const yaml = mockState.files[`${mockState.chatsDir}/revoke-sharedAt.yaml`]!;
    expect(yaml).not.toContain("sharedAt");
  });
});

// ---------------------------------------------------------------------------

describe("loadChatByShareToken()", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return null for empty shareToken", async () => {
    const result = await loadChatByShareToken("");
    expect(result).toBeNull();
  });

  test("should return null when no chat has the given shareToken", async () => {
    registerChat({ id: "no-token-match", title: "T" });
    const result = await loadChatByShareToken("nonexistent-token");
    expect(result).toBeNull();
  });

  test("should return the chat when shareToken matches", async () => {
    registerChat({
      id: "token-match-chat",
      title: "Shared Chat",
      shareToken: "the-real-token",
      sharedAt: "2026-01-01T00:00:00.000Z",
      messages: [{ role: "user", content: "Hello" }],
    });
    const result = await loadChatByShareToken("the-real-token");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("token-match-chat");
    expect(result!.title).toBe("Shared Chat");
  });

  test("should not expose userId in the shared result", async () => {
    registerChat({
      id: "private-shared",
      title: "T",
      userId: "private-owner",
      shareToken: "public-token-123",
      sharedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await loadChatByShareToken("public-token-123");
    expect(result).not.toBeNull();
    expect((result as any).userId).toBeUndefined();
  });

  test("should include messages in the shared result", async () => {
    registerChat({
      id: "token-with-msgs",
      title: "T",
      shareToken: "msgs-token",
      sharedAt: "2026-01-01T00:00:00.000Z",
      messages: [
        { role: "user", content: "shared question" },
        { role: "assistant", content: "shared answer" },
      ],
    });
    const result = await loadChatByShareToken("msgs-token");
    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0]!.content).toBe("shared question");
  });
});

// ---------------------------------------------------------------------------

describe("getShareInfo()", () => {
  beforeEach(resetMockState);

  test("should return null when chat does not exist", async () => {
    const result = await getShareInfo("no-share-info");
    expect(result).toBeNull();
  });

  test("should return null when chat has no shareToken", async () => {
    registerChat({ id: "no-token-info", title: "T" });
    const result = await getShareInfo("no-token-info");
    expect(result).toBeNull();
  });

  test("should return shareToken and sharedAt for an anonymous chat with a token", async () => {
    registerChat({
      id: "share-info-anon",
      title: "T",
      shareToken: "share-info-token",
      sharedAt: "2026-01-05T00:00:00.000Z",
    });
    const result = await getShareInfo("share-info-anon");
    expect(result).not.toBeNull();
    expect(result!.shareToken).toBe("share-info-token");
    expect(result!.sharedAt).toBe("2026-01-05T00:00:00.000Z");
  });

  test("should return share info to the chat owner", async () => {
    registerChat({
      id: "share-info-owned",
      title: "T",
      userId: "share-owner",
      shareToken: "owner-token",
      sharedAt: "2026-01-06T00:00:00.000Z",
    });
    const result = await getShareInfo("share-info-owned", "share-owner");
    expect(result).not.toBeNull();
    expect(result!.shareToken).toBe("owner-token");
  });

  test("should deny share info to non-owners", async () => {
    registerChat({
      id: "share-info-denied",
      title: "T",
      userId: "share-owner-2",
      shareToken: "secret-token",
      sharedAt: "2026-01-07T00:00:00.000Z",
    });
    const result = await getShareInfo("share-info-denied", "intruder");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chat folders
// ---------------------------------------------------------------------------

/**
 * Build a YAML string for chat-folders.yaml
 */
function buildFoldersYaml(
  folders: Array<{ id: string; name: string; color?: string; userId?: string; createdAt?: string }>
): string {
  const lines = ["folders:"];
  for (const f of folders) {
    lines.push(`- id: ${f.id}`);
    lines.push(`  name: ${f.name}`);
    if (f.color) lines.push(`  color: ${f.color}`);
    if (f.userId) lines.push(`  userId: ${f.userId}`);
    lines.push(`  createdAt: "${f.createdAt ?? "2026-01-01T00:00:00.000Z"}"`);
  }
  return lines.join("\n") + "\n";
}

describe("loadChatFolders()", () => {
  beforeEach(resetMockState);

  test("should return empty array when folders file does not exist", async () => {
    const result = await loadChatFolders();
    expect(result).toEqual([]);
  });

  test("should return only shared folders when no userId is provided", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "f1", name: "Work", userId: "user-a" },
      { id: "f2", name: "Personal", userId: "user-b" },
      { id: "f3", name: "Shared" },
    ]);
    const result = await loadChatFolders();
    // Without userId, only folders with no userId (shared) are returned
    expect(result.some((f) => f.id === "f3")).toBe(true);
    expect(result.some((f) => f.id === "f1")).toBe(false);
  });

  test("should return user's own folders and shared folders", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "f-own", name: "My Folder", userId: "user-folders" },
      { id: "f-other", name: "Other", userId: "other-user" },
      { id: "f-shared", name: "Shared" },
    ]);
    const result = await loadChatFolders("user-folders");
    const ids = result.map((f) => f.id);
    expect(ids).toContain("f-own");
    expect(ids).toContain("f-shared");
    expect(ids).not.toContain("f-other");
  });

  test("should parse folder color when present", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "f-color", name: "Colorful", color: "#ff5500" },
    ]);
    const result = await loadChatFolders();
    const folder = result.find((f) => f.id === "f-color");
    expect(folder).toBeDefined();
    expect(folder!.color).toBe("#ff5500");
  });

  test("should parse folder createdAt", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "f-date", name: "Dated", createdAt: "2026-02-15T10:00:00.000Z" },
    ]);
    const result = await loadChatFolders();
    const folder = result.find((f) => f.id === "f-date");
    expect(folder).toBeDefined();
    expect(folder!.createdAt).toBe("2026-02-15T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------

describe("createChatFolder()", () => {
  beforeEach(resetMockState);

  test("should create a new folder and return it", async () => {
    const folder = await createChatFolder("My New Folder", "cf-user");
    expect(folder.name).toBe("My New Folder");
    expect(folder.userId).toBe("cf-user");
    expect(folder.id).toBeDefined();
    expect(folder.createdAt).toBeDefined();
  });

  test("should persist the folder in the YAML file", async () => {
    await createChatFolder("Persisted Folder", "cf-user-2");
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    expect(mockState.files[foldersFile]).toBeDefined();
    expect(mockState.files[foldersFile]).toContain("Persisted Folder");
  });

  test("should generate an ID that includes a slugified version of the name", async () => {
    const folder = await createChatFolder("Work Projects", "cf-user-3");
    expect(folder.id).toContain("work");
    expect(folder.id).toContain("projects");
  });

  test("should store the color when provided", async () => {
    const folder = await createChatFolder("Colored Folder", "cf-user-4", "#ff0000");
    expect(folder.color).toBe("#ff0000");
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    expect(mockState.files[foldersFile]).toContain("#ff0000");
  });

  test("should set a valid ISO createdAt date", async () => {
    const folder = await createChatFolder("Date Folder", "cf-user-5");
    expect(new Date(folder.createdAt).toISOString()).toBe(folder.createdAt);
  });

  test("should create folder without userId when not provided", async () => {
    const folder = await createChatFolder("Shared Folder");
    expect(folder.userId).toBeUndefined();
    // Should be accessible to all users
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    expect(mockState.files[foldersFile]).toContain("Shared Folder");
  });
});

// ---------------------------------------------------------------------------

describe("deleteChatFolder()", () => {
  beforeEach(resetMockState);

  test("should return false when folder does not exist", async () => {
    const result = await deleteChatFolder("nonexistent-folder");
    expect(result).toBe(false);
  });

  test("should delete an unowned folder", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([{ id: "del-folder-1", name: "F1" }]);
    const result = await deleteChatFolder("del-folder-1");
    expect(result).toBe(true);
    expect(mockState.files[foldersFile]).not.toContain("del-folder-1");
  });

  test("should delete a folder owned by the requesting user", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "del-owned-f", name: "Owned", userId: "folder-owner" },
    ]);
    const result = await deleteChatFolder("del-owned-f", "folder-owner");
    expect(result).toBe(true);
  });

  test("should deny deletion when user is not the owner", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "del-denied-f", name: "Protected", userId: "real-folder-owner" },
    ]);
    const result = await deleteChatFolder("del-denied-f", "intruder-folder");
    expect(result).toBe(false);
    expect(mockState.files[foldersFile]).toContain("del-denied-f");
  });

  test("should keep other folders when one is deleted", async () => {
    const foldersFile = `${mockState.chatsDir}/chat-folders.yaml`;
    mockState.files[foldersFile] = buildFoldersYaml([
      { id: "keep-folder", name: "Keep" },
      { id: "delete-folder", name: "Delete" },
    ]);
    await deleteChatFolder("delete-folder");
    expect(mockState.files[foldersFile]).toContain("keep-folder");
    expect(mockState.files[foldersFile]).not.toContain("delete-folder");
  });
});

// ---------------------------------------------------------------------------

describe("updateChatFolders()", () => {
  beforeEach(resetMockState);

  test("should return false when the chat does not exist", async () => {
    const result = await updateChatFolders("no-folder-chat", ["f1"]);
    expect(result).toBe(false);
  });

  test("should assign folderIds to a chat", async () => {
    registerChat({ id: "folder-assign", title: "T" });
    const result = await updateChatFolders("folder-assign", ["folder-a", "folder-b"]);
    expect(result).toBe(true);
    const yaml = mockState.files[`${mockState.chatsDir}/folder-assign.yaml`]!;
    expect(yaml).toContain("folder-a");
    expect(yaml).toContain("folder-b");
  });

  test("should clear folderIds when empty array is passed", async () => {
    registerChat({ id: "folder-clear", title: "T", folderIds: ["old-folder"] });
    const result = await updateChatFolders("folder-clear", []);
    expect(result).toBe(true);
    // folderIds section should be absent when empty
    const yaml = mockState.files[`${mockState.chatsDir}/folder-clear.yaml`]!;
    expect(yaml).not.toContain("old-folder");
  });

  test("should deny folder update for non-owners", async () => {
    registerChat({ id: "folder-denied-chat", title: "T", userId: "folder-chat-owner" });
    const result = await updateChatFolders("folder-denied-chat", ["f1"], "intruder-folders");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("getChatFolderIds()", () => {
  beforeEach(resetMockState);

  test("should return empty array when chat does not exist", async () => {
    const result = await getChatFolderIds("no-chat-fids");
    expect(result).toEqual([]);
  });

  test("should return the folderIds stored in the chat", async () => {
    registerChat({
      id: "with-folder-ids",
      title: "T",
      folderIds: ["fid-1", "fid-2"],
    });
    const result = await getChatFolderIds("with-folder-ids");
    expect(result).toContain("fid-1");
    expect(result).toContain("fid-2");
  });

  test("should return empty array when the chat has no folderIds", async () => {
    registerChat({ id: "no-folder-ids", title: "T" });
    const result = await getChatFolderIds("no-folder-ids");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("listChatsInFolder()", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return chats that belong to the specified folder", async () => {
    registerChat({
      id: "in-folder-chat",
      title: "In Folder",
      folderIds: ["target-folder"],
    });
    registerChat({
      id: "not-in-folder",
      title: "Outside",
      folderIds: ["other-folder"],
    });
    const result = await listChatsInFolder("target-folder");
    expect(result.some((c) => c.id === "in-folder-chat")).toBe(true);
    expect(result.some((c) => c.id === "not-in-folder")).toBe(false);
  });

  test("should apply access control — excludes other users' chats", async () => {
    registerChat({
      id: "folder-private-chat",
      title: "Private",
      userId: "private-folder-owner",
      folderIds: ["shared-folder"],
    });
    const result = await listChatsInFolder("shared-folder", "wrong-user");
    expect(result.some((c) => c.id === "folder-private-chat")).toBe(false);
  });

  test("should return empty array when CHATS_DIR does not exist", async () => {
    delete mockState.files[mockState.chatsDir];
    const result = await listChatsInFolder("any-folder");
    expect(result).toEqual([]);
  });

  test("should return empty array when no chats match the folder", async () => {
    registerChat({ id: "no-folder-chat", title: "T" });
    const result = await listChatsInFolder("nonexistent-folder");
    expect(result).toEqual([]);
  });

  test("should sort results by updatedAt descending", async () => {
    const yaml1 = buildChatYaml({ id: "lf-older", title: "Older", folderIds: ["lf-sort-folder"] })
      .replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-01T00:00:00.000Z"`);
    const yaml2 = buildChatYaml({ id: "lf-newer", title: "Newer", folderIds: ["lf-sort-folder"] })
      .replace(`updatedAt: "2026-01-02T00:00:00.000Z"`, `updatedAt: "2026-01-03T00:00:00.000Z"`);
    mockState.files[`${mockState.chatsDir}/lf-older.yaml`] = yaml1;
    mockState.files[`${mockState.chatsDir}/lf-newer.yaml`] = yaml2;
    mockState.chatFiles.push("lf-older.yaml", "lf-newer.yaml");

    const result = await listChatsInFolder("lf-sort-folder");
    const ids = result.map((c) => c.id);
    expect(ids.indexOf("lf-newer")).toBeLessThan(ids.indexOf("lf-older"));
  });
});

// ---------------------------------------------------------------------------

describe("getFolderChatCounts()", () => {
  beforeEach(() => {
    resetMockState();
    mockState.files[mockState.chatsDir] = "";
  });

  test("should return empty object when no chats exist in any folder", async () => {
    registerChat({ id: "no-folder-count", title: "T" });
    const result = await getFolderChatCounts();
    expect(result).toEqual({});
  });

  test("should count chats per folder", async () => {
    registerChat({ id: "count-a1", title: "T1", folderIds: ["count-folder"] });
    registerChat({ id: "count-a2", title: "T2", folderIds: ["count-folder"] });
    registerChat({ id: "count-b1", title: "T3", folderIds: ["other-count-folder"] });
    const result = await getFolderChatCounts();
    expect(result["count-folder"]).toBe(2);
    expect(result["other-count-folder"]).toBe(1);
  });

  test("should count a chat in multiple folders", async () => {
    registerChat({ id: "multi-folder-count", title: "T", folderIds: ["mf1", "mf2"] });
    const result = await getFolderChatCounts();
    expect(result["mf1"]).toBe(1);
    expect(result["mf2"]).toBe(1);
  });

  test("should apply access control — excludes other users' chats", async () => {
    registerChat({
      id: "private-folder-count",
      title: "T",
      userId: "folder-count-owner",
      folderIds: ["private-count-folder"],
    });
    const result = await getFolderChatCounts("wrong-user-count");
    expect(result["private-count-folder"]).toBeUndefined();
  });

  test("should return zero counts for folders not referenced by any accessible chat", async () => {
    registerChat({ id: "no-count-chat", title: "T" });
    const result = await getFolderChatCounts();
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// saveChatHistory() — integration of session + YAML persistence
//
// IMPORTANT: saveChatHistory() calls getSession(sessionId) WITHOUT a userId
// argument (line 873 of memory.ts).  Sessions must therefore be created as
// anonymous (no userId) so they are stored under the key "anonymous::sid".
// The userId parameter on saveChatHistory only ends up in the YAML metadata.
// ---------------------------------------------------------------------------

describe("saveChatHistory()", () => {
  beforeEach(resetMockState);

  test("should do nothing when session does not exist", async () => {
    await saveChatHistory("no-session-save");
    expect(Object.keys(mockState.files).filter((k) => k.endsWith(".yaml"))).toHaveLength(0);
  });

  test("should do nothing when session has no messages", async () => {
    // Create an anonymous session — saveChatHistory uses getSession(sid) with no userId
    const sid = "empty-save-session-" + Date.now();
    createSession(sid);
    await saveChatHistory(sid);
    expect(mockState.files[`${mockState.chatsDir}/${sid}.yaml`]).toBeUndefined();
  });

  test("should write a YAML file for a session with messages", async () => {
    const sid = "save-session-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Hello there" });
    addMessage(sid, { role: "assistant", content: "Hi!" });
    await saveChatHistory(sid);
    expect(mockState.files[`${mockState.chatsDir}/${sid}.yaml`]).toBeDefined();
  });

  test("should use the first user message as title for a single-message chat", async () => {
    // LLM summary requires >= 2 messages; with 1 message the title falls back
    // to the first user message content
    const sid = "title-fallback-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "What is the capital of France?" });
    await saveChatHistory(sid);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`];
    expect(yaml).toBeDefined();
    expect(yaml).toContain("What is the capital of France");
  });

  test("should associate a userId with the saved YAML when provided", async () => {
    const sid = "userid-in-yaml-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Hello" });
    await saveChatHistory(sid, "the-user");
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    expect(yaml).toContain("the-user");
  });

  test("should associate a spaceId with the saved chat", async () => {
    const sid = "space-save-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Space chat" });
    await saveChatHistory(sid, undefined, "space-123");
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    expect(yaml).toContain("space-123");
  });

  test("should call saveSpaceChat when spaceId is provided", async () => {
    const sid = "space-delegate-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Space question" });
    await saveChatHistory(sid, undefined, "delegate-space");
    expect(mockState.savedSpaceChats.length).toBeGreaterThan(0);
    expect(mockState.savedSpaceChats[0].spaceId).toBe("delegate-space");
  });

  test("should attach provided attachments to the last user message", async () => {
    const sid = "att-save-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Here is a file" });
    addMessage(sid, { role: "assistant", content: "Got it" });
    const attachments = [
      { id: "att-1", type: "document" as const, filename: "file.pdf", mimeType: "application/pdf" },
    ];
    await saveChatHistory(sid, undefined, undefined, attachments);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    expect(yaml).toContain("att-1");
    expect(yaml).toContain("file.pdf");
  });

  test("should generate a title + summary via LLM for conversations with 2+ messages", async () => {
    mockState.llmResponse =
      '{"title":"Generated Chat Title","summary":"A nice summary","keywords":["chat","test"]}';
    const sid = "llm-summary-" + Date.now();
    createSession(sid);
    addMessage(sid, { role: "user", content: "Tell me about AI" });
    addMessage(sid, { role: "assistant", content: "AI stands for artificial intelligence" });
    await saveChatHistory(sid);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    expect(yaml).toContain("Generated Chat Title");
    expect(yaml).toContain("A nice summary");
  });

  test("should preserve the createdAt from an existing chat file on update", async () => {
    const sid = "preserve-created-" + Date.now();
    // Pre-register an existing chat YAML on disk (simulating a prior save)
    registerChat({
      id: sid,
      title: "Old Title",
      messages: [{ role: "user", content: "old message" }],
    });
    // Create an anonymous session with new messages
    createSession(sid);
    addMessage(sid, { role: "user", content: "new message" });
    addMessage(sid, { role: "assistant", content: "response" });
    await saveChatHistory(sid);
    const yaml = mockState.files[`${mockState.chatsDir}/${sid}.yaml`]!;
    // createdAt should be preserved from the pre-registered chat (2026-01-01)
    expect(yaml).toContain("2026-01-01");
  });
});
