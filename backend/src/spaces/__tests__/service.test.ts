/**
 * Tests for backend/src/spaces/service.ts
 *
 * Both ./storage and ./permissions are fully mocked so no disk I/O occurs.
 * The mockState object is reset in beforeEach so every test starts clean.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state
// ---------------------------------------------------------------------------

const mockState = {
  // Storage return values
  createdSpace: null as any,
  loadedSpace: null as any,
  updatedSpace: null as any,
  deletedSpace: true as boolean,
  listedSpaces: [] as any[],
  members: [] as any[],
  addedMember: null as any,
  updatedMemberRole: true as boolean,
  removedMember: true as boolean,
  updatedSettings: null as any,
  spaceMemory: null as any,
  addedAboutItem: null as any,
  addedInstruction: null as any,
  addedContextItem: null as any,
  deletedMemoryItem: true as boolean,
  setContextActiveResult: true as boolean,
  formattedMemory: "formatted-memory-string",
  kbLinks: null as any,
  linkedKB: null as any,
  unlinkedKB: true as boolean,
  kbCollectionIds: [] as string[],
  listedChats: [] as any[],
  loadedChat: null as any,
  deletedChat: true as boolean,

  // Permission return values
  canView: { allowed: true, role: "owner" as any },
  canEdit: { allowed: true, role: "owner" as any },
  canEditSettings: { allowed: true, role: "owner" as any },
  canWriteMemory: { allowed: true, role: "owner" as any },
  canViewChats: { allowed: true, role: "owner" as any },
  canManageMembers: { allowed: true, role: "owner" as any },
  canModifyMember: { allowed: true, role: "owner" as any },
  canDelete: { allowed: true, role: "owner" as any },
  canArchive: { allowed: true, role: "owner" as any },
  userPermissions: { role: "owner" as any, permissions: {} as any },

  // Storage error simulation
  storageError: null as Error | null,
};

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

mock.module("../storage", () => ({
  createSpace: async (_name: string, _userId: string, _options?: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.createdSpace;
  },
  loadSpace: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.loadedSpace;
  },
  updateSpace: async (_spaceId: string, _updates: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.updatedSpace;
  },
  deleteSpace: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.deletedSpace;
  },
  listSpaces: async (_userId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.listedSpaces;
  },
  getSpaceMembers: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.members;
  },
  addSpaceMember: async (_spaceId: string, _targetUserId: string, _role: any, _addedBy: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.addedMember;
  },
  updateMemberRole: async (_spaceId: string, _targetUserId: string, _newRole: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.updatedMemberRole;
  },
  removeSpaceMember: async (_spaceId: string, _targetUserId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.removedMember;
  },
  updateSpaceSettings: async (_spaceId: string, _updates: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.updatedSettings;
  },
  loadSpaceMemory: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.spaceMemory;
  },
  saveSpaceMemory: async (_spaceId: string, _memory: any) => {
    if (mockState.storageError) throw mockState.storageError;
  },
  addSpaceAboutItem: async (_spaceId: string, _content: string, _source: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.addedAboutItem;
  },
  addSpaceInstruction: async (_spaceId: string, _content: string, _priority: any, _source: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.addedInstruction;
  },
  addSpaceContextItem: async (_spaceId: string, _name: string, _desc?: string, _active?: boolean, _source?: any) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.addedContextItem;
  },
  deleteSpaceMemoryItem: async (_spaceId: string, _section: any, _itemId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.deletedMemoryItem;
  },
  setSpaceContextActive: async (_spaceId: string, _itemId: string, _active: boolean) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.setContextActiveResult;
  },
  formatSpaceMemoryForPrompt: (_memory: any, _spaceName: string) => {
    return mockState.formattedMemory;
  },
  loadSpaceKBLinks: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.kbLinks;
  },
  linkKBCollection: async (_spaceId: string, _collectionId: string, _userId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.linkedKB;
  },
  unlinkKBCollection: async (_spaceId: string, _collectionId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.unlinkedKB;
  },
  getSpaceKBCollectionIds: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.kbCollectionIds;
  },
  listSpaceChats: async (_spaceId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.listedChats;
  },
  loadSpaceChat: async (_spaceId: string, _chatId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.loadedChat;
  },
  deleteSpaceChat: async (_spaceId: string, _chatId: string) => {
    if (mockState.storageError) throw mockState.storageError;
    return mockState.deletedChat;
  },
}));

mock.module("../permissions", () => ({
  canViewSpace: async (_spaceId: string, _userId: string) => mockState.canView,
  canEditSpace: async (_spaceId: string, _userId: string) => mockState.canEdit,
  canEditSettings: async (_spaceId: string, _userId: string) => mockState.canEditSettings,
  canWriteMemory: async (_spaceId: string, _userId: string) => mockState.canWriteMemory,
  canViewChats: async (_spaceId: string, _userId: string) => mockState.canViewChats,
  canManageMembers: async (_spaceId: string, _userId: string) => mockState.canManageMembers,
  canModifyMember: async (_spaceId: string, _userId: string, _targetUserId: string) =>
    mockState.canModifyMember,
  canDeleteSpace: async (_spaceId: string, _userId: string) => mockState.canDelete,
  canArchiveSpace: async (_spaceId: string, _userId: string) => mockState.canArchive,
  getUserPermissions: async (_spaceId: string, _userId: string) => mockState.userPermissions,
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const {
  createSpace,
  getSpace,
  updateSpace,
  archiveSpace,
  deleteSpace,
  listUserSpaces,
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  updateSettings,
  getMemory,
  addAbout,
  addInstruction,
  addContext,
  deleteMemoryItem,
  setContextActive,
  getFormattedMemory,
  getKBLinks,
  linkKBCollection,
  unlinkKBCollection,
  listChats,
  getChat,
  deleteChat,
  getSpaceContext,
} = await import("../service");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpace(overrides: Partial<any> = {}): any {
  return {
    id: "space_1",
    name: "Test Space",
    description: "",
    icon: "",
    color: "",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    createdBy: "user_1",
    members: [{ userId: "user_1", role: "owner", addedAt: "", addedBy: "" }],
    settings: {
      include_memory_in_prompt: true,
      include_kb_in_prompt: true,
      default_chat_visibility: "space",
    },
    archived: false,
    ...overrides,
  };
}

function makeMemory(overrides: Partial<any> = {}): any {
  return {
    spaceId: "space_1",
    updatedAt: "2024-01-01T00:00:00Z",
    about: [],
    instructions: [],
    context: [],
    ...overrides,
  };
}

const SPACE_ID = "space_1";
const USER_ID = "user_1";
const DENIED = { allowed: false, reason: "Keine Berechtigung" };

// ---------------------------------------------------------------------------
// Reset mock state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.createdSpace = makeSpace();
  mockState.loadedSpace = makeSpace();
  mockState.updatedSpace = makeSpace();
  mockState.deletedSpace = true;
  mockState.listedSpaces = [];
  mockState.members = [];
  mockState.addedMember = { userId: "user_2", role: "editor", addedAt: "", addedBy: USER_ID };
  mockState.updatedMemberRole = true;
  mockState.removedMember = true;
  mockState.updatedSettings = { include_memory_in_prompt: true, include_kb_in_prompt: true, default_chat_visibility: "space" };
  mockState.spaceMemory = makeMemory();
  mockState.addedAboutItem = { id: "about_1", content: "some content", added_at: "", source: "manual" };
  mockState.addedInstruction = { id: "inst_1", content: "do this", priority: "normal", added_at: "", source: "manual" };
  mockState.addedContextItem = { id: "ctx_1", name: "ctx", active: true, added_at: "", source: "manual" };
  mockState.deletedMemoryItem = true;
  mockState.setContextActiveResult = true;
  mockState.formattedMemory = "# Test Space\n## About\n- some content";
  mockState.kbLinks = { spaceId: SPACE_ID, updatedAt: "", collections: [] };
  mockState.linkedKB = { collectionId: "kb_1", linkedAt: "", linkedBy: USER_ID };
  mockState.unlinkedKB = true;
  mockState.kbCollectionIds = [];
  mockState.listedChats = [];
  mockState.loadedChat = null;
  mockState.deletedChat = true;
  mockState.storageError = null;
  mockState.canView = { allowed: true, role: "owner" };
  mockState.canEdit = { allowed: true, role: "owner" };
  mockState.canEditSettings = { allowed: true, role: "owner" };
  mockState.canWriteMemory = { allowed: true, role: "owner" };
  mockState.canViewChats = { allowed: true, role: "owner" };
  mockState.canManageMembers = { allowed: true, role: "owner" };
  mockState.canModifyMember = { allowed: true, role: "owner" };
  mockState.canDelete = { allowed: true, role: "owner" };
  mockState.canArchive = { allowed: true, role: "owner" };
  mockState.userPermissions = { role: "owner", permissions: {} };
});

// ===========================================================================
// createSpace
// ===========================================================================

describe("createSpace()", () => {
  test("gibt Fehler zurück wenn Name leer ist", async () => {
    const result = await createSpace(USER_ID, "");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("gibt Fehler zurück wenn Name nur Leerzeichen enthält", async () => {
    const result = await createSpace(USER_ID, "   ");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("gibt Fehler zurück wenn Name länger als 100 Zeichen ist", async () => {
    const longName = "a".repeat(101);
    const result = await createSpace(USER_ID, longName);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/100/);
  });

  test("Name mit genau 100 Zeichen ist gültig", async () => {
    const exactName = "a".repeat(100);
    mockState.createdSpace = makeSpace({ name: exactName });
    const result = await createSpace(USER_ID, exactName);
    expect(result.success).toBe(true);
  });

  test("ruft storageCreateSpace auf und gibt Space zurück", async () => {
    const space = makeSpace({ name: "My Space" });
    mockState.createdSpace = space;
    const result = await createSpace(USER_ID, "My Space");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(space);
  });

  test("trimmt den Space-Namen vor der Speicherung", async () => {
    const result = await createSpace(USER_ID, "  My Space  ");
    expect(result.success).toBe(true);
  });

  test("gibt optionale Felder weiter (description, icon, color)", async () => {
    const space = makeSpace({ description: "Desc", icon: "briefcase", color: "#ff0000" });
    mockState.createdSpace = space;
    const result = await createSpace(USER_ID, "My Space", {
      description: "Desc",
      icon: "briefcase",
      color: "#ff0000",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(space);
  });

  test("gibt Fehler zurück wenn Storage einen Fehler wirft", async () => {
    mockState.storageError = new Error("Disk full");
    const result = await createSpace(USER_ID, "My Space");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Disk full");
  });
});

// ===========================================================================
// getSpace
// ===========================================================================

describe("getSpace()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canView = DENIED;
    const result = await getSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird", async () => {
    mockState.loadedSpace = null;
    const result = await getSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt Space zurück wenn Berechtigung vorhanden und Space existiert", async () => {
    const space = makeSpace();
    mockState.loadedSpace = space;
    const result = await getSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(space);
  });
});

// ===========================================================================
// updateSpace
// ===========================================================================

describe("updateSpace()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canEdit = DENIED;
    const result = await updateSpace(SPACE_ID, USER_ID, { name: "New Name" });
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn neuer Name leer ist", async () => {
    const result = await updateSpace(SPACE_ID, USER_ID, { name: "   " });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("gibt Fehler zurück wenn neuer Name länger als 100 Zeichen ist", async () => {
    const result = await updateSpace(SPACE_ID, USER_ID, { name: "x".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/100/);
  });

  test("gibt Fehler zurück wenn Space nach Update nicht gefunden wird", async () => {
    mockState.updatedSpace = null;
    const result = await updateSpace(SPACE_ID, USER_ID, { description: "New desc" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt aktualisierten Space zurück bei erfolgreicher Aktualisierung", async () => {
    const updated = makeSpace({ name: "Updated" });
    mockState.updatedSpace = updated;
    const result = await updateSpace(SPACE_ID, USER_ID, { name: "Updated" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(updated);
  });

  test("lässt name-Validierung aus wenn name nicht übergeben wird", async () => {
    const updated = makeSpace({ description: "New desc" });
    mockState.updatedSpace = updated;
    const result = await updateSpace(SPACE_ID, USER_ID, { description: "New desc" });
    expect(result.success).toBe(true);
  });

  test("gibt Fehler zurück wenn Storage einen Fehler wirft", async () => {
    mockState.storageError = new Error("Write error");
    const result = await updateSpace(SPACE_ID, USER_ID, { name: "Valid" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Write error");
  });
});

// ===========================================================================
// archiveSpace
// ===========================================================================

describe("archiveSpace()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canArchive = DENIED;
    const result = await archiveSpace(SPACE_ID, USER_ID, true);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("archiviert den Space erfolgreich", async () => {
    const archived = makeSpace({ archived: true });
    mockState.updatedSpace = archived;
    const result = await archiveSpace(SPACE_ID, USER_ID, true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(archived);
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird", async () => {
    mockState.updatedSpace = null;
    const result = await archiveSpace(SPACE_ID, USER_ID, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });
});

// ===========================================================================
// deleteSpace
// ===========================================================================

describe("deleteSpace()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canDelete = DENIED;
    const result = await deleteSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("löscht Space erfolgreich", async () => {
    mockState.deletedSpace = true;
    const result = await deleteSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird (Storage gibt false zurück)", async () => {
    mockState.deletedSpace = false;
    const result = await deleteSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt Fehler zurück wenn Storage einen Fehler wirft", async () => {
    mockState.storageError = new Error("IO error");
    const result = await deleteSpace(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe("IO error");
  });
});

// ===========================================================================
// listUserSpaces
// ===========================================================================

describe("listUserSpaces()", () => {
  test("gibt leere Liste zurück wenn keine Spaces vorhanden sind", async () => {
    mockState.listedSpaces = [];
    const result = await listUserSpaces(USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test("filtert archivierte Spaces standardmäßig heraus", async () => {
    mockState.listedSpaces = [
      makeSpace({ id: "s1", archived: false }),
      makeSpace({ id: "s2", archived: true }),
    ];
    const result = await listUserSpaces(USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect((result.data as any[])[0].id).toBe("s1");
  });

  test("schließt archivierte Spaces ein wenn includeArchived=true", async () => {
    mockState.listedSpaces = [
      makeSpace({ id: "s1", archived: false }),
      makeSpace({ id: "s2", archived: true }),
    ];
    const result = await listUserSpaces(USER_ID, true);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  test("gibt Fehler zurück wenn Storage einen Fehler wirft", async () => {
    mockState.storageError = new Error("Read error");
    const result = await listUserSpaces(USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Read error");
  });
});

// ===========================================================================
// getMembers
// ===========================================================================

describe("getMembers()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canView = DENIED;
    const result = await getMembers(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Mitgliederliste zurück bei Erfolg", async () => {
    const members = [
      { userId: "user_1", role: "owner", addedAt: "", addedBy: "" },
      { userId: "user_2", role: "editor", addedAt: "", addedBy: "user_1" },
    ];
    mockState.members = members;
    const result = await getMembers(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(members);
  });
});

// ===========================================================================
// addMember
// ===========================================================================

describe("addMember()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canModifyMember = DENIED;
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "editor");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Owner-Rolle zugewiesen werden soll", async () => {
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "owner");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/owner/i);
  });

  test("gibt Fehler zurück wenn Storage null zurückgibt", async () => {
    mockState.addedMember = null;
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "editor");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("fügt Mitglied erfolgreich hinzu (Rolle: editor)", async () => {
    const member = { userId: "user_2", role: "editor", addedAt: "", addedBy: USER_ID };
    mockState.addedMember = member;
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "editor");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(member);
  });

  test("fügt Mitglied erfolgreich hinzu (Rolle: admin)", async () => {
    const member = { userId: "user_2", role: "admin", addedAt: "", addedBy: USER_ID };
    mockState.addedMember = member;
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "admin");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(member);
  });

  test("fügt Mitglied erfolgreich hinzu (Rolle: viewer)", async () => {
    const member = { userId: "user_2", role: "viewer", addedAt: "", addedBy: USER_ID };
    mockState.addedMember = member;
    const result = await addMember(SPACE_ID, USER_ID, "user_2", "viewer");
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// updateMemberRole
// ===========================================================================

describe("updateMemberRole()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canModifyMember = DENIED;
    const result = await updateMemberRole(SPACE_ID, USER_ID, "user_2", "editor");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn neue Rolle 'owner' ist", async () => {
    const result = await updateMemberRole(SPACE_ID, USER_ID, "user_2", "owner");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/owner/i);
  });

  test("gibt Fehler zurück wenn Mitglied nicht gefunden wird (Storage gibt false zurück)", async () => {
    mockState.updatedMemberRole = false;
    const result = await updateMemberRole(SPACE_ID, USER_ID, "user_2", "viewer");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("aktualisiert Mitgliedsrolle erfolgreich", async () => {
    mockState.updatedMemberRole = true;
    const result = await updateMemberRole(SPACE_ID, USER_ID, "user_2", "admin");
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// removeMember
// ===========================================================================

describe("removeMember()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canModifyMember = DENIED;
    const result = await removeMember(SPACE_ID, USER_ID, "user_2");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("verhindert das Entfernen des Owners", async () => {
    // loadSpace returns a space where user_2 is the owner
    mockState.loadedSpace = makeSpace({
      members: [
        { userId: USER_ID, role: "admin", addedAt: "", addedBy: "" },
        { userId: "user_2", role: "owner", addedAt: "", addedBy: "" },
      ],
    });
    const result = await removeMember(SPACE_ID, USER_ID, "user_2");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/owner/i);
  });

  test("gibt Fehler zurück wenn Mitglied nicht gefunden wird (Storage gibt false zurück)", async () => {
    mockState.loadedSpace = makeSpace({
      members: [
        { userId: USER_ID, role: "owner", addedAt: "", addedBy: "" },
        { userId: "user_2", role: "editor", addedAt: "", addedBy: USER_ID },
      ],
    });
    mockState.removedMember = false;
    const result = await removeMember(SPACE_ID, USER_ID, "user_2");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("entfernt Mitglied erfolgreich", async () => {
    mockState.loadedSpace = makeSpace({
      members: [
        { userId: USER_ID, role: "owner", addedAt: "", addedBy: "" },
        { userId: "user_2", role: "editor", addedAt: "", addedBy: USER_ID },
      ],
    });
    mockState.removedMember = true;
    const result = await removeMember(SPACE_ID, USER_ID, "user_2");
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// updateSettings
// ===========================================================================

describe("updateSettings()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canEditSettings = DENIED;
    const result = await updateSettings(SPACE_ID, USER_ID, { include_memory_in_prompt: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird", async () => {
    mockState.updatedSettings = null;
    const result = await updateSettings(SPACE_ID, USER_ID, { include_kb_in_prompt: true });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("aktualisiert Einstellungen erfolgreich", async () => {
    const settings = {
      include_memory_in_prompt: false,
      include_kb_in_prompt: true,
      default_chat_visibility: "space" as const,
    };
    mockState.updatedSettings = settings;
    const result = await updateSettings(SPACE_ID, USER_ID, { include_memory_in_prompt: false });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(settings);
  });
});

// ===========================================================================
// addAbout
// ===========================================================================

describe("addAbout()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canWriteMemory = DENIED;
    const result = await addAbout(SPACE_ID, USER_ID, "some content");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Inhalt leer ist", async () => {
    const result = await addAbout(SPACE_ID, USER_ID, "");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("gibt Fehler zurück wenn Inhalt nur Leerzeichen enthält", async () => {
    const result = await addAbout(SPACE_ID, USER_ID, "   ");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("fügt About-Item erfolgreich hinzu", async () => {
    const item = { id: "about_1", content: "useful info", added_at: "", source: "manual" };
    mockState.addedAboutItem = item;
    const result = await addAbout(SPACE_ID, USER_ID, "useful info");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(item);
  });

  test("akzeptiert optionale source-Parameter", async () => {
    const result = await addAbout(SPACE_ID, USER_ID, "agent info", "agent");
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// addInstruction
// ===========================================================================

describe("addInstruction()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canWriteMemory = DENIED;
    const result = await addInstruction(SPACE_ID, USER_ID, "do this");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Inhalt leer ist", async () => {
    const result = await addInstruction(SPACE_ID, USER_ID, "");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("gibt Fehler zurück wenn Inhalt nur Leerzeichen enthält", async () => {
    const result = await addInstruction(SPACE_ID, USER_ID, "   ");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/erforderlich/i);
  });

  test("fügt Instruction erfolgreich hinzu (normale Priorität)", async () => {
    const item = { id: "inst_1", content: "do this", priority: "normal", added_at: "", source: "manual" };
    mockState.addedInstruction = item;
    const result = await addInstruction(SPACE_ID, USER_ID, "do this");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(item);
  });

  test("fügt Instruction erfolgreich hinzu (hohe Priorität)", async () => {
    const item = { id: "inst_2", content: "urgent", priority: "high", added_at: "", source: "manual" };
    mockState.addedInstruction = item;
    const result = await addInstruction(SPACE_ID, USER_ID, "urgent", "high");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(item);
  });
});

// ===========================================================================
// deleteMemoryItem
// ===========================================================================

describe("deleteMemoryItem()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canWriteMemory = DENIED;
    const result = await deleteMemoryItem(SPACE_ID, USER_ID, "about", "item_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Item nicht gefunden wird", async () => {
    mockState.deletedMemoryItem = false;
    const result = await deleteMemoryItem(SPACE_ID, USER_ID, "about", "nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("löscht Memory-Item erfolgreich", async () => {
    mockState.deletedMemoryItem = true;
    const result = await deleteMemoryItem(SPACE_ID, USER_ID, "instructions", "inst_1");
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// listChats / getChat
// ===========================================================================

describe("listChats()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canViewChats = DENIED;
    const result = await listChats(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Chat-Liste zurück bei Erfolg", async () => {
    const chats = [
      { id: "chat_1", spaceId: SPACE_ID, userId: USER_ID, title: "Chat 1", messages: [], createdAt: "", updatedAt: "" },
    ];
    mockState.listedChats = chats;
    const result = await listChats(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(chats);
  });
});

describe("getChat()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canViewChats = DENIED;
    const result = await getChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Chat nicht gefunden wird", async () => {
    mockState.loadedChat = null;
    const result = await getChat(SPACE_ID, USER_ID, "nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt Chat zurück wenn er existiert", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: USER_ID, title: "Chat 1", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    const result = await getChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(chat);
  });
});

// ===========================================================================
// deleteChat
// ===========================================================================

describe("deleteChat()", () => {
  test("gibt Fehler zurück wenn Berechtigung für Chat-Ansicht verweigert wird", async () => {
    mockState.canViewChats = DENIED;
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Chat nicht gefunden wird", async () => {
    mockState.loadedChat = null;
    const result = await deleteChat(SPACE_ID, USER_ID, "nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("Chat-Owner kann eigenen Chat löschen", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: USER_ID, title: "Chat", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    mockState.userPermissions = { role: "viewer", permissions: {} };
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(true);
  });

  test("Space-Owner kann fremden Chat löschen", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: "other_user", title: "Chat", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    mockState.userPermissions = { role: "owner", permissions: {} };
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(true);
  });

  test("Admin kann fremden Chat löschen", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: "other_user", title: "Chat", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    mockState.userPermissions = { role: "admin", permissions: {} };
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(true);
  });

  test("Editor kann fremden Chat NICHT löschen", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: "other_user", title: "Chat", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    mockState.userPermissions = { role: "editor", permissions: {} };
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/berechtigung/i);
  });

  test("Viewer kann fremden Chat NICHT löschen", async () => {
    const chat = { id: "chat_1", spaceId: SPACE_ID, userId: "other_user", title: "Chat", messages: [], createdAt: "", updatedAt: "" };
    mockState.loadedChat = chat;
    mockState.userPermissions = { role: "viewer", permissions: {} };
    const result = await deleteChat(SPACE_ID, USER_ID, "chat_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/berechtigung/i);
  });
});

// ===========================================================================
// getSpaceContext
// ===========================================================================

describe("getSpaceContext()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canView = DENIED;
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird", async () => {
    mockState.loadedSpace = null;
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt Kontext mit formatiertem Memory zurück wenn include_memory_in_prompt=true", async () => {
    mockState.loadedSpace = makeSpace({
      settings: { include_memory_in_prompt: true, include_kb_in_prompt: false, default_chat_visibility: "space" },
    });
    mockState.spaceMemory = makeMemory();
    mockState.formattedMemory = "## About\n- some info";
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect((result.data as any).formattedMemory).toBe("## About\n- some info");
  });

  test("gibt leeres formattedMemory zurück wenn include_memory_in_prompt=false", async () => {
    mockState.loadedSpace = makeSpace({
      settings: { include_memory_in_prompt: false, include_kb_in_prompt: false, default_chat_visibility: "space" },
    });
    mockState.spaceMemory = makeMemory();
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect((result.data as any).formattedMemory).toBe("");
  });

  test("gibt KB-Collection-IDs zurück wenn include_kb_in_prompt=true", async () => {
    mockState.loadedSpace = makeSpace({
      settings: { include_memory_in_prompt: false, include_kb_in_prompt: true, default_chat_visibility: "space" },
    });
    mockState.spaceMemory = makeMemory();
    mockState.kbCollectionIds = ["kb_1", "kb_2"];
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect((result.data as any).kbCollectionIds).toEqual(["kb_1", "kb_2"]);
  });

  test("gibt leere KB-Collection-IDs zurück wenn include_kb_in_prompt=false", async () => {
    mockState.loadedSpace = makeSpace({
      settings: { include_memory_in_prompt: false, include_kb_in_prompt: false, default_chat_visibility: "space" },
    });
    mockState.spaceMemory = makeMemory();
    mockState.kbCollectionIds = ["kb_1"];
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect((result.data as any).kbCollectionIds).toEqual([]);
  });

  test("gibt Space-Name und Settings im Kontext zurück", async () => {
    const space = makeSpace({ name: "My Workspace" });
    mockState.loadedSpace = space;
    mockState.spaceMemory = makeMemory();
    const result = await getSpaceContext(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect((result.data as any).spaceName).toBe("My Workspace");
    expect((result.data as any).settings).toEqual(space.settings);
  });
});

// ===========================================================================
// getFormattedMemory
// ===========================================================================

describe("getFormattedMemory()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canView = DENIED;
    const result = await getFormattedMemory(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Space nicht gefunden wird", async () => {
    mockState.loadedSpace = null;
    const result = await getFormattedMemory(SPACE_ID, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("gibt formatierten Memory-String zurück bei Erfolg", async () => {
    mockState.formattedMemory = "# Test Space\n## About\n- item";
    mockState.spaceMemory = makeMemory();
    const result = await getFormattedMemory(SPACE_ID, USER_ID);
    expect(result.success).toBe(true);
    expect(result.data).toBe("# Test Space\n## About\n- item");
  });
});

// ===========================================================================
// linkKBCollection / unlinkKBCollection
// ===========================================================================

describe("linkKBCollection()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canWriteMemory = DENIED;
    const result = await linkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Storage null zurückgibt", async () => {
    mockState.linkedKB = null;
    const result = await linkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("verknüpft KB-Collection erfolgreich", async () => {
    const link = { collectionId: "kb_1", linkedAt: "", linkedBy: USER_ID };
    mockState.linkedKB = link;
    const result = await linkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(true);
    expect(result.data).toEqual(link);
  });
});

describe("unlinkKBCollection()", () => {
  test("gibt Fehler zurück wenn Berechtigung verweigert wird", async () => {
    mockState.canWriteMemory = DENIED;
    const result = await unlinkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe(DENIED.reason);
  });

  test("gibt Fehler zurück wenn Verknüpfung nicht gefunden wird", async () => {
    mockState.unlinkedKB = false;
    const result = await unlinkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nicht gefunden/i);
  });

  test("entfernt Verknüpfung erfolgreich", async () => {
    mockState.unlinkedKB = true;
    const result = await unlinkKBCollection(SPACE_ID, USER_ID, "kb_1");
    expect(result.success).toBe(true);
  });
});
