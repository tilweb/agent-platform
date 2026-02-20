---
name: app
description: Manage the Adacor Workplace (Backend + Frontend). Start, stop, restart, or check status of dev servers.
argument-hint: "[start|stop|restart|status]"
disable-model-invocation: true
---

Manage the Adacor Workplace (Backend + Frontend).

## Usage

Argument: `$ARGUMENTS` (one of: `start`, `stop`, `restart`, `status`)

## Ports

- **Backend**: Port 3001 (Bun + Hono)
- **Frontend**: Port 5173 (Vite dev server)

## Actions

### start
Start both servers in the background.

**Backend:**
```bash
cd "$CLAUDE_PROJECT_DIR/backend" && bun --env-file=../.env run --watch src/index.ts &
```

**Frontend:**
```bash
cd "$CLAUDE_PROJECT_DIR/frontend" && npm run dev &
```

Wait 4 seconds, then verify via health endpoints:
- Backend: `curl -s http://localhost:3001/health`
- Frontend: `curl -s http://localhost:5173/health`

Both should return `{"status":"ok","service":"..."}`.


### stop
Kill all processes on both ports:

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

Verify both ports are free afterwards.

### restart
Run `stop` first, wait 1 second, then run `start`.

### status
Check both ports:

```bash
lsof -i:3001
lsof -i:5173
```

Report which services are running and which are stopped.

## Notes
- The backend CWD must be `backend/` for paths to resolve correctly
- Bun lädt `.env` aus dem Root via `--env-file=../.env`
- After start, briefly check the output for errors (look for "error:" or stack traces)
- Report the result to the user concisely in German (e.g. "Backend und Frontend gestartet" or "Backend gestoppt, Frontend läuft noch")
