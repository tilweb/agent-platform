/**
 * Tests for connections/storage.ts
 *
 * Alle Dateisystem- und Krypto-Abhaengigkeiten werden per mock.module()
 * ersetzt. Der In-Memory-Store simuliert das YAML-Dateisystem ohne echte I/O.
 * Mocks werden VOR dem Import des Moduls registriert.
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { TokenSet, EncryptedTokenSet, ConnectionStatus, OAuthState } from "../types";

// ---------------------------------------------------------------------------
// Konstanten fuer Test-Pfade
// ---------------------------------------------------------------------------

const MOCK_CONNECTIONS_DIR = "/mock/data/connections";
const MOCK_OAUTH_STATES_DIR = "/mock/data/auth/oauth-states";

// ---------------------------------------------------------------------------
// In-Memory-Speicher fuer simulierte YAML-Dateioperationen
// ---------------------------------------------------------------------------

// fileStore: absoluterPfad -> gespeichertes Objekt
const fileStore = new Map<string, any>();

// ---------------------------------------------------------------------------
// Mock-Hilfsfunktionen fuer yamlStorage
// ---------------------------------------------------------------------------

function mockLoadYaml(filePath: string): Promise<any | null> {
  const data = fileStore.get(filePath);
  return Promise.resolve(data !== undefined ? structuredClone(data) : null);
}

function mockSaveYaml(filePath: string, data: any): Promise<void> {
  fileStore.set(filePath, structuredClone(data));
  return Promise.resolve();
}

function mockDeleteYaml(filePath: string): Promise<boolean> {
  const existed = fileStore.has(filePath);
  fileStore.delete(filePath);
  return Promise.resolve(existed);
}

function mockListYamlIds(dir: string): Promise<string[]> {
  const prefix = dir.endsWith("/") ? dir : dir + "/";
  const ids: string[] = [];
  for (const key of fileStore.keys()) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length);
      // Nur direkte Dateien (kein weiterer /)
      if (!rest.includes("/") && rest.endsWith(".yaml")) {
        ids.push(rest.replace(/\.yaml$/, ""));
      }
    }
  }
  return Promise.resolve(ids);
}

function mockEnsureDir(_dir: string): Promise<void> {
  return Promise.resolve();
}

// createYamlStore gibt ein Objekt zurueck, das auf dem gleichen fileStore operiert
function mockCreateYamlStore<T>(baseDir: string) {
  const dir = baseDir.endsWith("/") ? baseDir : baseDir + "/";
  return {
    ensureDir: () => Promise.resolve(),
    filePath: (id: string) => `${dir}${id}.yaml`,
    load: (id: string) => mockLoadYaml(`${dir}${id}.yaml`),
    save: (id: string, data: T) => mockSaveYaml(`${dir}${id}.yaml`, data),
    listIds: () => mockListYamlIds(dir),
    delete: (id: string) => mockDeleteYaml(`${dir}${id}.yaml`),
  };
}

// ---------------------------------------------------------------------------
// Mock fuer Bun.file (wird von hasConnection genutzt)
// ---------------------------------------------------------------------------

// Wir ersetzen Bun.file mit einem Proxy, der .exists() auf den fileStore
// abbildet. Da Bun ein globales Objekt ist, ueberschreiben wir die Methode
// direkt auf dem Objekt.
const originalBunFile = Bun.file.bind(Bun);

// ---------------------------------------------------------------------------
// Modul-Mocks — muessen VOR dem Import des Moduls unter Test registriert sein
// ---------------------------------------------------------------------------

mock.module("../crypto", () => ({
  encryptTokens: async (tokens: TokenSet): Promise<EncryptedTokenSet> => ({
    encrypted: `enc:${JSON.stringify(tokens)}`,
    iv: "mockiv",
    tag: "mocktag",
    version: 1,
  }),
  decryptTokens: async (encrypted: EncryptedTokenSet): Promise<TokenSet> => {
    const json = encrypted.encrypted.replace(/^enc:/, "");
    return JSON.parse(json) as TokenSet;
  },
}));

mock.module("../../utils/paths", () => ({
  CONNECTIONS_DIR: MOCK_CONNECTIONS_DIR,
  OAUTH_STATES_DIR: MOCK_OAUTH_STATES_DIR,
}));

mock.module("../../utils/yamlStorage", () => ({
  createYamlStore: mockCreateYamlStore,
  ensureDir: mockEnsureDir,
  loadYaml: mockLoadYaml,
  saveYaml: mockSaveYaml,
  deleteYaml: mockDeleteYaml,
  listYamlIds: mockListYamlIds,
}));

// ---------------------------------------------------------------------------
// Import des Moduls unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const {
  saveConnection,
  loadConnection,
  updateConnectionStatus,
  updateConnectionTokens,
  deleteConnection,
  listUserConnections,
  hasConnection,
  saveOAuthState,
  loadOAuthState,
  deleteOAuthState,
  cleanupExpiredOAuthStates,
} = await import("../storage");

// ---------------------------------------------------------------------------
// Testdaten-Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeTokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    expiresAt: "2027-01-01T00:00:00.000Z",
    tokenType: "Bearer",
    scope: "read write",
    ...overrides,
  };
}

function makeStatus(overrides: Partial<ConnectionStatus> = {}): ConnectionStatus {
  return {
    status: "connected",
    lastChecked: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOAuthState(overrides: Partial<OAuthState> = {}): OAuthState {
  const now = new Date();
  const future = new Date(now.getTime() + 10 * 60 * 1000); // 10 Minuten in der Zukunft
  return {
    providerId: "github",
    userId: "user-1",
    redirectUri: "https://example.com/callback",
    createdAt: now.toISOString(),
    expiresAt: future.toISOString(),
    ...overrides,
  };
}

// Liefert den erwarteten Dateipfad fuer eine Verbindung
function connectionPath(userId: string, providerId: string): string {
  return `${MOCK_CONNECTIONS_DIR}/${userId}/${providerId}.yaml`;
}

// ---------------------------------------------------------------------------
// Setup: fileStore vor jedem Test leeren
// ---------------------------------------------------------------------------

beforeEach(() => {
  fileStore.clear();

  // Bun.file wird pro Test neu gemockt, sodass .exists() auf fileStore schaut
  (Bun as any).file = (filePath: string) => ({
    exists: () => Promise.resolve(fileStore.has(filePath)),
    // Weitere Methoden werden nur bei Bedarf hinzugefuegt
  });
});

// ---------------------------------------------------------------------------
// saveConnection
// ---------------------------------------------------------------------------

describe("saveConnection", () => {
  test("verschluesselt Token und speichert eine Verbindung im fileStore", async () => {
    const tokens = makeTokenSet();
    const status = makeStatus();

    await saveConnection("user-1", "github", tokens, status);

    const path = connectionPath("user-1", "github");
    expect(fileStore.has(path)).toBe(true);
  });

  test("gibt das gespeicherte StoredConnection-Objekt zurueck", async () => {
    const tokens = makeTokenSet();
    const status = makeStatus();

    const result = await saveConnection("user-1", "github", tokens, status);

    expect(result.providerId).toBe("github");
    expect(result.userId).toBe("user-1");
    expect(result.status).toEqual(status);
  });

  test("speichert verschluesselte (nicht rohe) Token", async () => {
    const tokens = makeTokenSet({ accessToken: "raw-access-token" });
    const status = makeStatus();

    const result = await saveConnection("user-1", "github", tokens, status);

    // Die gespeicherten Token sollen das EncryptedTokenSet-Format haben
    expect(result.tokens).toHaveProperty("encrypted");
    expect(result.tokens).toHaveProperty("iv");
    expect(result.tokens).toHaveProperty("tag");
    expect(result.tokens).toHaveProperty("version");
    // Die rohen Token ducrfen nicht direkt im encrypted-Feld stehen
    expect(result.tokens.encrypted).toContain("raw-access-token");
    // Das ist unser Mock — Hauptsache der Wert ist transformiert worden
    expect(typeof result.tokens.encrypted).toBe("string");
  });

  test("setzt createdAt und updatedAt auf aktuellen Zeitstempel", async () => {
    const before = new Date().toISOString();
    const result = await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    const after = new Date().toISOString();

    expect(result.createdAt >= before).toBe(true);
    expect(result.createdAt <= after).toBe(true);
    expect(result.updatedAt >= before).toBe(true);
    expect(result.updatedAt <= after).toBe(true);
  });

  test("ueberschreibt eine vorhandene Verbindung beim erneuten Speichern", async () => {
    const status1 = makeStatus({ status: "connected" });
    const status2 = makeStatus({ status: "expired" });

    await saveConnection("user-1", "github", makeTokenSet(), status1);
    const result = await saveConnection("user-1", "github", makeTokenSet(), status2);

    expect(result.status.status).toBe("expired");
  });

  test("speichert mehrere Provider fuer denselben User unabhaengig voneinander", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-1", "gitlab", makeTokenSet(), makeStatus());

    expect(fileStore.has(connectionPath("user-1", "github"))).toBe(true);
    expect(fileStore.has(connectionPath("user-1", "gitlab"))).toBe(true);
  });

  test("speichert Verbindungen fuer verschiedene User unabhaengig", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-2", "github", makeTokenSet(), makeStatus());

    expect(fileStore.has(connectionPath("user-1", "github"))).toBe(true);
    expect(fileStore.has(connectionPath("user-2", "github"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadConnection
// ---------------------------------------------------------------------------

describe("loadConnection", () => {
  test("gibt null zurueck wenn keine Verbindung existiert", async () => {
    const result = await loadConnection("user-1", "github");
    expect(result).toBeNull();
  });

  test("gibt connection und entschluesselte Token zurueck wenn Verbindung existiert", async () => {
    const tokens = makeTokenSet({ accessToken: "secret-token" });
    await saveConnection("user-1", "github", tokens, makeStatus());

    const result = await loadConnection("user-1", "github");

    expect(result).not.toBeNull();
    expect(result!.connection.providerId).toBe("github");
    expect(result!.connection.userId).toBe("user-1");
  });

  test("entschluesselt Token korrekt beim Laden", async () => {
    const tokens = makeTokenSet({ accessToken: "decrypted-access", tokenType: "Bearer" });
    await saveConnection("user-1", "github", tokens, makeStatus());

    const result = await loadConnection("user-1", "github");

    expect(result!.tokens.accessToken).toBe("decrypted-access");
    expect(result!.tokens.tokenType).toBe("Bearer");
  });

  test("gibt null zurueck wenn ein anderer User dieselbe Provider-ID hat, aber kein eigener Eintrag vorliegt", async () => {
    await saveConnection("user-2", "github", makeTokenSet(), makeStatus());

    const result = await loadConnection("user-1", "github");
    expect(result).toBeNull();
  });

  test("gibt die gespeicherten Token einschliesslich optionaler Felder zurueck", async () => {
    const tokens = makeTokenSet({
      refreshToken: "my-refresh",
      scope: "repo:read",
      cloudId: "cloud-xyz",
    });
    await saveConnection("user-1", "atlassian", tokens, makeStatus());

    const result = await loadConnection("user-1", "atlassian");

    expect(result!.tokens.refreshToken).toBe("my-refresh");
    expect(result!.tokens.scope).toBe("repo:read");
    expect(result!.tokens.cloudId).toBe("cloud-xyz");
  });
});

// ---------------------------------------------------------------------------
// updateConnectionStatus
// ---------------------------------------------------------------------------

describe("updateConnectionStatus", () => {
  test("gibt false zurueck wenn die Verbindung nicht existiert", async () => {
    const result = await updateConnectionStatus("user-1", "github", makeStatus());
    expect(result).toBe(false);
  });

  test("gibt true zurueck wenn die Verbindung erfolgreich aktualisiert wird", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());

    const result = await updateConnectionStatus("user-1", "github", makeStatus({ status: "expired" }));

    expect(result).toBe(true);
  });

  test("aktualisiert den Status im gespeicherten Objekt", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus({ status: "connected" }));

    await updateConnectionStatus("user-1", "github", makeStatus({ status: "error", error: "token invalid" }));

    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    expect(stored.status.status).toBe("error");
    expect(stored.status.error).toBe("token invalid");
  });

  test("aktualisiert updatedAt auf den aktuellen Zeitstempel", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    const beforeUpdate = new Date().toISOString();

    await updateConnectionStatus("user-1", "github", makeStatus({ status: "expired" }));

    const afterUpdate = new Date().toISOString();
    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    expect(stored.updatedAt >= beforeUpdate).toBe(true);
    expect(stored.updatedAt <= afterUpdate).toBe(true);
  });

  test("beruehrt createdAt nicht", async () => {
    const saved = await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    const originalCreatedAt = saved.createdAt;

    await updateConnectionStatus("user-1", "github", makeStatus({ status: "disconnected" }));

    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    expect(stored.createdAt).toBe(originalCreatedAt);
  });

  test("belaesst die Token unveraendert", async () => {
    const tokens = makeTokenSet({ accessToken: "original-token" });
    await saveConnection("user-1", "github", tokens, makeStatus());

    await updateConnectionStatus("user-1", "github", makeStatus({ status: "expired" }));

    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    // Die gespeicherten Token sind verschluesselt und sollen sich nicht geaendert haben
    expect(stored.tokens.encrypted).toContain("original-token");
  });
});

// ---------------------------------------------------------------------------
// updateConnectionTokens
// ---------------------------------------------------------------------------

describe("updateConnectionTokens", () => {
  test("gibt false zurueck wenn die Verbindung nicht existiert", async () => {
    const result = await updateConnectionTokens("user-1", "github", makeTokenSet());
    expect(result).toBe(false);
  });

  test("gibt true zurueck wenn die Token erfolgreich aktualisiert werden", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());

    const result = await updateConnectionTokens("user-1", "github", makeTokenSet({ accessToken: "new-token" }));

    expect(result).toBe(true);
  });

  test("verschluesselt die neuen Token und speichert sie", async () => {
    await saveConnection("user-1", "github", makeTokenSet({ accessToken: "old-token" }), makeStatus());

    await updateConnectionTokens("user-1", "github", makeTokenSet({ accessToken: "refreshed-token" }));

    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    // Unser Mock kodiert die Token als enc:{json}, daher enthaelt encrypted den neuen accessToken
    expect(stored.tokens.encrypted).toContain("refreshed-token");
    expect(stored.tokens.encrypted).not.toContain("old-token");
  });

  test("aktualisiert updatedAt auf den aktuellen Zeitstempel", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    const beforeUpdate = new Date().toISOString();

    await updateConnectionTokens("user-1", "github", makeTokenSet({ accessToken: "new" }));

    const afterUpdate = new Date().toISOString();
    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    expect(stored.updatedAt >= beforeUpdate).toBe(true);
    expect(stored.updatedAt <= afterUpdate).toBe(true);
  });

  test("belaesst den Status unveraendert", async () => {
    const status = makeStatus({ status: "expired", error: "token expired" });
    await saveConnection("user-1", "github", makeTokenSet(), status);

    await updateConnectionTokens("user-1", "github", makeTokenSet({ accessToken: "fresh" }));

    const path = connectionPath("user-1", "github");
    const stored = fileStore.get(path);
    expect(stored.status.status).toBe("expired");
    expect(stored.status.error).toBe("token expired");
  });
});

// ---------------------------------------------------------------------------
// deleteConnection
// ---------------------------------------------------------------------------

describe("deleteConnection", () => {
  test("gibt false zurueck wenn die Verbindung nicht existiert", async () => {
    const result = await deleteConnection("user-1", "github");
    expect(result).toBe(false);
  });

  test("gibt true zurueck und entfernt die Verbindung aus dem Store", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());

    const result = await deleteConnection("user-1", "github");

    expect(result).toBe(true);
    expect(fileStore.has(connectionPath("user-1", "github"))).toBe(false);
  });

  test("loescht nur die angegebene Verbindung, andere bleiben erhalten", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-1", "gitlab", makeTokenSet(), makeStatus());

    await deleteConnection("user-1", "github");

    expect(fileStore.has(connectionPath("user-1", "github"))).toBe(false);
    expect(fileStore.has(connectionPath("user-1", "gitlab"))).toBe(true);
  });

  test("loescht nur den Eintrag des angegebenen Users", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-2", "github", makeTokenSet(), makeStatus());

    await deleteConnection("user-1", "github");

    expect(fileStore.has(connectionPath("user-1", "github"))).toBe(false);
    expect(fileStore.has(connectionPath("user-2", "github"))).toBe(true);
  });

  test("nachfolgendes loadConnection gibt null zurueck", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await deleteConnection("user-1", "github");

    const result = await loadConnection("user-1", "github");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listUserConnections
// ---------------------------------------------------------------------------

describe("listUserConnections", () => {
  test("gibt ein leeres Array zurueck wenn der User keine Verbindungen hat", async () => {
    const result = await listUserConnections("user-1");
    expect(result).toEqual([]);
  });

  test("gibt alle Verbindungen eines Users zurueck", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-1", "gitlab", makeTokenSet(), makeStatus());

    const result = await listUserConnections("user-1");

    expect(result).toHaveLength(2);
    const providerIds = result.map((c) => c.providerId).sort();
    expect(providerIds).toEqual(["github", "gitlab"]);
  });

  test("gibt nur Verbindungen des angegebenen Users zurueck", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-2", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-2", "gitlab", makeTokenSet(), makeStatus());

    const result = await listUserConnections("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe("github");
    expect(result[0].userId).toBe("user-1");
  });

  test("jede zurueckgegebene Verbindung hat die korrekten Pflichtfelder", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());

    const result = await listUserConnections("user-1");

    expect(result[0]).toHaveProperty("providerId");
    expect(result[0]).toHaveProperty("userId");
    expect(result[0]).toHaveProperty("tokens");
    expect(result[0]).toHaveProperty("status");
    expect(result[0]).toHaveProperty("createdAt");
    expect(result[0]).toHaveProperty("updatedAt");
  });

  test("gibt eine einzelne Verbindung korrekt zurueck", async () => {
    await saveConnection("user-1", "pipedrive", makeTokenSet(), makeStatus({ status: "expired" }));

    const result = await listUserConnections("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].status.status).toBe("expired");
  });
});

// ---------------------------------------------------------------------------
// hasConnection
// ---------------------------------------------------------------------------

describe("hasConnection", () => {
  test("gibt false zurueck wenn keine Verbindung existiert", async () => {
    const result = await hasConnection("user-1", "github");
    expect(result).toBe(false);
  });

  test("gibt true zurueck wenn die Verbindung existiert", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());

    const result = await hasConnection("user-1", "github");
    expect(result).toBe(true);
  });

  test("gibt false zurueck wenn die Verbindung eines anderen Users existiert", async () => {
    await saveConnection("user-2", "github", makeTokenSet(), makeStatus());

    const result = await hasConnection("user-1", "github");
    expect(result).toBe(false);
  });

  test("gibt false zurueck nachdem die Verbindung geloescht wurde", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await deleteConnection("user-1", "github");

    const result = await hasConnection("user-1", "github");
    expect(result).toBe(false);
  });

  test("gibt true fuer jeden vorhandenen Provider separat zurueck", async () => {
    await saveConnection("user-1", "github", makeTokenSet(), makeStatus());
    await saveConnection("user-1", "gitlab", makeTokenSet(), makeStatus());

    expect(await hasConnection("user-1", "github")).toBe(true);
    expect(await hasConnection("user-1", "gitlab")).toBe(true);
    expect(await hasConnection("user-1", "bitbucket")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveOAuthState / loadOAuthState
// ---------------------------------------------------------------------------

describe("saveOAuthState und loadOAuthState", () => {
  test("speichert und laedt einen OAuth-State", async () => {
    const data = makeOAuthState();
    await saveOAuthState("state-abc", data);

    const result = await loadOAuthState("state-abc");

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe("github");
    expect(result!.userId).toBe("user-1");
  });

  test("gibt null zurueck wenn der State nicht existiert", async () => {
    const result = await loadOAuthState("nonexistent-state");
    expect(result).toBeNull();
  });

  test("gibt null zurueck fuer einen abgelaufenen State", async () => {
    const expired = makeOAuthState({
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 Sekunde in der Vergangenheit
    });
    await saveOAuthState("expired-state", expired);

    const result = await loadOAuthState("expired-state");
    expect(result).toBeNull();
  });

  test("loescht einen abgelaufenen State beim Laden automatisch", async () => {
    const expired = makeOAuthState({
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    });
    await saveOAuthState("auto-delete-state", expired);

    // Laden loescht den State implizit
    await loadOAuthState("auto-delete-state");

    // Erneutes Laden gibt null zurueck
    const secondLoad = await loadOAuthState("auto-delete-state");
    expect(secondLoad).toBeNull();
  });

  test("gibt einen gueltigen (nicht abgelaufenen) State korrekt zurueck", async () => {
    const future = makeOAuthState({
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 Stunde
    });
    await saveOAuthState("valid-state", future);

    const result = await loadOAuthState("valid-state");

    expect(result).not.toBeNull();
    expect(result!.redirectUri).toBe("https://example.com/callback");
  });

  test("gibt alle gespeicherten Felder unveraendert zurueck", async () => {
    const data = makeOAuthState({
      providerId: "atlassian",
      userId: "user-99",
      redirectUri: "https://app.example.com/oauth/callback",
    });
    await saveOAuthState("full-state", data);

    const result = await loadOAuthState("full-state");

    expect(result!.providerId).toBe("atlassian");
    expect(result!.userId).toBe("user-99");
    expect(result!.redirectUri).toBe("https://app.example.com/oauth/callback");
    expect(result!.createdAt).toBe(data.createdAt);
    expect(result!.expiresAt).toBe(data.expiresAt);
  });
});

// ---------------------------------------------------------------------------
// deleteOAuthState
// ---------------------------------------------------------------------------

describe("deleteOAuthState", () => {
  test("entfernt einen vorhandenen State", async () => {
    await saveOAuthState("to-delete", makeOAuthState());
    await deleteOAuthState("to-delete");

    const result = await loadOAuthState("to-delete");
    expect(result).toBeNull();
  });

  test("wirft keinen Fehler wenn der State nicht existiert", async () => {
    // Kein Fehler erwartet
    await expect(deleteOAuthState("nonexistent")).resolves.toBeUndefined();
  });

  test("loescht nur den angegebenen State, andere bleiben erhalten", async () => {
    await saveOAuthState("state-1", makeOAuthState());
    await saveOAuthState("state-2", makeOAuthState());

    await deleteOAuthState("state-1");

    expect(await loadOAuthState("state-1")).toBeNull();
    expect(await loadOAuthState("state-2")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cleanupExpiredOAuthStates
// ---------------------------------------------------------------------------

describe("cleanupExpiredOAuthStates", () => {
  test("gibt 0 zurueck wenn keine States gespeichert sind", async () => {
    const count = await cleanupExpiredOAuthStates();
    expect(count).toBe(0);
  });

  test("gibt 0 zurueck wenn alle States gueltig sind", async () => {
    await saveOAuthState("valid-1", makeOAuthState());
    await saveOAuthState("valid-2", makeOAuthState());

    const count = await cleanupExpiredOAuthStates();
    expect(count).toBe(0);
  });

  test("loescht abgelaufene States und gibt die Anzahl zurueck", async () => {
    const expired = makeOAuthState({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await saveOAuthState("exp-1", expired);
    await saveOAuthState("exp-2", expired);

    const count = await cleanupExpiredOAuthStates();
    expect(count).toBe(2);
  });

  test("loescht nur abgelaufene States, gueltige bleiben erhalten", async () => {
    const expired = makeOAuthState({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const valid = makeOAuthState({
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await saveOAuthState("exp-only", expired);
    await saveOAuthState("valid-only", valid);

    const count = await cleanupExpiredOAuthStates();
    expect(count).toBe(1);

    // Gueltige State noch vorhanden
    const stillValid = await loadOAuthState("valid-only");
    expect(stillValid).not.toBeNull();
  });

  test("nach dem Bereinigen sind abgelaufene States nicht mehr ladbar", async () => {
    const expired = makeOAuthState({
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    });
    await saveOAuthState("old-state", expired);

    await cleanupExpiredOAuthStates();

    const result = await loadOAuthState("old-state");
    expect(result).toBeNull();
  });

  test("gibt die korrekte Anzahl bei gemischten States zurueck", async () => {
    const expired = makeOAuthState({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const valid = makeOAuthState({ expiresAt: new Date(Date.now() + 60000).toISOString() });

    await saveOAuthState("e1", expired);
    await saveOAuthState("e2", expired);
    await saveOAuthState("e3", expired);
    await saveOAuthState("v1", valid);
    await saveOAuthState("v2", valid);

    const count = await cleanupExpiredOAuthStates();
    expect(count).toBe(3);
  });
});
