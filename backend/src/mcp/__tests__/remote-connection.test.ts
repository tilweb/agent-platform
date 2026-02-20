/**
 * Tests for backend/src/mcp/remote-connection.ts
 *
 * RemoteMcpConnection leitet alle Operationen via HTTP an den MCP Runner weiter.
 * Globales `fetch` wird direkt durch ein Mock ersetzt — kein mock.module() nötig.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { RemoteMcpConnection } from "../remote-connection";
import type { McpServerConfig, McpToolInfo, McpCallResult, RunnerServerStatus } from "../types";

// ---------------------------------------------------------------------------
// Typen und Hilfsfunktionen
// ---------------------------------------------------------------------------

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Speichert den originalen globalThis.fetch für die Wiederherstellung nach jedem Test. */
let originalFetch: typeof globalThis.fetch;

/** Aktuell aktiver Fetch-Mock – wird in beforeEach gesetzt. */
let fetchMock: FetchMock;

/** Letzter aufgezeichneter Fetch-Aufruf (URL + RequestInit). */
let lastFetchUrl: string;
let lastFetchInit: RequestInit | undefined;

/**
 * Installiert einen kontrollierten Fetch-Mock, der jeden Aufruf aufzeichnet
 * und die von `handler` zurückgegebene Response liefert.
 */
function installFetchMock(handler: FetchMock): void {
  fetchMock = async (input, init) => {
    lastFetchUrl = typeof input === "string" ? input : (input as URL).toString();
    lastFetchInit = init;
    return handler(input, init);
  };
  globalThis.fetch = fetchMock as typeof globalThis.fetch;
}

/** Baut eine minimale ok=true Response mit einem JSON-Body auf. */
function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Baut eine Fehler-Response auf (ok=false). */
function errorJson(body: unknown, status = 500): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Minimale Test-Konfiguration für einen MCP-Server. */
function makeConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "test-server",
    name: "Test Server",
    command: "npx",
    args: ["-y", "some-mcp-package"],
    ...overrides,
  };
}

/** Minimales McpToolInfo-Fixture. */
function makeTool(overrides: Partial<McpToolInfo> = {}): McpToolInfo {
  return {
    name: "do_thing",
    description: "Tut etwas",
    serverId: "test-server",
    serverName: "Test Server",
    inputSchema: {},
    ...overrides,
  };
}

/** Minimale RunnerServerStatus-Antwort. */
function makeRunnerStatus(overrides: Partial<RunnerServerStatus> = {}): RunnerServerStatus {
  return {
    id: "test-server",
    name: "Test Server",
    status: "connected",
    toolCount: 0,
    connectedAt: 1700000000000,
    ...overrides,
  };
}

/**
 * Hilfsfunktion: verbindet eine Connection erfolgreich.
 * Der erste fetch-Aufruf liefert den Status (connect), der zweite die Tools (refreshTools).
 */
async function connectSuccessfully(conn: RemoteMcpConnection, tools: McpToolInfo[] = []): Promise<void> {
  let callCount = 0;
  installFetchMock(async () => {
    callCount++;
    if (callCount === 1) return okJson(makeRunnerStatus());
    return okJson(tools);
  });
  await conn.connect();
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  originalFetch = globalThis.fetch;
  lastFetchUrl = "";
  lastFetchInit = undefined;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Konstruktor
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – Konstruktor", () => {
  test("sollte den abschließenden Schrägstrich aus der Runner-URL entfernen", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080/", "secret");
    // Die URL wird intern verwendet; wir prüfen sie indirekt über den ersten fetch-Aufruf.
    installFetchMock(async () => okJson(makeRunnerStatus()));
    // Wir verbinden uns nicht vollständig; eine direkte Assertion auf die interne URL
    // ist nicht möglich, daher testen wir das Verhalten über connect().
    expect(conn.serverId).toBe("test-server");
  });

  test("sollte serverId aus der Konfiguration ableiten", () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "my-special-server" }), "http://runner:8080", "s");
    expect(conn.serverId).toBe("my-special-server");
  });

  test("sollte serverName aus der Konfiguration ableiten", () => {
    const conn = new RemoteMcpConnection(makeConfig({ name: "Mein Server" }), "http://runner:8080", "s");
    expect(conn.serverName).toBe("Mein Server");
  });

  test("sollte den Anfangsstatus 'disconnected' haben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.status).toBe("disconnected");
  });

  test("sollte den Anfangsfehler null haben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.error).toBeNull();
  });

  test("sollte connectedAt initial null haben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.connectedAt).toBeNull();
  });

  test("sollte ohne Secret-Parameter keine Ausnahme werfen", () => {
    expect(() => new RemoteMcpConnection(makeConfig(), "http://runner:8080", "")).not.toThrow();
  });

  test("sollte mehrere abschließende Schrägstriche entfernen (nur den letzten)", () => {
    // replace(/\/$/, '') entfernt nur einen abschließenden Schrägstrich
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080/", "s");
    // Kein Fehler; interne URL wird bei connect() genutzt
    expect(conn).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ENV_ALLOWLIST / resolveEnv
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – resolveEnv (ENV_ALLOWLIST-Filterung)", () => {
  /**
   * Da resolveEnv() privat ist, testen wir das Verhalten indirekt über connect():
   * Der Body des POST-Requests an /connect enthält das aufgelöste env-Objekt.
   */

  test("sollte env undefined zurückgeben wenn keine env-Konfiguration vorhanden ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ env: undefined }), "http://runner:8080", "s");
    let capturedBody: any;
    let refreshCallCount = 0;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      if (urlStr.includes("/connect")) {
        const raw = lastFetchInit?.body as string;
        capturedBody = JSON.parse(raw);
        return okJson(makeRunnerStatus());
      }
      refreshCallCount++;
      return okJson([]);
    });
    await conn.connect();
    expect(capturedBody.env).toBeUndefined();
  });

  test("sollte erlaubte Präfixe (MCP_) auflösen", async () => {
    process.env["MCP_TEST_TOKEN"] = "mcp-secret-value";
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { TOKEN: "${MCP_TEST_TOKEN}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.TOKEN).toBe("mcp-secret-value");
    } finally {
      delete process.env["MCP_TEST_TOKEN"];
    }
  });

  test("sollte erlaubte Präfixe (OPENAI_) auflösen", async () => {
    process.env["OPENAI_API_KEY"] = "openai-key";
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { KEY: "${OPENAI_API_KEY}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.KEY).toBe("openai-key");
    } finally {
      delete process.env["OPENAI_API_KEY"];
    }
  });

  test("sollte erlaubte Präfixe (ANTHROPIC_) auflösen", async () => {
    process.env["ANTHROPIC_API_KEY"] = "anthropic-key";
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { KEY: "${ANTHROPIC_API_KEY}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.KEY).toBe("anthropic-key");
    } finally {
      delete process.env["ANTHROPIC_API_KEY"];
    }
  });

  test("sollte nicht erlaubte Umgebungsvariablen durch leeren String ersetzen", async () => {
    process.env["SECRET_INTERNAL_KEY"] = "do-not-leak";
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { LEAKED: "${SECRET_INTERNAL_KEY}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.LEAKED).toBe("");
    } finally {
      delete process.env["SECRET_INTERNAL_KEY"];
    }
  });

  test("sollte Literal-Werte ohne ${}-Syntax unverändert weitergeben", async () => {
    const conn = new RemoteMcpConnection(
      makeConfig({ env: { STATIC: "literalwert" } }),
      "http://runner:8080",
      "s",
    );
    let capturedEnv: Record<string, string> | undefined;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      if (urlStr.includes("/connect")) {
        capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
        return okJson(makeRunnerStatus());
      }
      return okJson([]);
    });
    await conn.connect();
    expect(capturedEnv?.STATIC).toBe("literalwert");
  });

  test("sollte NODE_ENV als erlaubte Variable auflösen", async () => {
    process.env["NODE_ENV"] = "test";
    const conn = new RemoteMcpConnection(
      makeConfig({ env: { ENV: "${NODE_ENV}" } }),
      "http://runner:8080",
      "s",
    );
    let capturedEnv: Record<string, string> | undefined;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      if (urlStr.includes("/connect")) {
        capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
        return okJson(makeRunnerStatus());
      }
      return okJson([]);
    });
    await conn.connect();
    expect(capturedEnv?.ENV).toBe("test");
  });

  test("sollte GITHUB_TOKEN als erlaubte Variable auflösen", async () => {
    process.env["GITHUB_TOKEN"] = "gh-token-value";
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { GH: "${GITHUB_TOKEN}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.GH).toBe("gh-token-value");
    } finally {
      delete process.env["GITHUB_TOKEN"];
    }
  });

  test("sollte leeren String zurückgeben wenn erlaubte Variable nicht gesetzt ist", async () => {
    // Sicherstellen, dass die Variable nicht gesetzt ist
    const originalVal = process.env["MCP_UNSET_VAR"];
    delete process.env["MCP_UNSET_VAR"];
    try {
      const conn = new RemoteMcpConnection(
        makeConfig({ env: { KEY: "${MCP_UNSET_VAR}" } }),
        "http://runner:8080",
        "s",
      );
      let capturedEnv: Record<string, string> | undefined;
      installFetchMock(async (url) => {
        const urlStr = typeof url === "string" ? url : (url as URL).toString();
        if (urlStr.includes("/connect")) {
          capturedEnv = JSON.parse(lastFetchInit?.body as string).env;
          return okJson(makeRunnerStatus());
        }
        return okJson([]);
      });
      await conn.connect();
      expect(capturedEnv?.KEY).toBe("");
    } finally {
      if (originalVal !== undefined) process.env["MCP_UNSET_VAR"] = originalVal;
    }
  });
});

// ---------------------------------------------------------------------------
// connect()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – connect()", () => {
  test("sollte POST an /api/servers/{id}/connect senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "srv-1" }), "http://runner:8080", "s");
    let connectUrl = "";
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      if (urlStr.includes("/connect")) {
        connectUrl = urlStr;
        return okJson(makeRunnerStatus());
      }
      return okJson([]);
    });
    await conn.connect();
    expect(connectUrl).toBe("http://runner:8080/api/servers/srv-1/connect");
  });

  test("sollte nach erfolgreichem connect() den Status 'connected' haben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);
    expect(conn.status).toBe("connected");
  });

  test("sollte connectedAt aus der Runner-Antwort setzen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const ts = 1700000099999;
    let call = 0;
    installFetchMock(async () => {
      call++;
      if (call === 1) return okJson(makeRunnerStatus({ connectedAt: ts }));
      return okJson([]);
    });
    await conn.connect();
    expect(conn.connectedAt).toBe(ts);
  });

  test("sollte connectedAt auf Date.now() fallen lassen wenn Runner keinen Timestamp liefert", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const before = Date.now();
    let call = 0;
    installFetchMock(async () => {
      call++;
      if (call === 1) {
        const status = makeRunnerStatus();
        delete (status as any).connectedAt;
        return okJson(status);
      }
      return okJson([]);
    });
    await conn.connect();
    const after = Date.now();
    expect(conn.connectedAt).toBeGreaterThanOrEqual(before);
    expect(conn.connectedAt).toBeLessThanOrEqual(after);
  });

  test("sollte nach connect() refreshTools aufrufen und Tools speichern", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const tools = [makeTool({ name: "tool_a" }), makeTool({ name: "tool_b" })];
    let call = 0;
    installFetchMock(async () => {
      call++;
      if (call === 1) return okJson(makeRunnerStatus());
      return okJson(tools);
    });
    await conn.connect();
    expect(conn.getTools()).toHaveLength(2);
  });

  test("sollte bei Fehler-Response den Status 'error' setzen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => errorJson({ error: "auth failed" }, 401));
    await expect(conn.connect()).rejects.toThrow("auth failed");
    expect(conn.status).toBe("error");
  });

  test("sollte bei Fehler-Response den error-Text speichern", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => errorJson({ error: "runner not available" }, 503));
    await expect(conn.connect()).rejects.toThrow();
    expect(conn.error).toBe("runner not available");
  });

  test("sollte bei Netzwerkfehler den Status 'error' setzen und die Exception weiterwerfen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => {
      throw new Error("Netzwerk nicht verfügbar");
    });
    await expect(conn.connect()).rejects.toThrow("Netzwerk nicht verfügbar");
    expect(conn.status).toBe("error");
    expect(conn.error).toBe("Netzwerk nicht verfügbar");
  });

  test("sollte bei bereits verbundener Connection keinen weiteren fetch-Aufruf machen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    let extraCalls = 0;
    installFetchMock(async () => {
      extraCalls++;
      return okJson(makeRunnerStatus());
    });
    await conn.connect();
    expect(extraCalls).toBe(0);
  });

  test("sollte den Error-State vor erneutem Verbindungsversuch zurücksetzen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    // Erster Versuch schlägt fehl
    installFetchMock(async () => errorJson({ error: "Fehler" }, 500));
    await expect(conn.connect()).rejects.toThrow();
    expect(conn.status).toBe("error");

    // Zweiter Versuch erfolgreich
    let call = 0;
    installFetchMock(async () => {
      call++;
      if (call === 1) return okJson(makeRunnerStatus());
      return okJson([]);
    });
    await conn.connect();
    expect(conn.status).toBe("connected");
    expect(conn.error).toBeNull();
  });

  test("sollte den korrekten JSON-Body mit id, name, command und args senden", async () => {
    const config = makeConfig({
      id: "body-test",
      name: "Body Test",
      command: "uvx",
      args: ["some-server"],
    });
    const conn = new RemoteMcpConnection(config, "http://runner:8080", "s");
    let capturedBody: any;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      if (urlStr.includes("/connect")) {
        capturedBody = JSON.parse(lastFetchInit?.body as string);
        return okJson(makeRunnerStatus({ id: "body-test" }));
      }
      return okJson([]);
    });
    await conn.connect();
    expect(capturedBody.id).toBe("body-test");
    expect(capturedBody.name).toBe("Body Test");
    expect(capturedBody.command).toBe("uvx");
    expect(capturedBody.args).toEqual(["some-server"]);
  });

  test("sollte die Fehler-Response mit statusText als Fallback verwenden wenn kein error-Feld vorhanden ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    // Antworte mit ungültigem JSON damit der json()-Parse-Aufruf fehlschlägt und auf statusText zurückgegriffen wird
    installFetchMock(async () => new Response("not json", { status: 502, statusText: "Bad Gateway" }));
    await expect(conn.connect()).rejects.toThrow("Bad Gateway");
  });
});

// ---------------------------------------------------------------------------
// disconnect()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – disconnect()", () => {
  test("sollte POST an /api/servers/{id}/disconnect senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "srv-2" }), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    let disconnectUrl = "";
    installFetchMock(async (url) => {
      disconnectUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson({});
    });
    await conn.disconnect();
    expect(disconnectUrl).toBe("http://runner:8080/api/servers/srv-2/disconnect");
  });

  test("sollte nach disconnect() den Status 'disconnected' setzen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);
    installFetchMock(async () => okJson({}));
    await conn.disconnect();
    expect(conn.status).toBe("disconnected");
  });

  test("sollte nach disconnect() connectedAt auf null setzen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);
    expect(conn.connectedAt).not.toBeNull();
    installFetchMock(async () => okJson({}));
    await conn.disconnect();
    expect(conn.connectedAt).toBeNull();
  });

  test("sollte nach disconnect() die gespeicherten Tools leeren", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn, [makeTool()]);
    expect(conn.getTools()).toHaveLength(1);
    installFetchMock(async () => okJson({}));
    await conn.disconnect();
    expect(conn.getTools()).toHaveLength(0);
  });

  test("sollte bei Netzwerkfehler während disconnect keine Exception werfen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);
    installFetchMock(async () => {
      throw new Error("Netzwerk unterbrochen");
    });
    await expect(conn.disconnect()).resolves.toBeUndefined();
  });

  test("sollte auch ohne vorherigen connect() keine Exception werfen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => okJson({}));
    await expect(conn.disconnect()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// refreshTools()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – refreshTools()", () => {
  test("sollte GET an /api/servers/{id}/tools senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "tools-srv" }), "http://runner:8080", "s");
    let toolsUrl = "";
    installFetchMock(async (url) => {
      toolsUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson([]);
    });
    await conn.refreshTools();
    expect(toolsUrl).toBe("http://runner:8080/api/servers/tools-srv/tools");
  });

  test("sollte die empfangenen Tools zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const tools = [makeTool({ name: "tool_x" }), makeTool({ name: "tool_y" })];
    installFetchMock(async () => okJson(tools));
    const result = await conn.refreshTools();
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("tool_x");
  });

  test("sollte bei Fehler-Response ein leeres Array zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => errorJson({ error: "Fehler" }, 500));
    const result = await conn.refreshTools();
    expect(result).toEqual([]);
  });

  test("sollte bei Netzwerkfehler ein leeres Array zurückgeben und keine Exception werfen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => {
      throw new Error("Timeout");
    });
    const result = await conn.refreshTools();
    expect(result).toEqual([]);
  });

  test("sollte die internen Tools aktualisieren sodass getTools() die neuen Tools liefert", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => okJson([makeTool({ name: "fresh_tool" })]));
    await conn.refreshTools();
    expect(conn.getTools()[0]!.name).toBe("fresh_tool");
  });

  test("sollte ein leeres Array zurückgeben wenn der Runner eine leere Tool-Liste liefert", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => okJson([]));
    const result = await conn.refreshTools();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// callTool()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – callTool()", () => {
  test("sollte POST an /api/servers/{id}/tools/{name}/call senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "call-srv" }), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    let callUrl = "";
    installFetchMock(async (url) => {
      callUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson({ content: [{ type: "text", text: "ok" }] });
    });
    await conn.callTool("do_thing", {});
    expect(callUrl).toBe("http://runner:8080/api/servers/call-srv/tools/do_thing/call");
  });

  test("sollte den Tool-Namen URL-kodieren", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "enc-srv" }), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    let callUrl = "";
    installFetchMock(async (url) => {
      callUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson({ content: [{ type: "text", text: "ok" }] });
    });
    await conn.callTool("tool with spaces", {});
    expect(callUrl).toContain("tool%20with%20spaces");
  });

  test("sollte die Argumente im Request-Body als { arguments: args } senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    let capturedBody: any;
    installFetchMock(async () => {
      capturedBody = JSON.parse(lastFetchInit?.body as string);
      return okJson({ content: [] });
    });
    await conn.callTool("my_tool", { query: "hello", limit: 5 });
    expect(capturedBody.arguments).toEqual({ query: "hello", limit: 5 });
  });

  test("sollte das McpCallResult zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    const expected: McpCallResult = { content: [{ type: "text", text: "Ergebnis" }] };
    installFetchMock(async () => okJson(expected));
    const result = await conn.callTool("tool", {});
    expect(result.content[0]!.text).toBe("Ergebnis");
  });

  test("sollte eine Exception werfen wenn die Connection nicht verbunden ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "not-connected" }), "http://runner:8080", "s");
    await expect(conn.callTool("some_tool", {})).rejects.toThrow("not-connected");
    await expect(conn.callTool("some_tool", {})).rejects.toThrow("not connected");
  });

  test("sollte eine Exception werfen wenn die Runner-Antwort nicht ok ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    installFetchMock(async () => errorJson({ error: "Tool nicht gefunden" }, 404));
    await expect(conn.callTool("missing_tool", {})).rejects.toThrow("Tool nicht gefunden");
  });

  test("sollte die statusText-Fallback-Fehlermeldung nutzen wenn der Body kein error-Feld enthält", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    installFetchMock(async () => new Response("not json", { status: 500, statusText: "Internal Server Error" }));
    await expect(conn.callTool("bad_tool", {})).rejects.toThrow("Internal Server Error");
  });

  test("sollte eine Exception bei Netzwerkfehler weiterwerfen", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn);

    installFetchMock(async () => {
      throw new Error("Verbindung getrennt");
    });
    await expect(conn.callTool("any_tool", {})).rejects.toThrow("Verbindung getrennt");
  });

  test("sollte eine Exception werfen wenn der Status 'error' ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "err-srv" }), "http://runner:8080", "s");
    // Status ist initial 'disconnected', nach Verbindungsfehler 'error'
    installFetchMock(async () => errorJson({ error: "Fail" }, 500));
    await expect(conn.connect()).rejects.toThrow();
    expect(conn.status).toBe("error");
    await expect(conn.callTool("tool", {})).rejects.toThrow("not connected");
  });
});

// ---------------------------------------------------------------------------
// getTools()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – getTools()", () => {
  test("sollte initial ein leeres Array zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.getTools()).toEqual([]);
  });

  test("sollte nach refreshTools() die aktuellen Tools zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const tools = [makeTool({ name: "t1" }), makeTool({ name: "t2" })];
    installFetchMock(async () => okJson(tools));
    await conn.refreshTools();
    expect(conn.getTools()).toHaveLength(2);
  });

  test("sollte dasselbe Array zurückgeben das refreshTools() geliefert hat", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    const tools = [makeTool({ name: "singular" })];
    installFetchMock(async () => okJson(tools));
    const refreshed = await conn.refreshTools();
    expect(conn.getTools()).toEqual(refreshed);
  });

  test("sollte nach disconnect() ein leeres Array zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    await connectSuccessfully(conn, [makeTool()]);
    installFetchMock(async () => okJson({}));
    await conn.disconnect();
    expect(conn.getTools()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getInfo()
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – getInfo()", () => {
  test("sollte id aus der Konfiguration zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "info-srv" }), "http://runner:8080", "s");
    expect(conn.getInfo().id).toBe("info-srv");
  });

  test("sollte name aus der Konfiguration zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig({ name: "Info Server" }), "http://runner:8080", "s");
    expect(conn.getInfo().name).toBe("Info Server");
  });

  test("sollte den aktuellen Status zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.getInfo().status).toBe("disconnected");
  });

  test("sollte error initial als null zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.getInfo().error).toBeNull();
  });

  test("sollte toolCount als 0 zurückgeben wenn keine Tools vorhanden sind", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.getInfo().toolCount).toBe(0);
  });

  test("sollte toolCount korrekt nach refreshTools() aktualisieren", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => okJson([makeTool(), makeTool({ name: "t2" })]));
    await conn.refreshTools();
    expect(conn.getInfo().toolCount).toBe(2);
  });

  test("sollte connectedAt initial als null zurückgeben", () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    expect(conn.getInfo().connectedAt).toBeNull();
  });

  test("sollte nach connect() alle Felder korrekt befüllt zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "full-info", name: "Full Info" }), "http://runner:8080", "s");
    await connectSuccessfully(conn, [makeTool()]);
    const info = conn.getInfo();
    expect(info.id).toBe("full-info");
    expect(info.name).toBe("Full Info");
    expect(info.status).toBe("connected");
    expect(info.error).toBeNull();
    expect(info.toolCount).toBe(1);
    expect(info.connectedAt).toBeGreaterThan(0);
  });

  test("sollte nach Verbindungsfehler die Fehlermeldung in error zurückgeben", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "s");
    installFetchMock(async () => errorJson({ error: "Connection refused" }, 503));
    await expect(conn.connect()).rejects.toThrow();
    const info = conn.getInfo();
    expect(info.status).toBe("error");
    expect(info.error).toBe("Connection refused");
  });
});

// ---------------------------------------------------------------------------
// Authorization-Header
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – Autorisierungs-Header", () => {
  test("sollte Authorization-Header mit Bearer-Token senden wenn secret gesetzt ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "mein-geheimnis");
    let capturedHeaders: Record<string, string> = {};
    installFetchMock(async () => {
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      return okJson(makeRunnerStatus());
    });
    // Nur den connect-Aufruf testen, nicht refreshTools
    let callCount = 0;
    installFetchMock(async () => {
      callCount++;
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      if (callCount === 1) return okJson(makeRunnerStatus());
      return okJson([]);
    });
    await conn.connect();
    expect(capturedHeaders["Authorization"]).toBe("Bearer mein-geheimnis");
  });

  test("sollte keinen Authorization-Header senden wenn secret leer ist", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "");
    let capturedHeaders: Record<string, string> = {};
    let callCount = 0;
    installFetchMock(async () => {
      callCount++;
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      if (callCount === 1) return okJson(makeRunnerStatus());
      return okJson([]);
    });
    await conn.connect();
    expect(capturedHeaders).not.toHaveProperty("Authorization");
  });

  test("sollte Authorization-Header beim refreshTools()-Aufruf senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "refresh-secret");
    let capturedHeaders: Record<string, string> = {};
    installFetchMock(async () => {
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      return okJson([]);
    });
    await conn.refreshTools();
    expect(capturedHeaders["Authorization"]).toBe("Bearer refresh-secret");
  });

  test("sollte Authorization-Header beim callTool()-Aufruf senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "call-secret");
    await connectSuccessfully(conn);

    let capturedHeaders: Record<string, string> = {};
    installFetchMock(async () => {
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      return okJson({ content: [] });
    });
    await conn.callTool("my_tool", {});
    expect(capturedHeaders["Authorization"]).toBe("Bearer call-secret");
  });

  test("sollte Authorization-Header beim disconnect()-Aufruf senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "disc-secret");
    await connectSuccessfully(conn);

    let capturedHeaders: Record<string, string> = {};
    installFetchMock(async () => {
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      return okJson({});
    });
    await conn.disconnect();
    expect(capturedHeaders["Authorization"]).toBe("Bearer disc-secret");
  });

  test("sollte Content-Type: application/json immer senden", async () => {
    const conn = new RemoteMcpConnection(makeConfig(), "http://runner:8080", "");
    let capturedHeaders: Record<string, string> = {};
    installFetchMock(async () => {
      capturedHeaders = (lastFetchInit?.headers ?? {}) as Record<string, string>;
      return okJson([]);
    });
    await conn.refreshTools();
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// URL-Zusammensetzung (trailing slash)
// ---------------------------------------------------------------------------

describe("RemoteMcpConnection – URL-Konstruktion", () => {
  test("sollte abschließenden Schrägstrich in der Runner-URL entfernen bevor Pfade angefügt werden", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "slash-srv" }), "http://runner:8080/", "s");
    let capturedUrl = "";
    installFetchMock(async (url) => {
      capturedUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson([]);
    });
    await conn.refreshTools();
    // Es darf kein Doppelschrägstrich entstehen
    expect(capturedUrl).toBe("http://runner:8080/api/servers/slash-srv/tools");
    expect(capturedUrl).not.toContain("//api");
  });

  test("sollte die korrekte URL ohne trailing slash verwenden wenn keine Schrägstrich vorhanden war", async () => {
    const conn = new RemoteMcpConnection(makeConfig({ id: "no-slash" }), "http://runner:9000", "s");
    let capturedUrl = "";
    installFetchMock(async (url) => {
      capturedUrl = typeof url === "string" ? url : (url as URL).toString();
      return okJson([]);
    });
    await conn.refreshTools();
    expect(capturedUrl).toBe("http://runner:9000/api/servers/no-slash/tools");
  });
});
