# MCP Per-User-OAuth (Notion) — Login pro User via Dynamic Client Registration

**Stand**: 2026-06-04 · **Branches**: main (Scalingo) + demo/messe (Railway) · **Zielgruppe**: Developer / Admin

Aufbauend auf dem Remote-Transport ([mcp-remote-transport-2026-06-02.md](mcp-remote-transport-2026-06-02.md))
ermöglicht dieses Feature einen **OAuth-2.1-Flow pro User** für Remote-MCP-Server.
Jeder User verbindet sein **eigenes** Konto per 1-Klick-Login — **ohne** dass ein
Admin vorher eine OAuth-App registrieren muss. Möglich macht das die **Dynamic
Client Registration (RFC 7591)**, die der Server bereitstellt.

Primärer Use-Case: der offizielle **Notion** Hosted-MCP-Server
(`https://mcp.notion.com/mcp`), inkl. eines fertigen **Notion-Assistent-Agents**.

---

## 1. Warum DCR der Schlüssel ist

Eure bestehenden Connections (Confluence, Jira, Google) verlangen, dass **du als
Admin** pro Provider eine OAuth-App registrierst (client_id/secret, Redirect-URI,
ggf. Verifizierung). Notions Hosted-MCP unterstützt **Dynamic Client Registration**:
die Plattform registriert sich beim ersten Connect **automatisch** beim
Authorization-Server. Kein Developer-Portal, keine client_id/secret von Hand.

Verifiziert gegen `mcp.notion.com` (Discovery):
- `authorization_endpoint`: `https://mcp.notion.com/authorize`
- `token_endpoint`: `https://mcp.notion.com/token`
- `registration_endpoint` (DCR): `https://mcp.notion.com/register`
- PKCE S256

---

## 2. Architektur

Kern-Idee: **das MCP-SDK macht das OAuth-Protokoll**, die Persistenz hängt am
**bestehenden `connections`-Storage** (storage-agnostisch → läuft mit Postgres
auf main **und** YAML auf demo/messe ohne Sonderfälle).

```
Browser (MCP-Servers-Seite)
  │  „Verbinden (Login)"
  ▼
GET /api/mcp/servers/:id/oauth/connect   ── startMcpOAuth(userId, serverId)
  │                                          └─ SDK auth(): Discovery → DCR → PKCE → Authorize-URL
  ▼  { authUrl }  → Popup öffnet Notion-Consent
Notion-Login + Seiten freigeben
  ▼
GET /api/mcp/servers/:id/oauth/callback?code&state  ── finishMcpOAuth()
  │   └─ SDK auth(authorizationCode): Token-Exchange → saveTokens (pro User, verschlüsselt)
  │   └─ mcpManager.registerOAuthServerTools(): Tool-Discovery → global registrieren
  ▼  Popup postMessage → Seite zeigt „Verbunden"

Chat-Run (Agent nutzt mcp_notion_* Tool)
  │  ensureUserOAuthToolsRegistered(userId)  (lazy re-register nach Neustart)
  ▼
McpOAuthToolWrapper.execute(args, {userId})
  └─ mcpUserSessions.callTool(userId, serverId, …)
       └─ StreamableHTTPClientTransport({ authProvider })  ← SDK injiziert/refresht Token
```

### Storage-Mapping (auf vorhandene Primitive)
- **DCR-Client (pro Server)** → `McpServerConfig.oauthClient` via `updateMcpServer`.
- **Access/Refresh-Token (pro User)** → `connections`-Storage als Provider `mcp:<serverId>`.
- **State + PKCE-Verifier (pro Flow)** → `oauth_states` (save/loadOAuthState).

---

## 3. Dateien

| Datei | Inhalt |
|---|---|
| `backend/src/mcp/types.ts` | `auth: 'none' \| 'oauth'`, `oauthClient`, `McpAuthMode` |
| `backend/src/mcp/oauth/provider.ts` | `McpOAuthClientProvider` (SDK-Interface ↔ connections-Storage) |
| `backend/src/mcp/oauth/index.ts` | `startMcpOAuth` / `finishMcpOAuth` (kapseln SDK-`auth()`) |
| `backend/src/mcp/userSessions.ts` | per-User-Sessions (authProvider, Idle-Eviction) |
| `backend/src/mcp/tool.ts` | `McpOAuthToolWrapper`; Description-Cap 8192 |
| `backend/src/mcp/manager.ts` | OAuth-Guard, `registerOAuthServerTools`, `ensureUserOAuthToolsRegistered` |
| `backend/src/mcp/config.ts` | `updateMcpServer`-Passthrough; Notion-Preset |
| `backend/src/routes/chat.ts` | `oauth/{connect,status,callback}`-Routen |
| `backend/src/agents/loop.ts` | `ensureUserOAuthToolsRegistered` beim Chat-Start |
| `backend/src/services/taskExecutor.ts` | `userId`-Durchreichung in Hintergrund-Tasks |
| `frontend/src/pages/McpServersPage.jsx` | per-User-„Verbinden"-Button + Status + Popup-Listener |
| `frontend/src/components/McpServerEditor.jsx` | Auth-Dropdown (none/oauth) |
| `data/agents/notion-assistant/config.md` | Notion-Assistent-Agent |

> **Worktree-Hinweis**: `mcp/manager.ts` nutzt auf main `safeLog`, auf demo/messe
> `console.*` (kein `safeLogger` im Railway-Branch) — funktional identisch.
> `connections`-Storage: Postgres (main) vs. YAML (demo/messe), gleiches Interface.

---

## 4. Setup / Bedienung

1. **Env**: `CONNECTION_ENCRYPTION_KEY` (Token-Verschlüsselung) + `API_BASE_URL`
   (bestimmt die Redirect-URI `…/api/mcp/servers/<id>/oauth/callback`; lokal
   Default `http://localhost:3001`).
2. **MCP-Server → Hinzufügen → Preset „Notion (OAuth)" → Speichern.**
3. Auf der Karte **„Verbinden (Login)"** → Popup → Notion-Login → Seiten freigeben
   → Status **„Verbunden (dein Konto)"**.
4. **Agent nutzen**: „Notion Assistent" im Chat wählen (oder Supervisor fragen).

---

## 5. Der Notion-Assistent-Agent

`data/agents/notion-assistant/config.md` — listet die 14 discoverten Notion-Tools
(`mcp_notion_notion-*`). Wichtige Prompt-Entscheidungen (aus realen Tests):

- **Lesen autonom, Schreiben mit Bestätigung** — keine Dauer-Rückfragen bei
  `search → fetch`-Ketten.
- **Keine leeren/`*`-Queries**; bei 0 Treffern automatisch **DE/EN-Synonyme**
  (max. 3–4 Suchen, dann antworten).
- **DB-Einträge auflisten**: `fetch` auf die **`collection://`-Data-Source-URL**
  (nicht `search` mit leerem Query).
- **Struktur-Überblick**: via `notion-get-teams` + wenige Suchen (kein
  „Workspace-Baum" in der API).
- **`create-pages`-Format**: `parent` ist ein **String auf Top-Level** (page_id
  oder `collection://`), nicht im Page-Objekt.
- **Anti-Wiederholung**: ein fehlgeschlagener Tool-Call wird max. 2× wiederholt,
  dann Stopp + ehrliche Meldung.
- **`maxIterations: 10`** — ≤ `MAX_DELEGATED_ITERATIONS` (10), damit der
  Supervisor **synchron (inline)** delegiert statt einen Hintergrund-Task zu
  erzeugen (`loop.ts`-Regel: Ziel-Agent mit `maxIterations > 10` → Background-Task).

---

## 6. Bugfixes (im Zuge der Entwicklung gefunden)

| Symptom | Ursache | Fix |
|---|---|---|
| Notion-Tool meldet „nicht verbunden", obwohl verbunden | Hintergrund-Task rief `runAgentLoop` **ohne `userId`** → per-User-Token nicht auflösbar | `taskExecutor.ts` ermittelt `userId` (task.userId / `getChatOwnerId`) und reicht sie durch |
| Tools nach Backend-Neustart weg | Tool-Registrierung nur in-memory | `ensureUserOAuthToolsRegistered` re-registriert lazy beim nächsten Chat-Run |
| `create-pages` scheitert endlos mit „unrecognized_keys" | Tool-Description bei 1024 Zeichen abgeschnitten → LLM sah das Format nie | Description-Cap 1024 → 8192 (`mcp/tool.ts`) |
| Supervisor macht aus jeder Notion-Anfrage einen Task | Ziel-Agent hatte `maxIterations: 20 > 10` | Notion-Agent auf `maxIterations: 10` |

---

## 7. Stolpersteine / Betriebshinweise

- **Restart-Robustheit**: nach einem Neustart sind die OAuth-Tools erst wieder da,
  sobald ein verbundener User eine Chat-Nachricht schickt (Lazy-Re-Registrierung).
- **Modell-Compliance**: das Chat-Modell (Qwen 3 30B) befolgt Prompt-Regeln nicht
  zu 100% (z.B. gelegentlich leerer Query trotz Verbot). Der Prompt reduziert das
  stark; ein stärkeres Modell / eigener Modell-Slot für den Agenten wäre der
  nächste Hebel.
- **Account-Typen**: Notions Hosted-MCP funktioniert mit **privaten @gmail- und
  Workspace-Notion-Konten** (DCR + Standard-OAuth). Der offizielle **Google**
  Gmail-MCP dagegen ist preview-/Workspace-gegated (siehe Remote-Transport-Doku).
- **`description`-Cap 8192**: bewusst großzügiger als die ursprünglichen 1024
  (Security-Hardening) — nötig für reich dokumentierte Tools. Control-Chars werden
  weiter gestrippt, Server-Name auf 64 gekappt.
