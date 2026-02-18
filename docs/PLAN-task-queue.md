# Plan: Task Queue & Background Processing

## Ziel

Agents sollen Aufgaben autonom im Hintergrund abarbeiten können, unabhängig von aktiven Chat-Sessions. Der Benutzer kann Tasks erstellen, deren Fortschritt verfolgen und bei Abschluss benachrichtigt werden.

---

## Architektur-Übersicht

```
┌─ Frontend ──────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌─ Chat ─────────────┐     ┌─ Tasks Page ─────────────────────────┐    │
│  │ "Starte Deep       │     │ ┌─────────────────────────────────┐  │    │
│  │  Research zu..."   │     │ │ Task #1: EU AI Act Research     │  │    │
│  │       ↓            │     │ │ Status: ████████░░ 80%          │  │    │
│  │ "Task erstellt!" ──┼────►│ │ Agent: researcher               │  │    │
│  └────────────────────┘     │ │ Schritte: 8/10                  │  │    │
│                             │ └─────────────────────────────────┘  │    │
│                             │ ┌─────────────────────────────────┐  │    │
│                             │ │ Task #2: Compliance Check       │  │    │
│                             │ │ Status: ██░░░░░░░░ 20%          │  │    │
│                             │ └─────────────────────────────────┘  │    │
│                             └──────────────────────────────────────┘    │
│                                           ▲                              │
│                                           │ SSE Updates                  │
└───────────────────────────────────────────┼──────────────────────────────┘
                                            │
┌─ Backend ─────────────────────────────────┼──────────────────────────────┐
│                                           │                              │
│  ┌─ API Routes ───────────────────────────┴─────────────────────────┐   │
│  │ POST /api/tasks          - Task erstellen                        │   │
│  │ GET  /api/tasks          - Alle Tasks listen                     │   │
│  │ GET  /api/tasks/:id      - Task-Details                          │   │
│  │ GET  /api/tasks/:id/stream - SSE für Live-Updates                │   │
│  │ POST /api/tasks/:id/cancel - Task abbrechen                      │   │
│  │ POST /api/tasks/:id/retry  - Task wiederholen                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─ Task Service ───────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  ┌─ Task Queue ─────┐    ┌─ Task Executor ──────────────────┐   │   │
│  │  │ Pending Tasks    │───►│ Background Worker                │   │   │
│  │  │ ┌────────────┐   │    │                                  │   │   │
│  │  │ │ Task #3    │   │    │ while (task = queue.next()):     │   │   │
│  │  │ │ Task #4    │   │    │   executor.run(task)             │   │   │
│  │  │ └────────────┘   │    │   emit progress                  │   │   │
│  │  └──────────────────┘    │   save state                     │   │   │
│  │                          └──────────────────────────────────┘   │   │
│  │                                        │                         │   │
│  │                                        ▼                         │   │
│  │  ┌─ Agent Loop ──────────────────────────────────────────────┐  │   │
│  │  │ runAgentLoop() - erweitert für Background-Modus           │  │   │
│  │  │ - Kein SSE zum Client                                     │  │   │
│  │  │ - Fortschritt → Task Service                              │  │   │
│  │  │ - Ergebnis → Task speichern                               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─ Persistence ────────────────────────────────────────────────────┐   │
│  │ data/tasks/                                                       │   │
│  │ ├── queue.yaml           # Aktive Task-Queue                      │   │
│  │ ├── task_abc123.yaml     # Task-Details + Status                  │   │
│  │ └── task_abc123_result.md # Ergebnis                              │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Datenmodell

### Task (`data/tasks/task_{id}.yaml`)

```yaml
id: task_abc123
created_at: "2026-02-07T10:00:00Z"
updated_at: "2026-02-07T10:15:00Z"

# Basis-Info
title: "Deep Research: EU AI Act"
description: "Umfassende Recherche zum EU AI Act und Auswirkungen auf Unternehmen"
type: deep-research  # oder: simple, multi-step, scheduled

# Ursprung
created_by: user  # oder: agent, scheduled
source_session_id: session_123  # optional - welcher Chat hat den Task erstellt
trigger: "Recherchiere ausführlich über den EU AI Act"

# Status
status: in_progress  # pending | in_progress | paused | completed | failed | cancelled
progress: 65  # 0-100
current_step: 7
total_steps: 10

# Ausführung
assigned_agent: researcher
started_at: "2026-02-07T10:01:00Z"
completed_at: null
error: null

# Plan-Referenz (für mehrstufige Tasks)
plan_file: "plans/research-eu-ai-act-abc123.md"

# Schritte (für Fortschritts-Tracking)
steps:
  - id: step_1
    name: "Grundlagen recherchieren"
    status: completed
    started_at: "2026-02-07T10:01:00Z"
    completed_at: "2026-02-07T10:05:00Z"
  - id: step_2
    name: "Risikokategorien analysieren"
    status: completed
    started_at: "2026-02-07T10:05:00Z"
    completed_at: "2026-02-07T10:10:00Z"
  - id: step_3
    name: "Compliance-Anforderungen"
    status: in_progress
    started_at: "2026-02-07T10:10:00Z"
    completed_at: null
  - id: step_4
    name: "Strafen und Durchsetzung"
    status: pending
  - id: step_5
    name: "Report erstellen"
    status: pending

# Ergebnis
result_file: null  # Nach Abschluss: "results/research-eu-ai-act-abc123.md"
result_summary: null  # Kurzzusammenfassung für UI

# Konfiguration
config:
  max_iterations: 50
  timeout_minutes: 30
  notify_on_complete: true
  auto_retry_on_failure: false
```

### Queue (`data/tasks/queue.yaml`)

```yaml
updated_at: "2026-02-07T10:15:00Z"

# Aktive Tasks (werden gerade ausgeführt)
active:
  - task_id: task_abc123
    started_at: "2026-02-07T10:01:00Z"
    priority: normal

# Warteschlange (warten auf Ausführung)
pending:
  - task_id: task_def456
    queued_at: "2026-02-07T10:10:00Z"
    priority: high
  - task_id: task_ghi789
    queued_at: "2026-02-07T10:12:00Z"
    priority: normal

# Konfiguration
settings:
  max_concurrent_tasks: 2
  default_priority: normal
  paused: false  # Queue pausieren
```

---

## Backend-Komponenten

### 1. Task Service (`backend/src/services/taskService.ts`)

```typescript
// Typen
export type TaskStatus = 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'simple' | 'deep-research' | 'multi-step' | 'scheduled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  current_step: number;
  total_steps: number;
  assigned_agent: string;
  steps: TaskStep[];
  // ... weitere Felder
}

// Funktionen
export async function createTask(params: CreateTaskParams): Promise<Task>;
export async function getTask(taskId: string): Promise<Task | null>;
export async function listTasks(filter?: TaskFilter): Promise<Task[]>;
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
export async function updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void>;
export async function cancelTask(taskId: string): Promise<void>;
export async function retryTask(taskId: string): Promise<Task>;
export async function deleteTask(taskId: string): Promise<void>;

// Queue-Management
export async function enqueueTask(taskId: string, priority?: TaskPriority): Promise<void>;
export async function dequeueNextTask(): Promise<Task | null>;
export async function getQueueStatus(): Promise<QueueStatus>;
```

### 2. Task Executor (`backend/src/services/taskExecutor.ts`)

```typescript
// Background Worker der Tasks ausführt
export class TaskExecutor {
  private running: boolean = false;
  private currentTask: Task | null = null;
  private eventEmitter: EventEmitter;

  // Starte den Executor
  async start(): Promise<void>;

  // Stoppe den Executor
  async stop(): Promise<void>;

  // Führe einen einzelnen Task aus
  async executeTask(task: Task): Promise<TaskResult>;

  // Event-Handler für Fortschritts-Updates
  onProgress(callback: (taskId: string, progress: TaskProgress) => void): void;
  onComplete(callback: (taskId: string, result: TaskResult) => void): void;
  onError(callback: (taskId: string, error: Error) => void): void;
}

// Task-spezifische Executor-Logik
async function executeDeepResearch(task: Task, emit: ProgressEmitter): Promise<TaskResult>;
async function executeSimpleTask(task: Task, emit: ProgressEmitter): Promise<TaskResult>;
async function executeMultiStep(task: Task, emit: ProgressEmitter): Promise<TaskResult>;
```

### 3. API Routes (`backend/src/routes/tasks.ts`)

```typescript
// POST /api/tasks - Neuen Task erstellen
tasksRoutes.post('/', async (c) => {
  const { title, description, type, trigger, priority } = await c.req.json();
  const task = await createTask({ title, description, type, trigger });
  await enqueueTask(task.id, priority);
  return c.json(task, 201);
});

// GET /api/tasks - Alle Tasks listen
tasksRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const tasks = await listTasks({ status });
  return c.json({ tasks });
});

// GET /api/tasks/:id - Task-Details
tasksRoutes.get('/:id', async (c) => {
  const task = await getTask(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json(task);
});

// GET /api/tasks/:id/stream - SSE für Live-Updates
tasksRoutes.get('/:id/stream', async (c) => {
  const taskId = c.req.param('id');
  return streamSSE(c, async (stream) => {
    // Subscribe to task updates
    taskExecutor.onProgress((id, progress) => {
      if (id === taskId) {
        stream.writeSSE({ event: 'progress', data: JSON.stringify(progress) });
      }
    });
    // ...
  });
});

// POST /api/tasks/:id/cancel - Task abbrechen
tasksRoutes.post('/:id/cancel', async (c) => {
  await cancelTask(c.req.param('id'));
  return c.json({ success: true });
});

// POST /api/tasks/:id/retry - Task wiederholen
tasksRoutes.post('/:id/retry', async (c) => {
  const task = await retryTask(c.req.param('id'));
  return c.json(task);
});

// DELETE /api/tasks/:id - Task löschen
tasksRoutes.delete('/:id', async (c) => {
  await deleteTask(c.req.param('id'));
  return c.json({ success: true });
});

// GET /api/tasks/queue - Queue-Status
tasksRoutes.get('/queue/status', async (c) => {
  const status = await getQueueStatus();
  return c.json(status);
});
```

---

## Frontend-Komponenten

### 1. Tasks Page (`frontend/src/pages/TasksPage.jsx`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Aufgaben                                                     [+ Neu]   │
│ Hintergrund-Tasks die von Agents bearbeitet werden                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─ Filter ──────────────────────────────────────────────────────────┐  │
│ │ [Alle] [Aktiv] [Wartend] [Abgeschlossen] [Fehlgeschlagen]         │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─ Aktive Tasks ────────────────────────────────────────────────────┐  │
│ │                                                                    │  │
│ │  ┌────────────────────────────────────────────────────────────┐   │  │
│ │  │ 🔄 Deep Research: EU AI Act                                │   │  │
│ │  │ ████████████████░░░░░░░░░░ 65%                             │   │  │
│ │  │                                                            │   │  │
│ │  │ Agent: researcher | Schritt 7/10                           │   │  │
│ │  │ Aktuell: "Compliance-Anforderungen analysieren"            │   │  │
│ │  │ Gestartet: vor 14 Minuten                                  │   │  │
│ │  │                                              [Pause] [Stop]│   │  │
│ │  └────────────────────────────────────────────────────────────┘   │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─ Warteschlange (2) ───────────────────────────────────────────────┐  │
│ │  ┌────────────────────────────────────────────────────────────┐   │  │
│ │  │ ⏳ Compliance Check: DSGVO             Priorität: Hoch     │   │  │
│ │  │    Wartet seit 5 Minuten                        [Abbrechen]│   │  │
│ │  └────────────────────────────────────────────────────────────┘   │  │
│ │  ┌────────────────────────────────────────────────────────────┐   │  │
│ │  │ ⏳ Wettbewerbsanalyse                  Priorität: Normal   │   │  │
│ │  │    Wartet seit 2 Minuten                        [Abbrechen]│   │  │
│ │  └────────────────────────────────────────────────────────────┘   │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─ Abgeschlossen (heute) ───────────────────────────────────────────┐  │
│ │  ┌────────────────────────────────────────────────────────────┐   │  │
│ │  │ ✅ Research: AI Governance             Dauer: 8 Minuten    │   │  │
│ │  │    Abgeschlossen vor 2 Stunden          [Ergebnis ansehen] │   │  │
│ │  └────────────────────────────────────────────────────────────┘   │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Task Detail Modal/Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Task: Deep Research - EU AI Act                              [X]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Status: 🔄 In Bearbeitung                                              │
│ Fortschritt: ████████████████░░░░░░░░░░ 65%                            │
│                                                                         │
│ ┌─ Schritte ────────────────────────────────────────────────────────┐  │
│ │ ✅ 1. Grundlagen recherchieren              4 Min                 │  │
│ │ ✅ 2. Risikokategorien analysieren          5 Min                 │  │
│ │ ✅ 3. Verbotene KI-Praktiken                3 Min                 │  │
│ │ ✅ 4. Hochrisiko-Systeme                    4 Min                 │  │
│ │ ✅ 5. Transparenzpflichten                  3 Min                 │  │
│ │ ✅ 6. Dokumentationspflichten               4 Min                 │  │
│ │ 🔄 7. Compliance-Anforderungen              (läuft...)            │  │
│ │ ⏳ 8. Strafen und Sanktionen                                      │  │
│ │ ⏳ 9. Aufsichtsbehörden                                           │  │
│ │ ⏳ 10. Report erstellen                                           │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─ Live-Log ────────────────────────────────────────────────────────┐  │
│ │ 10:14:32 | Suche nach "EU AI Act compliance requirements"         │  │
│ │ 10:14:35 | 5 Quellen gefunden                                     │  │
│ │ 10:14:38 | Analysiere: European Commission - AI Act Overview      │  │
│ │ 10:14:42 | Analysiere: EUR-Lex - Regulation 2024/1689             │  │
│ │ ...                                                               │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─ Meta ────────────────────────────────────────────────────────────┐  │
│ │ Erstellt: 07.02.2026 10:00 | Gestartet: 10:01 | Agent: researcher │  │
│ │ Geschätzte Restzeit: ~5 Minuten                                   │  │
│ └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                                            [Pausieren] [Abbrechen]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. useTasksHook (`frontend/src/hooks/useTasks.js`)

```javascript
export function useTasks() {
  // State
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Laden
  const loadTasks = useCallback(async (filter) => { ... });

  // Task erstellen
  const createTask = useCallback(async (params) => { ... });

  // Task abbrechen
  const cancelTask = useCallback(async (taskId) => { ... });

  // Live-Updates für einen Task
  const subscribeToTask = useCallback((taskId, onUpdate) => {
    const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
    eventSource.onmessage = (e) => onUpdate(JSON.parse(e.data));
    return () => eventSource.close();
  }, []);

  return { tasks, loading, loadTasks, createTask, cancelTask, subscribeToTask };
}
```

---

## Integration mit Chat

### Supervisor erkennt Task-würdige Anfragen

Erweiterung in `data/agents/supervisor/config.md`:

```markdown
## Task-Erstellung

Erkenne Anfragen die als Hintergrund-Task besser geeignet sind:

**Als Task erstellen bei:**
- "Recherchiere ausführlich..." / "Deep Research..."
- Komplexe mehrstufige Aufgaben
- Aufgaben die länger als 2-3 Minuten dauern würden
- Wenn der Benutzer explizit fragt ("im Hintergrund", "als Task")

**Direkt ausführen bei:**
- Einfache Fragen
- Schnelle Recherchen (1-2 Suchanfragen)
- Interaktive Dialoge

Nutze das `create_task` Tool um einen Hintergrund-Task zu erstellen:
```

### Neues Tool: `create_task`

```typescript
// backend/src/tools/special/create-task.ts
export class CreateTaskTool implements Tool {
  readonly name = 'create_task';

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Erstellt einen Hintergrund-Task für komplexe Aufgaben',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Kurzer Titel des Tasks' },
            description: { type: 'string', description: 'Beschreibung der Aufgabe' },
            type: {
              type: 'string',
              enum: ['deep-research', 'multi-step', 'simple'],
              description: 'Art des Tasks'
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              description: 'Priorität'
            },
            trigger: { type: 'string', description: 'Original-Anfrage des Benutzers' }
          },
          required: ['title', 'type', 'trigger']
        }
      }
    };
  }

  async execute(args): Promise<string> {
    const task = await createTask(args);
    await enqueueTask(task.id, args.priority);
    return JSON.stringify({
      success: true,
      task_id: task.id,
      message: `Task "${task.title}" wurde erstellt und zur Warteschlange hinzugefügt.`
    });
  }
}
```

---

## Dateien-Übersicht

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `backend/src/services/taskService.ts` | Task CRUD, Queue-Management |
| `backend/src/services/taskExecutor.ts` | Background Worker |
| `backend/src/routes/tasks.ts` | REST API für Tasks |
| `backend/src/tools/special/create-task.ts` | Tool zum Task-Erstellen |
| `frontend/src/pages/TasksPage.jsx` | Tasks-Übersicht |
| `frontend/src/components/TaskCard.jsx` | Task-Darstellung |
| `frontend/src/components/TaskDetail.jsx` | Task-Detail-Ansicht |
| `frontend/src/hooks/useTasks.js` | API-Hook für Tasks |
| `data/tasks/queue.yaml` | Persistente Queue |

### Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `backend/src/index.ts` | Tasks-Routes einbinden, Executor starten |
| `backend/src/tools/index.ts` | CreateTaskTool registrieren |
| `backend/src/tools/special/index.ts` | Export hinzufügen |
| `data/agents/supervisor/config.md` | Task-Erstellungs-Anweisungen |
| `frontend/src/App.jsx` | Route `/tasks` hinzufügen |
| `frontend/src/components/Sidebar.jsx` | Navigation hinzufügen |

---

## Implementierungs-Reihenfolge

### Phase 1: Basis-Infrastruktur
1. `data/tasks/` Verzeichnis + queue.yaml
2. `taskService.ts` - CRUD-Operationen
3. `routes/tasks.ts` - Basis-API
4. Test: Tasks erstellen/listen via API

### Phase 2: Executor
5. `taskExecutor.ts` - Background Worker
6. Integration mit `runAgentLoop()`
7. Fortschritts-Updates speichern
8. Test: Task wird ausgeführt

### Phase 3: Live-Updates
9. SSE-Endpoint für Task-Updates
10. Event-Emitter im Executor
11. Test: Fortschritt live verfolgen

### Phase 4: Frontend
12. `useTasks.js` Hook
13. `TasksPage.jsx`
14. `TaskCard.jsx` + `TaskDetail.jsx`
15. Sidebar + Routing

### Phase 5: Chat-Integration
16. `create_task.ts` Tool
17. Supervisor-Prompt erweitern
18. Test: "Recherchiere ausführlich..." erstellt Task

### Phase 6: Polish
19. Benachrichtigungen bei Abschluss
20. Fehlerbehandlung + Retry
21. Task-History + Cleanup

---

## Offene Fragen

1. **Parallelität**: Wie viele Tasks gleichzeitig? (Vorschlag: 2)
2. **Persistenz bei Server-Neustart**: Tasks fortsetzen oder neu starten?
3. **Timeout**: Maximale Laufzeit eines Tasks? (Vorschlag: 30 Min)
4. **Benachrichtigungen**: Browser-Notifications? In-App?
5. **Scheduling**: Sollen Tasks zeitgesteuert gestartet werden können?

---

## Verifikation

1. `POST /api/tasks` erstellt Task → Status: pending
2. Task erscheint in Queue → wird automatisch gestartet
3. `GET /api/tasks/:id/stream` liefert Live-Updates
4. Task wird abgeschlossen → Ergebnis in `results/`
5. Frontend zeigt Fortschritt in Echtzeit
6. "Recherchiere ausführlich..." im Chat erstellt Task
7. Abgeschlossene Tasks zeigen "Ergebnis ansehen"
