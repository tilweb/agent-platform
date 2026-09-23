/**
 * Wohngeld — Persistente Posteingang-Warteschlange (S1–S4).
 *
 * Intake (`ingest`) ≠ Auswertung (`analysieren`) ≠ Zuordnung (`zuordnen`). Der
 * Intake speichert NUR (Dateien + Metadaten); die Auswertung (Klassifikation/
 * Extraktion/Match) startet die Sachbearbeitung manuell; die Zuordnung nutzt die
 * gemeinsame Kernlogik `verteileDokumente` (kein Re-Upload, Bytes per Ref).
 *
 * `ingest` ist zugleich die (später zu härtende) Naht für die Scan-Pipeline:
 * derselbe Weg für Browser (manuell) und headless (scan), Dedupe per Hash.
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  createPosteingang, getPosteingang, listPosteingang, updatePosteingang, deletePosteingang,
} from '../storage';
import { audit } from '../audit';
import { denyIfNotAppEditor } from './_shared';
import { storeUpload, resolveStorageRef, loadDokumentDatei, removeStoredFile } from '../filestore';
import { klassifiziereUndExtrahiere } from '../extraction';
import {
  verteileDokumente, ermittleMatchKandidaten, buildIdent, extractTextFromBytes,
  MAX_TOTAL_BYTES, type Preview,
} from './posteingang';
import {
  sha256Hex, sha256HexString, envelopeHash, leiteBetreffAb,
  darfAuswerten, darfZuordnen, istTerminal,
} from '../posteingang-helpers';
import type { Posteingang, PosteingangDatei, PosteingangQuelle, DokumentTyp } from '../types';

export const posteingangQueueRoutes = new Hono();

const QUELLEN: readonly PosteingangQuelle[] = ['manuell', 'scan', 'email', 'import'];

/** Sanitisierter Dateiname für Content-Disposition. */
function safeDispositionName(name: string): string {
  return (name || 'datei').replace(/[^a-zA-Z0-9_.\- ]/g, '_').slice(0, 200) || 'datei';
}

/** Rekonstruiert ein Preview-Objekt aus einer gespeicherten Datei (Zuordnung ohne Re-Upload). */
function dateiZuPreview(d: PosteingangDatei): Preview {
  return {
    typ: d.typ ?? 'sonstiges',
    titel: d.titel,
    analyse: d.analyse ?? {},
    stammdaten: d.stammdaten,
    identitaet: d.identitaet,
    confidenceByPfad: d.fieldConfidences,
    extraktion: d.extraktion,
    dateiname: d.dateiname,
    extrahierterTextGekuerzt: d.extrahierterTextGekuerzt ?? '',
    storageRef: d.s3Key ? `s3:${d.s3Key}` : d.pfad ? `local:${d.pfad}` : '',
  };
}

// ── S1/S4: Intake (nur speichern) ───────────────────────────────────────────

/**
 * POST /posteingang/ingest — Dieselbe Naht für Browser (manuell) und Scan-Pipeline.
 * Speichert 1..n Dateien (multipart) + optional quelle/eingegangenAm/betreff/
 * idempotencyKey. KEINE Analyse. Dedupe per Umschlag-Hash.
 */
posteingangQueueRoutes.post('/posteingang/ingest', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  // TODO(S4/Service-Auth): Für die headless Scan-Pipeline Token-/mTLS-basierter
  // Zugang statt Session/Editor. Offener Punkt (Spec §10/§13).

  const form = await c.req.formData();
  const files = form.getAll('files').filter((e): e is File => e instanceof File);
  const single = form.get('file');
  if (single instanceof File) files.push(single);
  if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

  const quelleRaw = String(form.get('quelle') ?? 'manuell');
  const quelle: PosteingangQuelle = QUELLEN.includes(quelleRaw as PosteingangQuelle) ? (quelleRaw as PosteingangQuelle) : 'manuell';
  const eingegangenAmRaw = form.get('eingegangenAm');
  const eingegangenAm = typeof eingegangenAmRaw === 'string' && eingegangenAmRaw.trim() ? eingegangenAmRaw.trim() : new Date().toISOString();
  const betreff = typeof form.get('betreff') === 'string' && String(form.get('betreff')).trim() ? String(form.get('betreff')).trim() : undefined;
  const idempotencyKey = typeof form.get('idempotencyKey') === 'string' ? String(form.get('idempotencyKey')).trim() : '';

  const userId = getCurrentUserId(c);
  const dateien: PosteingangDatei[] = [];
  let total = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);
    const contentType = file.type || 'application/octet-stream';
    const stored = await storeUpload(bytes, file.name, contentType);
    const ref = resolveStorageRef(stored.storageRef);
    dateien.push({
      dateiname: stored.filename,
      s3Key: ref.s3Key,
      pfad: ref.pfad,
      contentType,
      groesse: bytes.length,
      hash: sha256Hex(bytes),
    });
  }

  // Umschlag-Hash: bevorzugt idempotencyKey (Scan-Kanal), sonst über die Datei-Hashes.
  const hash = idempotencyKey ? sha256HexString(idempotencyKey) : envelopeHash(dateien.map((d) => d.hash));

  // Dedupe: existiert bereits ein nicht-verworfener Eingang mit gleichem Hash?
  const alle = await listPosteingang();
  const dup = alle.find((p) => p.hash === hash && p.status !== 'verworfen');
  if (dup) {
    await audit(c, {
      aktion: 'posteingang.dublette_ignoriert', objektTyp: 'posteingang', objektId: dup.id,
      detail: `Doppel-Einlieferung über ${quelle} anhand Umschlag-Hash erkannt`,
    });
    return c.json({ duplicate: true, id: dup.id, posteingang: dup });
  }

  const eingang = await createPosteingang({
    quelle, eingegangenAm, betreff, hash, dateien,
    bearbeiterId: userId ?? undefined, status: 'eingegangen',
  });
  await audit(c, {
    aktion: 'posteingang.eingegangen', objektTyp: 'posteingang', objektId: eingang.id,
    detail: `${dateien.length} Datei(en) über „${quelle}" eingeliefert`,
  });
  return c.json({ id: eingang.id, posteingang: eingang }, 201);
});

// ── S1: Liste / Detail / Datei ──────────────────────────────────────────────

/** GET /posteingang — Queue (Filter status/quelle; Sortierung Eingangsdatum desc). */
posteingangQueueRoutes.get('/posteingang', async (c) => {
  const status = c.req.query('status') || undefined;
  const quelle = c.req.query('quelle') || undefined;
  const posteingang = await listPosteingang({ status, quelle });
  return c.json({ posteingang });
});

/** GET /posteingang/:id — Detail inkl. Dateien + Analyse + Match-Vorschlag. */
posteingangQueueRoutes.get('/posteingang/:id', async (c) => {
  const eingang = await getPosteingang(c.req.param('id'));
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  return c.json({ posteingang: eingang });
});

/** GET /posteingang/:id/datei/:idx — Bytes einer Umschlag-Datei (inline). */
posteingangQueueRoutes.get('/posteingang/:id/datei/:idx', async (c) => {
  const eingang = await getPosteingang(c.req.param('id'));
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  const idx = Number(c.req.param('idx'));
  const datei = Number.isInteger(idx) ? eingang.dateien[idx] : undefined;
  if (!datei) return c.json({ error: 'Datei nicht gefunden' }, 404);

  let bytes: Uint8Array | null;
  try {
    bytes = await loadDokumentDatei({ s3Key: datei.s3Key, pfad: datei.pfad });
  } catch {
    return c.json({ error: 'Datei konnte nicht geladen werden' }, 404);
  }
  if (!bytes) return c.json({ error: 'Keine Datei hinterlegt' }, 404);

  // Lesezugriff protokollieren (non-fatal — audit() schluckt Fehler selbst).
  await audit(c, { aktion: 'posteingang.datei_gelesen', objektTyp: 'posteingang', objektId: eingang.id, detail: datei.dateiname });

  const body = new Uint8Array(bytes);
  return new Response(body, {
    headers: {
      'Content-Type': datei.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safeDispositionName(datei.dateiname)}"`,
      'Content-Length': String(body.byteLength),
    },
  });
});

// ── S2: Auswertung (manuell, einzeln + Sammel) ──────────────────────────────

/**
 * POST /posteingang/analysieren — { ids: [...] }. Sequenziell je Eingang: je Datei
 * klassifizieren/extrahieren, dann Umschlag-Match, Betreff ableiten, Status setzen.
 * Teilfehler pro Eingang isoliert (Rest läuft weiter).
 */
posteingangQueueRoutes.post('/posteingang/analysieren', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const body = await c.req.json<{ ids?: string[] }>().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length) return c.json({ error: 'Keine ids übergeben' }, 400);

  const userId = getCurrentUserId(c);
  const ergebnisse: Array<{ id: string; ok: boolean; error?: string; posteingang?: Posteingang | null }> = [];

  for (const id of ids) {
    const eingang = await getPosteingang(id);
    if (!eingang) { ergebnisse.push({ id, ok: false, error: 'Eingang nicht gefunden' }); continue; }
    if (!darfAuswerten(eingang.status)) { ergebnisse.push({ id, ok: false, error: `Status „${eingang.status}" ist nicht auswertbar`, posteingang: eingang }); continue; }

    await updatePosteingang(id, { status: 'in_analyse', bearbeiterId: userId ?? undefined });
    try {
      const dateien: PosteingangDatei[] = eingang.dateien.map((d) => ({ ...d }));
      for (const d of dateien) {
        try {
          const bytes = await loadDokumentDatei({ s3Key: d.s3Key, pfad: d.pfad });
          if (!bytes) { d.analyseFehler = 'Datei nicht auffindbar (kein hinterlegter Inhalt)'; continue; }
          const text = await extractTextFromBytes(bytes, d.contentType, d.dateiname);
          const erg = await klassifiziereUndExtrahiere(bytes, d.contentType || 'application/octet-stream', { userId, filename: d.dateiname });
          d.typ = erg.typ;
          d.titel = erg.titel;
          d.analyse = erg.analyse;
          d.stammdaten = erg.stammdaten;
          d.identitaet = erg.identitaet;
          d.extraktion = erg.extraktion;
          d.fieldConfidences = erg.confidenceByPfad;
          d.extrahierterTextGekuerzt = text.slice(0, 4000);
          d.analyseFehler = undefined;
        } catch (err) {
          d.analyseFehler = err instanceof Error ? err.message : String(err);
        }
      }

      // Umschlag-Match: Antrag-Stammdaten + erste Nachweis-Identität über alle Dateien.
      const antrag = dateien.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
      const identitaet = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname || i.geburtsdatum));
      const kandidaten = await ermittleMatchKandidaten(buildIdent(antrag?.stammdaten, identitaet));

      const betreff = leiteBetreffAb(dateien) ?? eingang.betreff;
      const alleFehler = dateien.length > 0 && dateien.every((d) => d.analyseFehler);
      const status = alleFehler ? 'fehler' : 'analysiert';
      const updated = await updatePosteingang(id, { dateien, matchVorschlag: kandidaten, betreff, status });

      await audit(c, {
        aktion: alleFehler ? 'posteingang.analyse_fehler' : 'posteingang.analysiert',
        objektTyp: 'posteingang', objektId: id, ergebnis: alleFehler ? 'fehler' : 'ok',
        detail: `${dateien.length} Datei(en) ausgewertet${kandidaten.length ? `, ${kandidaten.length} Vorschlag/Vorschläge` : ''}`,
      });
      ergebnisse.push({ id, ok: !alleFehler, posteingang: updated });
    } catch (err) {
      const updated = await updatePosteingang(id, { status: 'fehler' });
      await audit(c, {
        aktion: 'posteingang.analyse_fehler', objektTyp: 'posteingang', objektId: id, ergebnis: 'fehler',
        detail: err instanceof Error ? err.message : String(err),
      });
      ergebnisse.push({ id, ok: false, error: 'Auswertung fehlgeschlagen', posteingang: updated });
    }
  }

  return c.json({ ergebnisse });
});

// ── S3: Zuordnung / Verwerfen / Patch / Löschen ─────────────────────────────

/**
 * POST /posteingang/:id/zuordnen — { akteId?|neueAkte?, vorgangId?, pruefen?,
 * viaVorschlag?, matchLevel?, stammdaten? }. Rekonstruiert die Previews aus den Refs
 * und ruft die gemeinsame Kernlogik. vorgangId ⇒ Nachreichung an bestehenden Vorgang.
 */
posteingangQueueRoutes.post('/posteingang/:id/zuordnen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const id = c.req.param('id');
  const eingang = await getPosteingang(id);
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);
  if (!darfZuordnen(eingang.status)) return c.json({ error: 'Eingang muss zuerst ausgewertet werden' }, 409);

  const body = await c.req.json<{
    akteId?: string; neueAkte?: Record<string, unknown>; vorgangId?: string;
    pruefen?: boolean; viaVorschlag?: boolean; matchLevel?: string;
    stammdaten?: Preview['stammdaten'];
  }>().catch(() => ({} as Record<string, never>));

  const dokumente = eingang.dateien.map(dateiZuPreview);
  // Optionale Stammdaten-Korrektur aus dem Detail-Formular auf den Antrag anwenden
  // (Erweiterung ggü. Spec-Body — verhindert verlorene manuelle Korrekturen).
  if (body.stammdaten) {
    const antrag = dokumente.find((d) => d.typ === 'wohngeldantrag') ?? dokumente[0];
    if (antrag) antrag.stammdaten = body.stammdaten;
  }

  const result = await verteileDokumente(c, {
    akteId: body.akteId, neueAkte: body.neueAkte, vorgangId: body.vorgangId,
    dokumente, pruefen: body.pruefen, viaVorschlag: body.viaVorschlag, matchLevel: body.matchLevel,
    eingegangenAm: eingang.eingegangenAm,
  });
  if (!result.ok) return c.json({ error: result.error }, result.status);

  const updated = await updatePosteingang(id, {
    status: 'zugeordnet',
    zugeordneterVorgangId: result.vorgang.id,
    zugeordneteAkteId: result.akte.id,
    bearbeiterId: getCurrentUserId(c) ?? undefined,
  });
  await audit(c, {
    aktion: 'posteingang.zugeordnet', objektTyp: 'posteingang', objektId: id, vorgangId: result.vorgang.id,
    detail: `Eingang dem Vorgang ${result.vorgang.antragsId} zugeordnet${body.vorgangId && !result.istNeuerVorgang ? ' (Nachreichung)' : ' (neuer Vorgang)'}`,
  });

  return c.json({ posteingang: updated, vorgang: result.vorgang, akte: result.akte, befundeCount: result.befundeCount });
});

/** POST /posteingang/:id/verwerfen — { grund }. Setzt verworfen. */
posteingangQueueRoutes.post('/posteingang/:id/verwerfen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const id = c.req.param('id');
  const eingang = await getPosteingang(id);
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);

  const body = await c.req.json<{ grund?: string }>().catch(() => null);
  const grund = typeof body?.grund === 'string' && body.grund.trim() ? body.grund.trim() : undefined;

  const updated = await updatePosteingang(id, { status: 'verworfen', verworfenGrund: grund, bearbeiterId: getCurrentUserId(c) ?? undefined });
  await audit(c, { aktion: 'posteingang.verworfen', objektTyp: 'posteingang', objektId: id, detail: grund ?? 'ohne Grund' });
  return c.json({ posteingang: updated });
});

/** PATCH /posteingang/:id — Kleinkorrekturen: betreff, eingegangenAm, dateien[i].typ. */
posteingangQueueRoutes.patch('/posteingang/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const id = c.req.param('id');
  const eingang = await getPosteingang(id);
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist ${eingang.status} — keine Korrektur möglich` }, 409);

  const body = await c.req.json<{
    betreff?: string; eingegangenAm?: string;
    dateiTypen?: Array<{ index: number; typ: DokumentTyp }>;
  }>().catch(() => null);

  const updates: Partial<Posteingang> = {};
  if (typeof body?.betreff === 'string') updates.betreff = body.betreff.trim() || undefined;
  if (typeof body?.eingegangenAm === 'string' && body.eingegangenAm.trim()) updates.eingegangenAm = body.eingegangenAm.trim();
  if (Array.isArray(body?.dateiTypen) && body.dateiTypen.length) {
    const dateien = eingang.dateien.map((d) => ({ ...d }));
    for (const u of body.dateiTypen) {
      if (Number.isInteger(u.index) && dateien[u.index]) dateien[u.index]!.typ = u.typ;
    }
    updates.dateien = dateien;
  }
  if (!Object.keys(updates).length) return c.json({ posteingang: eingang });

  const updated = await updatePosteingang(id, updates);
  await audit(c, { aktion: 'posteingang.geaendert', objektTyp: 'posteingang', objektId: id, detail: Object.keys(updates).join(', ') });
  return c.json({ posteingang: updated });
});

/** DELETE /posteingang/:id — Row löschen + lokale Bytes best-effort entfernen (DSGVO/Retention). */
posteingangQueueRoutes.delete('/posteingang/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const id = c.req.param('id');
  const eingang = await getPosteingang(id);
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);

  for (const d of eingang.dateien) {
    await removeStoredFile({ s3Key: d.s3Key, pfad: d.pfad });
  }
  const geloescht = await deletePosteingang(id);
  await audit(c, { aktion: 'posteingang.geloescht', objektTyp: 'posteingang', objektId: id, detail: `${eingang.dateien.length} Datei(en) entfernt` });
  return c.json({ ok: geloescht });
});
