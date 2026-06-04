# MCP Remote-Transport (Streamable HTTP + SSE)

**Stand**: 2026-06-02 · **Branches**: main (Scalingo) + demo/messe (Railway) · **Zielgruppe**: Developer / Admin

Ermoeglicht die Anbindung **Remote-gehosteter MCP-Server** (vom Anbieter betrieben,
HTTPS + OAuth/Token) zusaetzlich zu den bisherigen **lokalen stdio-Servern**.
Konkreter Anlass: der offizielle Google **Gmail MCP Server**
(`gmailmcp.googleapis.com`) ist ein Remote-Server und liess sich mit dem alten
command/args-Dialog nicht anbinden.

---

## 1. Was sich geaendert hat

Vorher: `McpConnection` konnte nur `StdioClientTransport` — also einen lokalen
Prozess starten (`command` + `args` + `env`). Es gab kein URL-/Header-Feld.

Jetzt: `McpServerConfig.transport` bestimmt den Transport:

| Transport | Bedeutung | Pflichtfelder | Auth |
|---|---|---|---|
| `stdio` (Default) | Lokaler Subprozess (npx/bun) | `command` | `env` |
| `http` | Remote via **Streamable HTTP** | `url` | `headers` (z.B. `Authorization`) |
| `sse` | Remote via **Server-Sent Events** (Legacy) | `url` | `headers` |

Abwaertskompatibel: bestehende Configs ohne `transport`-Feld werden als `stdio`
behandelt.

---

## 2. Backend

### `backend/src/mcp/types.ts`
`McpServerConfig` erweitert um:
- `transport?: 'stdio' | 'http' | 'sse'`
- `url?: string`
- `headers?: Record<string, string>`

`command` ist jetzt optional (nur fuer stdio relevant).

### `backend/src/mcp/connection.ts`
`connect()` verzweigt nach `transport`:

```
transport === 'http' | 'sse'  → createRemoteTransport(transport)
sonst                         → createStdioTransport()
```

- **`createStdioTransport()`**: unveraenderte alte Logik (Prozess-Spawn,
  stderr-Logging, `StdioClientTransport`).
- **`createRemoteTransport(type)`**:
  - validiert + parst `url` (`new URL(...)`),
  - loest `headers` mit `${ENV_VAR}`-Substitution auf,
  - `http` → `new StreamableHTTPClientTransport(url, { requestInit: { headers } })`,
  - `sse`  → `new SSEClientTransport(url, { requestInit, eventSourceInit })`
    (Header werden bei SSE zusaetzlich der EventSource-`fetch`-Funktion mitgegeben,
    da EventSource nativ keine Custom-Header kann).

Der gemeinsame Teil (Client erstellen, `client.connect(transport)`,
`refreshTools()`, Status setzen) ist nach dem Branch zusammengefasst.

> **Header-Substitution**: `Authorization: Bearer ${GMAIL_OAUTH_TOKEN}` wird beim
> Connect aus `process.env.GMAIL_OAUTH_TOKEN` aufgeloest. So landet kein Token im
> Klartext in `data/config/mcp-servers.yaml`.

### `backend/src/mcp/config.ts`
- `updateMcpServer()` reicht `transport`/`url`/`headers` durch (die Funktion baut
  das Objekt feldweise neu auf — fehlende Felder wuerden sonst beim Edit verloren).
- Neue Presets:
  - `gmail-google` — Gmail Remote/HTTP (Host als Default, Auth-Header-Template).
  - `remote-http` — generisches Streamable-HTTP-Template.

### `backend/src/routes/chat.ts`
`POST /api/mcp/servers`: validiert `id` + `name` und **`command` (stdio) ODER
`url` (http/sse)** statt `command` hart vorauszusetzen.

---

## 3. Frontend

### `frontend/src/components/McpServerEditor.jsx`
- **Transport-Dropdown** (stdio / HTTP / SSE).
- `stdio` → Command + Arguments + Umgebungsvariablen (wie bisher).
- `http`/`sse` → **URL**-Feld + **HTTP-Header** (Key/Value-Liste, gleiche UX wie
  Env-Vars; `Authorization: Bearer ${MCP_TOKEN}`).
- Validierung in `handleSave`: URL bei Remote, Command bei stdio.
- Preset-Auswahl uebernimmt `transport`/`url`/`headers`.

### `frontend/src/pages/McpServersPage.jsx`
- `openPreset()` reicht die neuen Felder an den Editor durch.
- Server- und Preset-Karten zeigen bei Remote-Servern die **URL** statt
  `command args`.

---

## 4. Gmail anbinden (Kurzanleitung)

1. In der Google Cloud Console OAuth einrichten und ein **Bearer-Token** /
   OAuth-Zugang fuer den Gmail-MCP-Endpoint beschaffen.
2. Token als Env-Variable hinterlegen (z.B. `GMAIL_OAUTH_TOKEN` in `.env` bzw.
   den Scalingo/Railway-Config-Vars).
3. In der UI: **MCP Server hinzufuegen → Preset „Gmail MCP Server (Google,
   offiziell)"** oder manuell:
   - Transport: `HTTP`
   - URL: offizieller Gmail-MCP-Endpoint (exakten Pfad aus der Google-Doku
     „Configure the Gmail MCP server" uebernehmen)
   - Header: `Authorization = Bearer ${GMAIL_OAUTH_TOKEN}`
4. Speichern → Auto-Connect registriert die Gmail-Tools im Tool-Registry.

> **Offen / zu verifizieren**: Der genaue Endpoint-**Pfad** unter
> `gmailmcp.googleapis.com` ist im Preset nur als Host hinterlegt. Vor Produktiv-
> nutzung den vollstaendigen Pfad + das exakte Auth-Schema (Bearer vs.
> OAuth-Flow) aus der offiziellen Google-Doku bestaetigen.

---

## 5. Betroffene Dateien (beide Worktrees)

```
backend/src/mcp/types.ts            # transport/url/headers
backend/src/mcp/connection.ts       # createStdioTransport + createRemoteTransport
backend/src/mcp/config.ts           # updateMcpServer + Presets gmail-google/remote-http
backend/src/routes/chat.ts          # POST /servers Validierung (command ODER url)
frontend/src/components/McpServerEditor.jsx   # Transport-Auswahl + URL/Header-Felder
frontend/src/pages/McpServersPage.jsx         # openPreset + Karten-Anzeige
```

Hinweis: `backend/src/mcp/manager.ts` unterscheidet sich zwischen den Worktrees
nur im Logging (`safeLog` vs. `console`) und wurde **nicht** angefasst.

---

## 6. Verifikation

- `bun x tsc --noEmit`: keine neuen Fehler in den geaenderten MCP-Dateien
  (vorbestehende, unabhaengige Type-Errors im Repo bleiben unveraendert).
- Runtime-Smoke-Test: beide Remote-Transports instanziieren sauber
  (`StreamableHTTPClientTransport`, `SSEClientTransport`, SDK `^1.25.3`) in
  beiden Worktrees.
