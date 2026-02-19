Manage the Agent Platform (Backend + Frontend).

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
cd /Users/pfend/github/agent-platform/backend && bun run --watch src/index.ts &
```

**Frontend:**
```bash
cd /Users/pfend/github/agent-platform/frontend && npm run dev &
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
- Bun auto-loads `backend/.env`
- After start, briefly check the output for errors (look for "error:" or stack traces)
- Report the result to the user concisely in German (e.g. "Backend und Frontend gestartet" or "Backend gestoppt, Frontend läuft noch")
