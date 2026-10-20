/**
 * Posteingang / Eingangsstrecke (Welle 4) — REST-API.
 *
 * Upload → fire-and-forget-Pipeline (Split → Klassifikation → Auto-Routing);
 * das Frontend pollt GET /inbox. Unsichere Teile werden manuell zugeordnet.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { verarbeitungsStatus } from '../extraction/queue/hintergrund';
import {
  createUpload,
  listUploads,
  getUpload,
  deleteUpload,
  nehmeInboxUploadAn,
  routePart,
  sweepStaleUploads,
  eingangsModus,
  ladeUmschlag,
} from '../extraction/inbox';
import { getProject } from '../extraction/learning';

export const extractionInboxRoutes = new Hono();

// Posteingang erfordert eine gueltige Session (siehe extraction-projects.ts).
extractionInboxRoutes.use('/*', authMiddleware);

/** Pro-Datei-Limit (multipart wird im RAM gepuffert). */
const MAX_INBOX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * POST /inbox — Multi-Upload; je Datei ein Posteingang-Eintrag.
 * Antwortet sofort (fire-and-forget); Verarbeitung läuft im Hintergrund.
 */
extractionInboxRoutes.post('/inbox', async (c) => {
  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'multipart/form-data mit Dateien erforderlich' }, 400);
  }
  const formData = await c.req.formData();
  // Eingangsmodus (Konzept DP-Produktmodell §3): `vorgang` (Standard) = eine Datei ist EIN Geschaeftsvorfall,
  // keine Trennung; `stapel` = Trennen + Zuordnen je Teil. `split` bleibt rueckwaertskompatibel.
  const modus = eingangsModus(formData.get('modus'), formData.get('split'));
  const profilRaw = formData.get('profil_id');
  const profilId = typeof profilRaw === 'string' && profilRaw.trim() ? profilRaw.trim() : null;
  if (profilId && !(await getProject(profilId))) {
    return c.json({ error: `Profil „${profilId}" nicht gefunden` }, 400);
  }
  const uploads = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (uploads.length === 0) {
    return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
  }
  const tooBig = uploads.find((f) => f.size > MAX_INBOX_FILE_BYTES);
  if (tooBig) {
    return c.json({ error: `Datei "${tooBig.name}" ist zu groß (max. 50 MB)` }, 413);
  }

  const created: { id: string; filename: string }[] = [];
  for (const file of uploads) {
    const upload = await createUpload({ filename: file.name, mimeType: file.type || undefined, modus, profilId, quelle: 'oberflaeche' });
    created.push({ id: upload.id, filename: upload.filename });
    // Original dauerhaft speichern + Job einstellen; verarbeitet wird in der Warteschlange (Worker oder Web).
    await nehmeInboxUploadAn(upload.id, Buffer.from(await file.arrayBuffer()), { filename: file.name }, undefined, { modus, profilId });
  }

  return c.json({ uploads: created }, 201);
});

/** GET /inbox/:id/umschlag — Ergebnis-Umschlag des Uploads (wie `inbox.get` der öffentlichen API). */
extractionInboxRoutes.get('/inbox/:id/umschlag', async (c) => {
  const umschlag = await ladeUmschlag(c.req.param('id'));
  if (!umschlag) return c.json({ error: 'Upload nicht gefunden' }, 404);
  return c.json(umschlag);
});

/**
 * GET /verarbeitung — Stand der Verarbeitung (Modus, offene Jobs, im Modus „extern": lebt ein Worker?).
 * Für den Hinweis in Posteingang-Ansichten, wenn Aufträge auf einen fehlenden Worker warten.
 */
extractionInboxRoutes.get('/verarbeitung', async (c) => {
  try {
    return c.json(await verarbeitungsStatus());
  } catch {
    return c.json({ modus: 'intern', workerAktiv: null, offeneJobs: 0 });
  }
});

/** GET /inbox — Liste aller Uploads inkl. Teilen (Polling-fähig). */
extractionInboxRoutes.get('/inbox', async (c) => {
  await sweepStaleUploads().catch(() => {});
  const uploads = await listUploads();
  return c.json(uploads);
});

/** GET /inbox/:id — Einzelner Upload. */
extractionInboxRoutes.get('/inbox/:id', async (c) => {
  const upload = await getUpload(c.req.param('id'));
  if (!upload) return c.json({ error: 'Upload nicht gefunden' }, 404);
  return c.json(upload);
});

/**
 * POST /inbox/:id/parts/:partId/route — Teil manuell einem Projekt zuordnen.
 * Body: { project_id }
 */
extractionInboxRoutes.post('/inbox/:id/parts/:partId/route', async (c) => {
  const uploadId = c.req.param('id');
  const partId = c.req.param('partId');
  const body = await c.req.json().catch(() => null);
  const projectId = body?.project_id;
  if (!projectId || typeof projectId !== 'string') {
    return c.json({ error: 'project_id erforderlich' }, 400);
  }
  const project = await getProject(projectId);
  if (!project) return c.json({ error: 'Profil nicht gefunden' }, 404);

  try {
    const result = await routePart(uploadId, partId, projectId);
    return c.json({ runId: result.runId, project_id: projectId });
  } catch (error: any) {
    const msg = error?.message || 'Zuordnung fehlgeschlagen';
    const status = msg.includes('nicht gefunden') ? 404 : msg.includes('bereits zugeordnet') ? 409 : 400;
    return c.json({ error: msg }, status);
  }
});

/** DELETE /inbox/:id — Upload inkl. gespeicherter Dateien löschen. */
extractionInboxRoutes.delete('/inbox/:id', async (c) => {
  const deleted = await deleteUpload(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Upload nicht gefunden' }, 404);
  return c.json({ success: true });
});
