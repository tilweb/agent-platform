/**
 * Projektmanagement Routes
 * REST API endpoints for Projektauftrag management
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  createProjektauftrag,
  createFromVorlage,
  listProjektauftraege,
  getProjektauftragDetails,
  updateProjektauftrag,
  updateProjektauftragStep,
  removeProjektauftrag,
  getProjektauftragStats,
  searchProjektauftraege,
  validateStep,
  calculateCompleteness,
  listVorlagen,
  getVorlageDetails,
} from './service';
import {
  getAllKnowledge,
  getStepKnowledge,
  getRawStepKnowledge,
  saveStepKnowledge,
  saveStepKnowledgeJson,
  generateAnalysisPrompt,
  getPruefkriterien,
  getTypischeFehler,
  getVerbesserungsvorschlaege,
} from './knowledge';
import { analyzeStep, analyzeGesamt, hasEnoughDataForAnalysis, buildStepChatSystemPrompt } from './analysis';
import { llmService, type Message } from '../../services/llm';
import { getConfig, saveConfig } from './storage';
import {
  exportToExcel,
  exportToCsv,
  buildTemplateExcel,
  buildTemplateCsv,
  parseExcel,
  parseCsv,
  diffConfig,
  applyImport,
  lockedWarnings,
} from './config-io';
import type { ProjektauftragFilters } from './types';
import { importProjektauftrag, importProjektidee, extractStepFromFiles } from './import-service';
import {
  createStatusbericht as createSB,
  listStatusberichte,
  getStatusberichtDetails,
  updateStatusbericht as updateSB,
  removeStatusbericht,
  getDashboard,
} from './statusbericht-service';
import {
  listIdeen,
  getIdeeDetails,
  createIdee,
  updateIdee,
  updateIdeeStep,
  removeIdee,
  createAuftragFromIdee,
} from './idee-service';
import { VersionConflictError } from './concurrency';
// Aus routes.ts ausgegliederte Sub-Apps (Phase A, E, F).
import { projekteRoutes } from './routes/projekte';
import { lessonsLearnedRoutes } from './routes/lessons-learned';
import { abschlussRoutes } from './routes/abschluss';
import { portfoliosRoutes } from './routes/portfolios';
import { requireAppAccess } from '../permissions-middleware';
import {
  getEffectiveIdeeRole,
  getEffectiveAuftragRole,
  listAccessibleIdeeIds,
  listAccessibleAuftragIds,
  replaceIdeePermissions,
  replaceAuftragPermissions,
} from './permissions';
import type { AuftragsRole } from './types';
import { getCurrentUserId } from '../../auth/middleware';
import {
  generateDocument,
  mapProjektauftragToDocument,
  mapStatusberichtToDocument,
  mapProjektideeToDocument,
  getMimeType,
  getFileExtension,
  type DocumentFormat,
} from '../../services/documentGenerator';
import type { Context } from 'hono';

const projektmanagement = new Hono();

// Berechtigungs-Pruefung: jeder Endpunkt unter /apps/projektmanagement
// braucht eine User-Rolle (owner/editor/viewer) auf dieser App. Ohne wird 403.
projektmanagement.use('*', requireAppAccess('projektmanagement'));

// Ausgegliederte Sub-Apps (Phase A, E, F). Die Middleware oben deckt sie
// auch ab — Hono propagiert Middlewares zu gemounteten Routes, solange sie
// vor dem `.route()`-Call registriert wurden.
projektmanagement.route('/', projekteRoutes);
projektmanagement.route('/', lessonsLearnedRoutes);
projektmanagement.route('/', abschlussRoutes);
projektmanagement.route('/', portfoliosRoutes);

// ============== Phase-2 Permission Guards ==============

const ROLE_RANK: Record<AuftragsRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * App-Level Editor- oder Owner-Rolle erforderlich (z.B. fuer "Neu anlegen").
 * `requireAppAccess` hat appRole bereits in den Context gesetzt.
 */
function denyIfNotAppEditor(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AuftragsRole | undefined;
  if (appRole !== 'owner' && appRole !== 'editor') {
    return { error: 'App-Editor- oder -Owner-Rolle erforderlich.' };
  }
  return null;
}

/**
 * App-Level Owner-Rolle erforderlich (z.B. fuer App-Settings).
 */
function denyIfNotAppOwner(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AuftragsRole | undefined;
  if (appRole !== 'owner') {
    return { error: 'App-Owner-Rolle erforderlich.' };
  }
  return null;
}

/**
 * Auftrags-/Idee-Level: User muss mindestens `required` auf der konkreten
 * Resource haben. Liefert `null` bei OK, sonst ein Error-Payload (403).
 */
async function denyIfBelowIdeeRole(
  userId: string,
  ideeId: string,
  required: AuftragsRole,
): Promise<{ error: string; status: 403 | 404 } | null> {
  const role = await getEffectiveIdeeRole(userId, ideeId);
  if (!role) {
    // Keine Rolle = entweder Idee existiert nicht oder kein Zugriff. Wir
    // returnen 403 generisch — kein Probing welche Ideen es gibt.
    return { error: 'Keine Berechtigung fuer diese Idee.', status: 403 };
  }
  if (ROLE_RANK[role] < ROLE_RANK[required]) {
    return { error: `Berechtigung unzureichend: ${role} (mind. ${required} noetig).`, status: 403 };
  }
  return null;
}

async function denyIfBelowAuftragRole(
  userId: string,
  auftragId: string,
  required: AuftragsRole,
): Promise<{ error: string; status: 403 | 404 } | null> {
  const role = await getEffectiveAuftragRole(userId, auftragId);
  if (!role) {
    return { error: 'Keine Berechtigung fuer diesen Auftrag.', status: 403 };
  }
  if (ROLE_RANK[role] < ROLE_RANK[required]) {
    return { error: `Berechtigung unzureichend: ${role} (mind. ${required} noetig).`, status: 403 };
  }
  return null;
}

// ============== Config Endpoints ==============

/**
 * GET /api/apps/projektmanagement/config
 * Get app configuration (select options etc.)
 */
projektmanagement.get('/config', async (c) => {
  try {
    const config = await getConfig();
    return c.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    return c.json({ error: 'Failed to get config' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/config
 * Update app configuration — App-Owner-only.
 */
projektmanagement.put('/config', async (c) => {
  try {
    const denied = denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const body = await c.req.json();
    await saveConfig(body);
    return c.json(body);
  } catch (error) {
    console.error('Error saving config:', error);
    return c.json({ error: 'Failed to save config' }, 500);
  }
});

// ============== Config Import/Export ==============

const CONFIG_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * GET /api/apps/projektmanagement/config/export?format=xlsx|csv
 * Aktuelle Auswahllisten als Datei (Transport zwischen Kunden-Instanzen). App-Owner-only.
 */
projektmanagement.get('/config/export', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  const format = c.req.query('format') === 'csv' ? 'csv' : 'xlsx';
  try {
    const config = await getConfig();
    if (format === 'csv') {
      return new Response(exportToCsv(config), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pm-auswahllisten.csv"',
        },
      });
    }
    const buffer = await exportToExcel(config);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': CONFIG_XLSX_MIME,
        'Content-Disposition': 'attachment; filename="pm-auswahllisten.xlsx"',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting config:', error);
    return c.json({ error: 'Failed to export config' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/config/template?format=xlsx|csv
 * Leeres Template: editierbare Listen leer, gesperrte Listen vorbefuellt. App-Owner-only.
 */
projektmanagement.get('/config/template', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  const format = c.req.query('format') === 'csv' ? 'csv' : 'xlsx';
  try {
    const config = await getConfig();
    if (format === 'csv') {
      return new Response(buildTemplateCsv(config), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pm-auswahllisten-template.csv"',
        },
      });
    }
    const buffer = await buildTemplateExcel(config);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': CONFIG_XLSX_MIME,
        'Content-Disposition': 'attachment; filename="pm-auswahllisten-template.xlsx"',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error building config template:', error);
    return c.json({ error: 'Failed to build template' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/config/import/preview
 * Parst eine hochgeladene .xlsx/.csv, liefert Listen + Diff + Warnungen — speichert NICHT.
 * App-Owner-only.
 */
projektmanagement.post('/config/import/preview', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return c.json({ error: 'Keine Datei hochgeladen' }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Datei zu groß (max. 5 MB)' }, 400);

    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let parsed;
    if (name.endsWith('.csv')) parsed = parseCsv(buf.toString('utf-8'));
    else if (name.endsWith('.xlsx')) parsed = await parseExcel(buf);
    else return c.json({ error: 'Nicht unterstütztes Format. Bitte .xlsx oder .csv verwenden.' }, 400);

    const current = await getConfig();
    const diff = diffConfig(current, parsed.lists);
    const warnings = [...parsed.warnings, ...lockedWarnings(current, parsed.lists)];
    return c.json({ lists: parsed.lists, diff, warnings });
  } catch (error) {
    console.error('Error previewing config import:', error);
    return c.json({ error: 'Import-Vorschau fehlgeschlagen' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/config/import/apply
 * Body: { lists, selectedKeys }. Ersetzt die ausgewaehlten Listen (locked: nur Labels). App-Owner-only.
 */
projektmanagement.post('/config/import/apply', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json();
    const lists = body?.lists;
    const selectedKeys = Array.isArray(body?.selectedKeys) ? body.selectedKeys : [];
    if (!lists || typeof lists !== 'object') return c.json({ error: 'Ungültige Importdaten' }, 400);
    if (selectedKeys.length === 0) return c.json({ error: 'Keine Liste zum Übernehmen ausgewählt' }, 400);

    const current = await getConfig();
    const merged = applyImport(current, lists, selectedKeys);
    await saveConfig(merged);
    return c.json({ config: merged, applied: selectedKeys });
  } catch (error) {
    console.error('Error applying config import:', error);
    return c.json({ error: 'Import fehlgeschlagen' }, 500);
  }
});

// ============== Import Endpoint ==============

/**
 * POST /api/apps/projektmanagement/projektauftraege/import
 * Import Projektauftrag from multiple documents
 * Must be registered BEFORE /:id route
 */
projektmanagement.post('/projektauftraege/import', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const formData = await c.req.formData();

    // Extract files from FormData
    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
    ]);

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        // Validate file count
        if (files.length >= 10) {
          return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        }

        // Validate file size (50MB)
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu groß (max. 50 MB)` }, 400);
        }

        // Validate MIME type
        if (!allowedMimeTypes.has(value.type)) {
          return c.json({ error: `Dateityp "${value.type}" nicht unterstützt für "${value.name}"` }, 400);
        }

        const arrayBuffer = await value.arrayBuffer();
        files.push({
          buffer: Buffer.from(arrayBuffer),
          filename: value.name,
          mimeType: value.type,
        });
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
    }

    console.log(`[PM-Import] Received ${files.length} files for import`);

    // SSE-Stream: Phasen-Events landen direkt beim Client. Heartbeats waehrend
    // langer Vision/LLM-Calls verhindern dass UI als "haengt" wahrgenommen wird.
    return streamSSE(c, async (stream) => {
      try {
        await importProjektauftrag(files, userId, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        console.error('Error importing Projektauftrag:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error importing Projektauftrag:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Import fehlgeschlagen' },
      500
    );
  }
});

/**
 * Step-bezogener, additiver Dokument-Import (Projektauftrag-Wizard).
 * Extrahiert NUR die Felder eines Steps und gibt sie zurück (kein Persist);
 * der additive Merge passiert im Frontend. Muss VOR /:id registriert sein.
 */
projektmanagement.post('/projektauftraege/import-step/:step', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const step = parseInt(c.req.param('step'), 10);
    if (!Number.isInteger(step) || step < 1 || step > 7) {
      return c.json({ error: 'Ungültiger Step (erlaubt: 1–7)' }, 400);
    }

    const formData = await c.req.formData();
    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    let totalBytes = 0;
    const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
    ]);

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        if (files.length >= 10) return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu groß (max. 50 MB)` }, 400);
        }
        totalBytes += value.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return c.json({ error: 'Gesamtgröße aller Dateien überschreitet 200 MB' }, 400);
        }
        if (!allowedMimeTypes.has(value.type)) {
          return c.json({ error: `Dateityp "${value.type}" nicht unterstützt für "${value.name}"` }, 400);
        }
        const arrayBuffer = await value.arrayBuffer();
        files.push({ buffer: Buffer.from(arrayBuffer), filename: value.name, mimeType: value.type });
      }
    }

    if (files.length === 0) return c.json({ error: 'Keine Dateien hochgeladen' }, 400);

    console.log(`[PM-StepImport] Step ${step}: received ${files.length} files`);

    return streamSSE(c, async (stream) => {
      try {
        await extractStepFromFiles(step, files, userId, async (event) => {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
        });
      } catch (error) {
        console.error('Error in step import:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error in step import:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Import fehlgeschlagen' }, 500);
  }
});

// ============== Projektauftrag Endpoints ==============

/**
 * POST /api/apps/projektmanagement/projektauftraege
 * Create a new Projektauftrag — App-Editor- oder -Owner-Rolle erforderlich.
 * Der erstellende User wird Auftrags-Owner ueber `created_by` (Default-Owner-
 * Fallback im Permission-Resolver).
 */
projektmanagement.post('/projektauftraege', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const body = await c.req.json();
    const projektauftrag = await createProjektauftrag(body, userId);
    return c.json({ projektauftrag }, 201);
  } catch (error) {
    console.error('Error creating Projektauftrag:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create Projektauftrag' },
      500
    );
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/from-vorlage
 * Create a new Projektauftrag from a Vorlage — App-Editor+ erforderlich.
 */
projektmanagement.post('/projektauftraege/from-vorlage', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const { vorlageId } = await c.req.json<{ vorlageId: string }>();
    if (!vorlageId) {
      return c.json({ error: 'vorlageId is required' }, 400);
    }

    const projektauftrag = await createFromVorlage(vorlageId, userId);

    if (!projektauftrag) {
      return c.json({ error: 'Vorlage not found' }, 404);
    }

    return c.json({ projektauftrag }, 201);
  } catch (error) {
    console.error('Error creating from Vorlage:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create from Vorlage' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege
 * Listet nur Auftraege auf die der eingeloggte User mind. viewer-Rolle hat.
 * App-Editor/Owner sieht nicht automatisch alles — nur wo er Auftrags-Mitglied
 * ist (oder Ersteller ist via ownerId).
 *
 * Pagination (TD3): `?limit=N&offset=M`. Default 500 / max 1000. `status`
 * wird in der Storage-Schicht gefiltert; andere Filter in-memory. Permission-
 * Filter laeuft NACH dem Fetch — Seiten koennen sparser sein als `limit` fuer
 * Nicht-App-Owner. Clients sollten `pagination.hasMore` lesen.
 */
projektmanagement.get('/projektauftraege', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const status = c.req.query('status') as ProjektauftragFilters['status'];
    const project_type = c.req.query('project_type');
    const projektleiter = c.req.query('projektleiter');
    const search = c.req.query('search');
    const from_date = c.req.query('from_date');
    const to_date = c.req.query('to_date');

    const filters: ProjektauftragFilters = {};
    if (status) filters.status = status;
    if (project_type) filters.project_type = project_type;
    if (projektleiter) filters.projektleiter = projektleiter;
    if (search) filters.search = search;
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;

    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
    const parsedOffset = offsetParam ? parseInt(offsetParam, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 500;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const all = await listProjektauftraege(
      Object.keys(filters).length > 0 ? filters : undefined,
      { limit, offset },
    );
    const accessible = await listAccessibleAuftragIds(userId, all);
    const projektauftraege = all
      .filter((a) => accessible.has(a.id))
      .map((a) => ({ ...a, role: accessible.get(a.id) }));

    const hasMore = all.length >= limit;

    return c.json({
      projektauftraege,
      pagination: { limit, offset, hasMore },
    });
  } catch (error) {
    console.error('Error listing Projektauftraege:', error);
    return c.json({ error: 'Failed to list Projektauftraege' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/stats
 * Stats nur ueber Auftraege auf die der User Zugriff hat.
 */
projektmanagement.get('/projektauftraege/stats', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const all = await listProjektauftraege();
    const accessible = await listAccessibleAuftragIds(userId, all);
    const visibleIds = new Set(accessible.keys());
    const visible = all.filter((a) => visibleIds.has(a.id));
    const stats = await getProjektauftragStats(visible);
    return c.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    return c.json({ error: 'Failed to get statistics' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:id
 * Get Projektauftrag details — Auftrags-Viewer+ erforderlich.
 */
projektmanagement.get('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const projektauftrag = await getProjektauftragDetails(projektId);
    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }
    const completeness = calculateCompleteness(projektauftrag);
    return c.json({ projektauftrag, completeness });
  } catch (error) {
    console.error('Error getting Projektauftrag:', error);
    return c.json({ error: 'Failed to get Projektauftrag' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:id
 * Update Projektauftrag — Auftrags-Editor+ erforderlich.
 */
projektmanagement.put('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const { expected_version, force, ...updates } = body ?? {};
    // permissions duerfen NIE ueber den normalen Update-Pfad gesetzt werden —
    // dafuer ist /permissions (owner-only). Sonst koennten Editoren ihre
    // eigenen Rechte hochstufen.
    delete (updates as Record<string, unknown>).permissions;

    const projektauftrag = await updateProjektauftrag(projektId, updates, {
      expectedVersion: expected_version,
      force: !!force,
    });

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    return c.json({ projektauftrag });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error updating Projektauftrag:', error);
    return c.json({ error: 'Failed to update Projektauftrag' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:id/step/:step
 * Update specific step of Projektauftrag — Auftrags-Editor+ erforderlich.
 */
projektmanagement.put('/projektauftraege/:id/step/:step', async (c) => {
  try {
    const projektId = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const { expected_version, force, ...data } = body ?? {};

    if (isNaN(step) || step < 1 || step > 9) {
      return c.json({ error: 'Invalid step number' }, 400);
    }

    const projektauftrag = await updateProjektauftragStep(projektId, step, data, {
      expectedVersion: expected_version,
      force: !!force,
    });

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    // Validate the step
    const validation = validateStep(projektauftrag, step);
    const completeness = calculateCompleteness(projektauftrag);

    return c.json({ projektauftrag, validation, completeness });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error updating step:', error);
    return c.json({ error: 'Failed to update step' }, 500);
  }
});

/**
 * DELETE /api/apps/projektmanagement/projektauftraege/:id
 * Delete a Projektauftrag — Auftrags-Owner-only.
 */
projektmanagement.delete('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'owner');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const deleted = await removeProjektauftrag(projektId);
    if (!deleted) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Projektauftrag:', error);
    return c.json({ error: 'Failed to delete Projektauftrag' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/:id/validate/:step
 * Validate a specific step — Viewer+ (nur lesend, keine Mutation).
 */
projektmanagement.post('/projektauftraege/:id/validate/:step', async (c) => {
  try {
    const projektId = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const projektauftrag = await getProjektauftragDetails(projektId);
    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    const validation = validateStep(projektauftrag, step);
    return c.json({ validation });
  } catch (error) {
    console.error('Error validating step:', error);
    return c.json({ error: 'Failed to validate step' }, 500);
  }
});

// ============== Search ==============

/**
 * GET /api/apps/projektmanagement/search
 * Such-Endpoint — gefiltert auf berechtigte Auftraege.
 */
projektmanagement.get('/search', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const query = c.req.query('q');
    if (!query) {
      return c.json({ error: 'Missing search query' }, 400);
    }
    const results = await searchProjektauftraege(query);
    const accessible = await listAccessibleAuftragIds(userId, results);
    const filtered = results.filter((r) => accessible.has(r.id));
    return c.json({ projektauftraege: filtered });
  } catch (error) {
    console.error('Error searching:', error);
    return c.json({ error: 'Failed to search' }, 500);
  }
});

// ============== Vorlagen Endpoints ==============

/**
 * GET /api/apps/projektmanagement/vorlagen
 * List all available Vorlagen
 */
projektmanagement.get('/vorlagen', async (c) => {
  try {
    const vorlagen = await listVorlagen();
    return c.json({ vorlagen });
  } catch (error) {
    console.error('Error listing Vorlagen:', error);
    return c.json({ error: 'Failed to list Vorlagen' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/vorlagen/:id
 * Get specific Vorlage
 */
projektmanagement.get('/vorlagen/:id', async (c) => {
  try {
    const vorlageId = c.req.param('id');
    const vorlage = await getVorlageDetails(vorlageId);

    if (!vorlage) {
      return c.json({ error: 'Vorlage not found' }, 404);
    }

    return c.json({ vorlage });
  } catch (error) {
    console.error('Error getting Vorlage:', error);
    return c.json({ error: 'Failed to get Vorlage' }, 500);
  }
});

// ============== KI-Analyse Endpoints ==============

/**
 * POST /api/apps/projektmanagement/analyse/step/:stepNumber
 * Analyze a specific step using LLM against Masterclass criteria
 */
projektmanagement.post('/analyse/step/:stepNumber', async (c) => {
  try {
    const stepNumber = parseInt(c.req.param('stepNumber'), 10);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    // Validate step number
    if (isNaN(stepNumber) || stepNumber < 2 || stepNumber > 7) {
      return c.json(
        { error: 'Analyse nur für Schritte 2-7 verfügbar' },
        400
      );
    }

    const { projektauftrag } = await c.req.json();

    if (!projektauftrag) {
      return c.json(
        { error: 'projektauftrag ist erforderlich' },
        400
      );
    }

    // Auftrags-Editor+ erforderlich (Analyse persistiert ggf. step-analyses).
    if (projektauftrag.id) {
      const denied = await denyIfBelowAuftragRole(userId, projektauftrag.id, 'editor');
      if (denied) return c.json({ error: denied.error }, denied.status);
    }

    if (!hasEnoughDataForAnalysis(stepNumber, projektauftrag)) {
      return c.json(
        { error: 'Nicht genügend Daten für Analyse vorhanden. Bitte füllen Sie zuerst die Felder aus.' },
        400
      );
    }

    const analysis = await analyzeStep(stepNumber, projektauftrag, userId);

    return c.json({ analysis });
  } catch (error) {
    console.error('Error analyzing step:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Analyse fehlgeschlagen' },
      500
    );
  }
});

/**
 * POST /api/apps/projektmanagement/analyse/gesamt
 * Generate overall project assessment (Gesamtbewertung)
 */
projektmanagement.post('/analyse/gesamt', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const { projektauftrag, stepAnalyses } = await c.req.json();

    if (!projektauftrag) {
      return c.json(
        { error: 'projektauftrag ist erforderlich' },
        400
      );
    }

    if (projektauftrag.id) {
      const denied = await denyIfBelowAuftragRole(userId, projektauftrag.id, 'editor');
      if (denied) return c.json({ error: denied.error }, denied.status);
    }

    const hasMinimumData = projektauftrag.name &&
      (projektauftrag.goals || projektauftrag.scope || (projektauftrag.tasks && projektauftrag.tasks.length > 0));

    if (!hasMinimumData) {
      return c.json(
        { error: 'Nicht genügend Projektdaten für Gesamtbewertung. Bitte füllen Sie mindestens Ziele, Umfang oder Aufgaben aus.' },
        400
      );
    }

    const gesamtbewertung = await analyzeGesamt(projektauftrag, stepAnalyses, userId);

    return c.json({ gesamtbewertung });
  } catch (error) {
    console.error('Error generating Gesamtbewertung:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Gesamtbewertung fehlgeschlagen' },
      500
    );
  }
});

// ============== Knowledge Endpoints ==============

/**
 * GET /api/apps/projektmanagement/knowledge
 * List all available PM Masterclass knowledge
 */
projektmanagement.get('/knowledge', async (c) => {
  try {
    const knowledge = await getAllKnowledge();

    // Return summary of each step's knowledge
    const summaries = knowledge.map((k) => ({
      step: k.meta.step,
      title: k.meta.title,
      description: k.meta.description,
      hasPruefkriterien: !!k.pruefkriterien,
      hasTypischeFehler: !!k.typische_fehler,
      hasVerbesserungsvorschlaege: !!k.verbesserungsvorschlaege,
    }));

    return c.json({ knowledge: summaries });
  } catch (error) {
    console.error('Error listing knowledge:', error);
    return c.json({ error: 'Failed to list knowledge' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step
 * Get complete knowledge for a specific step
 */
projektmanagement.get('/knowledge/:step', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const knowledge = await getStepKnowledge(step);

    if (!knowledge) {
      return c.json({ error: 'Knowledge not found for step' }, 404);
    }

    return c.json({ knowledge });
  } catch (error) {
    console.error('Error getting knowledge:', error);
    return c.json({ error: 'Failed to get knowledge' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/knowledge/:step/chat
 * Wissenspool-Chat für einen Step: streamt die Antwort (SSE), geerdet auf das
 * Masterclass-Wissen des Steps + die aktuellen Eingaben des Nutzers.
 * Body: { messages: [{role:'user'|'assistant', content:string}], projektauftrag }
 */
projektmanagement.post('/knowledge/:step/chat', async (c) => {
  const step = parseInt(c.req.param('step'), 10);
  if (isNaN(step) || step < 1 || step > 7) {
    return c.json({ error: 'Invalid step number (1-7)' }, 400);
  }

  const userId = getCurrentUserId(c);
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  let body: { messages?: unknown; projektauftrag?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Nachrichten säubern: nur user/assistant, nicht-leerer Text, letzte 20.
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const history: Message[] = rawMessages
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== ''
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (history.length === 0) {
    return c.json({ error: 'Keine Nachricht übermittelt' }, 400);
  }

  const projektauftrag = (body.projektauftrag ?? {}) as Parameters<typeof buildStepChatSystemPrompt>[1];
  const systemPrompt = await buildStepChatSystemPrompt(step, projektauftrag);
  const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...history];

  const usageContext = {
    triggeringUserId: userId,
    source: 'projektmanagement' as const,
    operation: `knowledge_chat_step_${step}`,
  };

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of llmService.streamChat(messages, undefined, usageContext)) {
        const text = chunk?.choices?.[0]?.delta?.content;
        if (text) {
          await stream.writeSSE({ event: 'token', data: JSON.stringify({ text }) });
        }
      }
      await stream.writeSSE({ event: 'done', data: '{}' });
    } catch (error) {
      console.error('Error in knowledge chat:', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: error instanceof Error ? error.message : 'Chat fehlgeschlagen' }),
      });
    }
  });
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/pruefkriterien
 * Get Prüfkriterien (validation criteria) for a step
 */
projektmanagement.get('/knowledge/:step/pruefkriterien', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const pruefkriterien = await getPruefkriterien(step);

    if (!pruefkriterien) {
      return c.json({ error: 'Prüfkriterien not found for step' }, 404);
    }

    return c.json({ pruefkriterien });
  } catch (error) {
    console.error('Error getting Prüfkriterien:', error);
    return c.json({ error: 'Failed to get Prüfkriterien' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/fehler
 * Get typical errors for a step
 */
projektmanagement.get('/knowledge/:step/fehler', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const fehler = await getTypischeFehler(step);

    if (!fehler) {
      return c.json({ error: 'Typische Fehler not found for step' }, 404);
    }

    return c.json({ typische_fehler: fehler });
  } catch (error) {
    console.error('Error getting typische Fehler:', error);
    return c.json({ error: 'Failed to get typische Fehler' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/verbesserungen
 * Get improvement suggestions for a step
 */
projektmanagement.get('/knowledge/:step/verbesserungen', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const verbesserungen = await getVerbesserungsvorschlaege(step);

    if (!verbesserungen) {
      return c.json({ error: 'Verbesserungsvorschläge not found for step' }, 404);
    }

    return c.json({ verbesserungsvorschlaege: verbesserungen });
  } catch (error) {
    console.error('Error getting Verbesserungsvorschläge:', error);
    return c.json({ error: 'Failed to get Verbesserungsvorschläge' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/prompt
 * Get generated analysis prompt for LLM analysis
 */
projektmanagement.get('/knowledge/:step/prompt', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const prompt = await generateAnalysisPrompt(step);

    if (!prompt) {
      return c.json({ error: 'Could not generate prompt for step' }, 404);
    }

    return c.json({ prompt });
  } catch (error) {
    console.error('Error generating prompt:', error);
    return c.json({ error: 'Failed to generate prompt' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/raw
 * Get raw YAML content for editing
 */
projektmanagement.get('/knowledge/:step/raw', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const yaml = await getRawStepKnowledge(step);

    if (!yaml) {
      return c.json({ error: 'Knowledge not found for step' }, 404);
    }

    return c.json({ step, yaml });
  } catch (error) {
    console.error('Error getting raw knowledge:', error);
    return c.json({ error: 'Failed to get raw knowledge' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/knowledge/:step
 * Update knowledge for a step (accepts JSON object, serializes to YAML)
 */
projektmanagement.put('/knowledge/:step', async (c) => {
  try {
    const denied = denyIfNotAppOwner(c);
    if (denied) return c.json(denied, 403);
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const body = await c.req.json();
    const { knowledge: knowledgeData } = body;

    if (!knowledgeData || typeof knowledgeData !== 'object') {
      return c.json({ error: 'Missing or invalid knowledge field' }, 400);
    }

    await saveStepKnowledgeJson(step, knowledgeData);

    // Return the saved knowledge to confirm
    const knowledge = await getStepKnowledge(step);
    return c.json({ knowledge });
  } catch (error: any) {
    console.error('Error saving knowledge:', error);
    return c.json({ error: 'Failed to save knowledge' }, 500);
  }
});

// ============== Export Endpoints ==============

/**
 * GET /api/apps/projektmanagement/projektauftraege/:id/export/:format
 * Export Projektauftrag in specified format
 * Supported formats: json, csv, xlsx, pdf, docx
 */
projektmanagement.get('/projektauftraege/:id/export/:format', async (c) => {
  try {
    const projektId = c.req.param('id');
    const format = c.req.param('format');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const projektauftrag = await getProjektauftragDetails(projektId);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    const filename = sanitizeFilename(projektauftrag.name || 'projektauftrag');

    switch (format) {
      case 'json':
        return c.json(projektauftrag, 200, {
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        });

      case 'csv':
        // Simple CSV export for tasks/milestones
        const csvContent = generateCSV(projektauftrag);
        return new Response(csvContent, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });

      case 'xlsx':
      case 'pdf':
      case 'docx': {
        // Document export using documentGenerator service
        const documentData = mapProjektauftragToDocument(projektauftrag);
        const buffer = await generateDocument(documentData, format as DocumentFormat);
        const mimeType = getMimeType(format as DocumentFormat);
        const extension = getFileExtension(format as DocumentFormat);

        return new Response(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      default:
        return c.json({ error: 'Unsupported format. Use json, csv, xlsx, pdf, or docx.' }, 400);
    }
  } catch (error) {
    console.error('Error exporting:', error);
    return c.json({ error: 'Failed to export' }, 500);
  }
});

// ============== Statusbericht Endpoints ==============

/**
 * GET /api/apps/projektmanagement/statusberichte/dashboard
 * Dashboard: gefiltert auf Auftraege mit min. viewer-Rolle.
 */
projektmanagement.get('/statusberichte/dashboard', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const allEntries = await getDashboard();
    const allAuftraege = await listProjektauftraege();
    const accessible = await listAccessibleAuftragIds(userId, allAuftraege);
    const entries = allEntries.filter((e) => accessible.has(e.projekt_id));
    return c.json({ dashboard: entries });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return c.json({ error: 'Failed to get dashboard' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte
 * Create a new Statusbericht — Auftrags-Editor+ erforderlich (Statusberichte
 * erben vom Auftrag).
 */
projektmanagement.post('/projektauftraege/:projektId/statusberichte', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const sb = await createSB(projektId, userId);
    return c.json({ statusbericht: sb }, 201);
  } catch (error) {
    console.error('Error creating Statusbericht:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create Statusbericht' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte
 * List all Statusberichte for a Projekt — Auftrags-Viewer+ erforderlich.
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const berichte = await listStatusberichte(projektId);
    return c.json({ statusberichte: berichte });
  } catch (error) {
    console.error('Error listing Statusberichte:', error);
    return c.json({ error: 'Failed to list Statusberichte' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Get single Statusbericht
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const sb = await getStatusberichtDetails(projektId, sbId);
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ statusbericht: sb });
  } catch (error) {
    console.error('Error getting Statusbericht:', error);
    return c.json({ error: 'Failed to get Statusbericht' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Update Statusbericht — Auftrags-Editor+ erforderlich (vererbt vom Auftrag).
 */
projektmanagement.put('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const { expected_version, force, ...updates } = body ?? {};
    const sb = await updateSB(projektId, sbId, updates, {
      expectedVersion: expected_version,
      force: !!force,
    });
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ statusbericht: sb });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error updating Statusbericht:', error);
    return c.json({ error: 'Failed to update Statusbericht' }, 500);
  }
});

/**
 * DELETE /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Delete Statusbericht — Auftrags-Editor+ erforderlich (Bearbeiter darf SB
 * loeschen, nicht erst Owner).
 */
projektmanagement.delete('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const deleted = await removeStatusbericht(projektId, sbId);
    if (!deleted) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Statusbericht:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to delete Statusbericht' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId/export/:format
 * Export Statusbericht — Auftrags-Viewer+ erforderlich.
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte/:sbId/export/:format', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const format = c.req.param('format');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const sb = await getStatusberichtDetails(projektId, sbId);
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }

    // Get full Projektauftrag for EVM + Risk Movement calculations
    const projekt = await getProjektauftragDetails(projektId);
    const projektName = projekt?.name || 'Unbekannt';

    const filename = sanitizeFilename(`Statusbericht_${sb.nummer}_${projektName}`);

    switch (format) {
      case 'json':
        return c.json(sb, 200, {
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        });

      case 'xlsx':
      case 'pdf':
      case 'docx': {
        const documentData = mapStatusberichtToDocument(sb, projekt);
        const buffer = await generateDocument(documentData, format as DocumentFormat);
        const mimeType = getMimeType(format as DocumentFormat);
        const extension = getFileExtension(format as DocumentFormat);

        return new Response(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      default:
        return c.json({ error: 'Unsupported format. Use json, xlsx, pdf, or docx.' }, 400);
    }
  } catch (error) {
    console.error('Error exporting Statusbericht:', error);
    return c.json({ error: 'Failed to export Statusbericht' }, 500);
  }
});

// ============== Helper Functions ==============

/**
 * Sanitize filename by removing/replacing invalid characters
 * and encoding for HTTP headers (RFC 5987)
 */
function sanitizeFilename(name: string): string {
  // Replace special characters and spaces
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 100);

  // For Content-Disposition, we need to handle non-ASCII characters
  // Use ASCII-safe version for compatibility
  return sanitized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x00-\x7F]/g, '_');  // Replace non-ASCII with underscore
}

function generateCSV(projektauftrag: any): string {
  const lines: string[] = [];

  // Header info
  lines.push('Projektauftrag Export');
  lines.push(`Name,${projektauftrag.name}`);
  lines.push(`Projektleiter,${projektauftrag.projektleiter}`);
  lines.push(`Auftraggeber,${projektauftrag.auftraggeber}`);
  lines.push(`Start,${projektauftrag.start_date}`);
  lines.push(`Ende,${projektauftrag.end_date}`);
  lines.push('');

  // Tasks
  lines.push('Aufgaben');
  lines.push('Name,Verantwortlich,Start,Ende,Aufwand,Status');
  for (const task of projektauftrag.tasks || []) {
    lines.push(`"${task.name}","${task.responsible}",${task.start_date},${task.end_date},${task.effort},${task.status || ''}`);
  }
  lines.push('');

  // Milestones
  lines.push('Meilensteine');
  lines.push('Name,Datum,Beschreibung');
  for (const ms of projektauftrag.milestones || []) {
    lines.push(`"${ms.name}",${ms.date},"${ms.description || ''}"`);
  }
  lines.push('');

  // Budget
  lines.push('Budget');
  lines.push('Position,Anbieter,Betrag');
  for (const item of projektauftrag.budget || []) {
    lines.push(`"${item.item}","${item.provider || ''}",${item.amount}`);
  }

  return lines.join('\n');
}

// ============== Projektidee Endpoints ==============
//
// Eigene Entitaet (siehe idee-service.ts). Alle Routes leben unter
// /api/apps/projektmanagement/projektideen. Auftrag-aus-Idee-Generierung via
// POST /:id/erstelle-auftrag.

projektmanagement.get('/projektideen', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const all = await listIdeen();
    const accessible = await listAccessibleIdeeIds(userId, all);
    const projektideen = all
      .filter((i) => accessible.has(i.id))
      .map((i) => ({ ...i, role: accessible.get(i.id) }));
    return c.json({ projektideen });
  } catch (error) {
    console.error('Error listing Projektideen:', error);
    return c.json({ error: 'Failed to list Projektideen' }, 500);
  }
});

projektmanagement.post('/projektideen', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const body = await c.req.json();
    const idee = await createIdee(body, userId);
    return c.json({ projektidee: idee }, 201);
  } catch (error) {
    console.error('Error creating Projektidee:', error);
    return c.json({ error: 'Failed to create Projektidee' }, 500);
  }
});

projektmanagement.get('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);
    const idee = await getIdeeDetails(id);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    console.error('Error getting Projektidee:', error);
    return c.json({ error: 'Failed to get Projektidee' }, 500);
  }
});

projektmanagement.put('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const { expected_version, force, ...updates } = body ?? {};
    // permissions duerfen NIE ueber den normalen Update-Pfad gesetzt werden.
    delete (updates as Record<string, unknown>).permissions;

    const idee = await updateIdee(id, updates, { expectedVersion: expected_version, force: !!force });
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error updating Projektidee:', error);
    return c.json({ error: 'Failed to update Projektidee' }, 500);
  }
});

projektmanagement.put('/projektideen/:id/step/:step', async (c) => {
  try {
    const id = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const { expected_version, force, ...partial } = body ?? {};
    const idee = await updateIdeeStep(id, step, partial, { expectedVersion: expected_version, force: !!force });
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error updating Projektidee step:', error);
    return c.json({ error: 'Failed to update Projektidee step' }, 500);
  }
});

projektmanagement.delete('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'owner');
    if (denied) return c.json({ error: denied.error }, denied.status);
    const ok = await removeIdee(id);
    if (!ok) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Projektidee:', error);
    return c.json({ error: 'Failed to delete Projektidee' }, 500);
  }
});

/**
 * POST /projektideen/:id/erstelle-auftrag
 * Erzeugt einen Projektauftrag aus der Idee mit Vor-Mapping. Idee bleibt erhalten,
 * Auftrag traegt einen Verweis auf die Idee (idee_id).
 */
/**
 * POST /api/apps/projektmanagement/projektideen/import
 * Multi-File-Import fuer Projektideen — gleiche Pipeline wie /projektauftraege/import,
 * aber mit Idee-Profil + idee-spezifischer Persistence.
 */
projektmanagement.post('/projektideen/import', async (c) => {
  try {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const formData = await c.req.formData();

    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
    ]);

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        if (files.length >= 10) {
          return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        }
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu gross (max. 50 MB)` }, 400);
        }
        if (!allowedMimeTypes.has(value.type)) {
          return c.json({ error: `Dateityp "${value.type}" nicht unterstuetzt fuer "${value.name}"` }, 400);
        }
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          buffer: Buffer.from(arrayBuffer),
          filename: value.name,
          mimeType: value.type,
        });
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
    }

    console.log(`[PM-Idee-Import] Received ${files.length} files for import`);

    return streamSSE(c, async (stream) => {
      try {
        await importProjektidee(files, userId, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        console.error('Error importing Projektidee:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error importing Projektidee:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Import fehlgeschlagen' },
      500
    );
  }
});

projektmanagement.post('/projektideen/:id/erstelle-auftrag', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    // Konvertieren erfordert Lesezugriff auf die Idee + Erstell-Recht in der App.
    const ideeDenied = await denyIfBelowIdeeRole(userId, id, 'viewer');
    if (ideeDenied) return c.json({ error: ideeDenied.error }, ideeDenied.status);
    const appDenied = denyIfNotAppEditor(c);
    if (appDenied) return c.json(appDenied, 403);
    // createAuftragFromIdee setzt `created_by = userId` — der Konvertierende
    // wird automatisch Auftrags-Owner via Default-Owner-Fallback. Permissions
    // bleiben null (= nur Konvertierer berechtigt).
    const auftrag = await createAuftragFromIdee(id, userId);
    if (!auftrag) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektauftrag: auftrag }, 201);
  } catch (error) {
    console.error('Error creating Auftrag from Idee:', error);
    return c.json({ error: 'Failed to create Auftrag from Idee' }, 500);
  }
});

/**
 * GET /projektideen/:id/export/:format
 * Export einer Projektidee in den Formaten md / pdf / docx / json.
 */
projektmanagement.get('/projektideen/:id/export/:format', async (c) => {
  try {
    const id = c.req.param('id');
    const format = c.req.param('format');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const idee = await getIdeeDetails(id);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);

    const filename = sanitizeFilename(`Projektidee_${idee.name || 'unbenannt'}`);

    if (format === 'json') {
      return c.json(idee, 200, {
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      });
    }

    if (!['md', 'pdf', 'docx'].includes(format)) {
      return c.json({ error: 'Unsupported format. Use md, pdf, docx, or json.' }, 400);
    }

    const documentData = mapProjektideeToDocument(idee);
    const buffer = await generateDocument(documentData, format as DocumentFormat);
    const mimeType = getMimeType(format as DocumentFormat);
    const extension = getFileExtension(format as DocumentFormat);

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting Projektidee:', error);
    return c.json({ error: 'Failed to export Projektidee' }, 500);
  }
});

// ============== Permissions Endpoints (Phase 2) ==============

/**
 * GET /projektideen/:id/permissions
 * Liefert die aktuellen Permissions einer Idee. Auftrags-Viewer+.
 */
projektmanagement.get('/projektideen/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowIdeeRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);
    const idee = await getIdeeDetails(id);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({
      permissions: idee.permissions ?? { users: [], groups: [] },
      ownerId: idee.created_by ?? null,
    });
  } catch (error) {
    console.error('Error getting idee permissions:', error);
    return c.json({ error: 'Failed to get permissions' }, 500);
  }
});

/**
 * PUT /projektideen/:id/permissions
 * Voller Overwrite — Body: { permissions: { users: [...], groups: [...] } }.
 * Auftrags-Owner-only.
 */
projektmanagement.put('/projektideen/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const body = await c.req.json();
    const incoming = body?.permissions ?? body;
    const saved = await replaceIdeePermissions(id, incoming, userId);
    return c.json({ permissions: saved });
  } catch (error) {
    if ((error as { code?: string })?.code === 'forbidden') {
      return c.json({ error: (error as Error).message }, 403);
    }
    if (error instanceof Error && /Nur Owner/i.test(error.message)) {
      return c.json({ error: error.message }, 403);
    }
    console.error('Error updating idee permissions:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update permissions' }, 500);
  }
});

/**
 * GET /projektauftraege/:id/permissions
 * Liefert die aktuellen Permissions eines Auftrags. Auftrags-Viewer+.
 */
projektmanagement.get('/projektauftraege/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);
    const auftrag = await getProjektauftragDetails(id);
    if (!auftrag) return c.json({ error: 'Projektauftrag nicht gefunden' }, 404);
    return c.json({
      permissions: auftrag.permissions ?? { users: [], groups: [] },
      ownerId: auftrag.created_by ?? null,
    });
  } catch (error) {
    console.error('Error getting auftrag permissions:', error);
    return c.json({ error: 'Failed to get permissions' }, 500);
  }
});

/**
 * PUT /projektauftraege/:id/permissions
 * Voller Overwrite. Auftrags-Owner-only.
 */
projektmanagement.put('/projektauftraege/:id/permissions', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const body = await c.req.json();
    const incoming = body?.permissions ?? body;
    const saved = await replaceAuftragPermissions(id, incoming, userId);
    return c.json({ permissions: saved });
  } catch (error) {
    if ((error as { code?: string })?.code === 'forbidden') {
      return c.json({ error: (error as Error).message }, 403);
    }
    if (error instanceof Error && /Nur Owner/i.test(error.message)) {
      return c.json({ error: error.message }, 403);
    }
    console.error('Error updating auftrag permissions:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update permissions' }, 500);
  }
});

/**
 * GET /my-permission/idee/:id und /my-permission/auftrag/:id
 * Liefert die effektive Rolle des eingeloggten Users — Frontend-UI nutzt das,
 * um Save/Delete/Permissions-Buttons zu gaten. Liefert immer 200, role kann
 * null sein (= kein Zugriff). Kein 403 hier, das Routing entscheidet die UI.
 */
projektmanagement.get('/my-permission/idee/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ role: null }, 401);
    const role = await getEffectiveIdeeRole(userId, id);
    return c.json({ role });
  } catch (error) {
    console.error('Error getting my idee role:', error);
    return c.json({ error: 'Failed' }, 500);
  }
});

projektmanagement.get('/my-permission/auftrag/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ role: null }, 401);
    const role = await getEffectiveAuftragRole(userId, id);
    return c.json({ role });
  } catch (error) {
    console.error('Error getting my auftrag role:', error);
    return c.json({ error: 'Failed' }, 500);
  }
});


export { projektmanagement as projektmanagementRoutes };
