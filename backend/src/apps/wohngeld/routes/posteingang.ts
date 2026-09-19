/**
 * Wohngeld — Posteingang (Phase 4): Upload → pdftotext → Klassifikation/Extraktion.
 *
 *  - POST /posteingang/upload      : Datei(en) hochladen, extrahieren, Preview
 *                                    zurückgeben (noch KEINE Bindung an Vorgang).
 *  - POST /posteingang/verteilen   : Previews einer Akte/einem Vorgang zuordnen,
 *                                    Dokumente anlegen, Stammdaten übernehmen.
 *  - POST /vorgaenge/:id/dokumente/upload : Direkt-Upload am Vorgang (Detailseite).
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  getAkte, createAkte, getVorgang, createVorgang, updateVorgang,
  listPersonen, createPerson, createDokument, addAktivitaet,
  getVorgangSnapshot, syncPruefschritte,
} from '../storage';
import { pruefeVorgang } from '../checker';
import { pdfToText } from '../extract';
import { klassifiziereUndExtrahiere, type ExtraktionErgebnis, type ExtrahierteStammdaten } from '../extraction';
import { storeUpload, resolveStorageRef } from '../filestore';
import { denyIfNotAppEditor } from './_shared';
import type { WohnungMiete } from '../types';

export const posteingangRoutes = new Hono();

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/** Ein einzelnes Preview-Objekt (Client zeigt es an, sendet es unverändert an /verteilen zurück). */
interface Preview extends ExtraktionErgebnis {
  dateiname: string;
  extrahierterTextGekuerzt: string;
  storageRef: string;
}

/** Text aus einer hochgeladenen Datei ziehen (nur PDF; andere Formate → leer, beobachtend). */
async function extractText(file: File, bytes: Uint8Array): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return '';
  try {
    return await pdfToText(bytes);
  } catch (err) {
    console.warn('[wohngeld] pdftotext fehlgeschlagen für', file.name, err instanceof Error ? err.message : err);
    return '';
  }
}

/** Upload + Extraktion → Preview (ohne Persistenz eines Dokuments). */
posteingangRoutes.post('/posteingang/upload', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const form = await c.req.formData();
  const files = form.getAll('files').filter((e): e is File => e instanceof File);
  // Fallback: Einzelfeld "file"
  const single = form.get('file');
  if (single instanceof File) files.push(single);
  if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

  const userId = getCurrentUserId(c);
  const previews: Preview[] = [];
  let total = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);

    const stored = await storeUpload(bytes, file.name, file.type || 'application/octet-stream');
    const text = await extractText(file, bytes);
    const ergebnis = await klassifiziereUndExtrahiere(text, { userId, filename: stored.filename });

    previews.push({
      ...ergebnis,
      dateiname: stored.filename,
      extrahierterTextGekuerzt: text.slice(0, 4000),
      storageRef: stored.storageRef,
    });
  }

  return c.json({ previews, preview: previews[0] });
});

/** Stammdaten aus dem Wohngeldantrag in Vorgang (Wohnung) mergen. */
function mergeWohnung(base: WohnungMiete | undefined, s: ExtrahierteStammdaten): WohnungMiete {
  const w: WohnungMiete = { ...(base ?? {}) };
  if (s.adresse?.strasse) w.strasse = s.adresse.strasse;
  if (s.adresse?.hausnummer) w.hausnummer = s.adresse.hausnummer;
  if (s.adresse?.plz) w.plz = s.adresse.plz;
  if (s.adresse?.ort) w.ort = s.adresse.ort;
  if (s.wohnung?.miete !== undefined) w.miete = s.wohnung.miete;
  if (s.wohnung?.wohnflaeche_qm !== undefined) w.wohnflaeche_qm = s.wohnung.wohnflaeche_qm;
  return w;
}

/**
 * Verteilung: Previews einer (ggf. neuen) Akte/einem (ggf. neuen) Vorgang zuordnen.
 * Body: { akteId?, neueAkte?, vorgangId?, neuerVorgang?, dokumente:[preview...], pruefen? }
 */
posteingangRoutes.post('/posteingang/verteilen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const body = await c.req.json<{
    akteId?: string;
    neueAkte?: Record<string, unknown>;
    vorgangId?: string;
    neuerVorgang?: Record<string, unknown>;
    dokumente?: Preview[];
    pruefen?: boolean;
  }>().catch(() => null);

  if (!body) return c.json({ error: 'Ungültiger Request-Body' }, 400);
  const dokumente = Array.isArray(body.dokumente) ? body.dokumente : [];
  if (!dokumente.length) return c.json({ error: 'Keine Dokumente zum Zuordnen übergeben' }, 400);

  const userId = getCurrentUserId(c);

  // Antrags-Preview (steuert Stammdaten-Übernahme) suchen.
  const antragPreview = dokumente.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const stammdaten = antragPreview?.stammdaten;

  // 1. Akte auflösen/anlegen (aus vorhandenem Vorgang ableiten, sonst akteId, sonst neueAkte).
  let akte = null as Awaited<ReturnType<typeof getAkte>>;
  let vorgang = null as Awaited<ReturnType<typeof getVorgang>>;

  if (body.vorgangId) {
    vorgang = await getVorgang(body.vorgangId);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    akte = await getAkte(vorgang.akteId);
  } else if (body.akteId) {
    akte = await getAkte(body.akteId);
    if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
  } else if (body.neueAkte || stammdaten) {
    const src = (body.neueAkte ?? {}) as Record<string, unknown>;
    const nameFromStamm = stammdaten?.antragsteller
      ? [stammdaten.antragsteller.nachname, stammdaten.antragsteller.vorname].filter(Boolean).join(', ')
      : undefined;
    const name = (typeof src.name === 'string' && src.name.trim()) || nameFromStamm || 'Neue Akte';
    akte = await createAkte({
      name,
      antragstellerName: nameFromStamm,
      strasse: stammdaten?.adresse?.strasse,
      hausnummer: stammdaten?.adresse?.hausnummer,
      plz: stammdaten?.adresse?.plz,
      ort: stammdaten?.adresse?.ort,
      ...src,
      ownerId: userId,
    });
  } else {
    return c.json({ error: 'akteId, neueAkte oder vorgangId ist erforderlich' }, 400);
  }
  if (!akte) return c.json({ error: 'Akte konnte nicht ermittelt werden' }, 500);

  // 2. Vorgang auflösen/anlegen.
  const istNeuerVorgang = !vorgang;
  if (!vorgang) {
    const src = (body.neuerVorgang ?? {}) as Record<string, unknown>;
    vorgang = await createVorgang({
      akteId: akte.id,
      wohngeldart: stammdaten?.wohngeldart,
      antragsart: stammdaten?.antragsart,
      antragsdatum: stammdaten?.antragsdatum,
      ...src,
      ownerId: userId,
    });
  }

  // 3. Stammdaten übernehmen (Wohnung + Antragsteller-Person) — bei Antrag vorhanden.
  if (stammdaten) {
    const updates: Record<string, unknown> = {};
    if (stammdaten.antragsdatum && !vorgang.antragsdatum) updates.antragsdatum = stammdaten.antragsdatum;
    if (stammdaten.wohngeldart) updates.wohngeldart = stammdaten.wohngeldart;
    if (stammdaten.antragsart) updates.antragsart = stammdaten.antragsart;
    if (stammdaten.adresse || stammdaten.wohnung) updates.wohnung = mergeWohnung(vorgang.wohnung, stammdaten);
    if (Object.keys(updates).length) {
      vorgang = await updateVorgang(vorgang.id, updates) ?? vorgang;
    }

    // Antragsteller-Person anlegen, falls noch keine existiert und ein Name vorliegt.
    const at = stammdaten.antragsteller;
    if (at && (at.vorname || at.nachname)) {
      const personen = await listPersonen(vorgang.id);
      if (!personen.some((p) => p.rolle === 'antragsteller')) {
        await createPerson({
          vorgangId: vorgang.id,
          rolle: 'antragsteller',
          vorname: at.vorname ?? '',
          nachname: at.nachname ?? '',
          geburtsdatum: at.geburtsdatum,
        });
      }
    }
  }

  // 4. Dokumente anlegen.
  const angelegt = [];
  for (const d of dokumente) {
    const ref = resolveStorageRef(d.storageRef);
    const dok = await createDokument({
      vorgangId: vorgang.id,
      typ: d.typ,
      titel: d.titel,
      quelle: d.dateiname,
      istOriginal: false,
      s3Key: ref.s3Key,
      pfad: ref.pfad,
      eingegangenAm: new Date().toISOString(),
      extrahierterText: (d.extrahierterTextGekuerzt || '').slice(0, 20000),
      analyse: d.analyse,
    });
    angelegt.push(dok);
  }

  await addAktivitaet({
    vorgangId: vorgang.id, typ: 'posteingang', akteur: userId,
    beschreibung: `${angelegt.length} Dokument(e) aus dem Posteingang zugeordnet${istNeuerVorgang ? ' (neuer Vorgang)' : ''}`,
  });

  // 5. Optional direkt prüfen.
  let befundeCount: number | undefined;
  if (body.pruefen !== false) {
    const snapshot = await getVorgangSnapshot(vorgang.id);
    if (snapshot) {
      const befunde = pruefeVorgang(snapshot);
      await syncPruefschritte(vorgang.id, befunde);
      befundeCount = befunde.length;
    }
  }

  return c.json({ vorgang, akte, dokumente: angelegt, befundeCount }, 201);
});

/** Direkt-Upload am Vorgang (Dokumente-Tab der Detailseite). */
posteingangRoutes.post('/vorgaenge/:vorgangId/dokumente/upload', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);

  const form = await c.req.formData();
  const files = form.getAll('files').filter((e): e is File => e instanceof File);
  const single = form.get('file');
  if (single instanceof File) files.push(single);
  if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

  const userId = getCurrentUserId(c);
  const angelegt = [];
  let total = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);

    const stored = await storeUpload(bytes, file.name, file.type || 'application/octet-stream');
    const text = await extractText(file, bytes);
    const ergebnis = await klassifiziereUndExtrahiere(text, { userId, filename: stored.filename });
    const ref = resolveStorageRef(stored.storageRef);

    const dok = await createDokument({
      vorgangId,
      typ: ergebnis.typ,
      titel: ergebnis.titel,
      quelle: stored.filename,
      istOriginal: false,
      s3Key: ref.s3Key,
      pfad: ref.pfad,
      eingegangenAm: new Date().toISOString(),
      extrahierterText: text.slice(0, 20000),
      analyse: ergebnis.analyse,
    });
    angelegt.push(dok);
  }

  await addAktivitaet({
    vorgangId, typ: 'dokument', akteur: userId,
    beschreibung: `${angelegt.length} Dokument(e) hochgeladen und klassifiziert`,
  });

  return c.json({ dokumente: angelegt, dokument: angelegt[0] }, 201);
});
