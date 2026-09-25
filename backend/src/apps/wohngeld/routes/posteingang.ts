/**
 * Wohngeld — Posteingang (Phase 4): Upload → pdftotext → Klassifikation/Extraktion.
 *
 *  - POST /posteingang/upload      : Datei(en) hochladen, extrahieren, Preview
 *                                    zurückgeben (noch KEINE Bindung an Vorgang).
 *  - POST /posteingang/match       : Zuordnungs-Vorschlag ermitteln.
 *  - POST /posteingang/verteilen   : Previews einer Akte/einem Vorgang zuordnen.
 *  - POST /vorgaenge/:id/dokumente/upload : Direkt-Upload am Vorgang (Detailseite).
 *
 * Die Kernlogik von `verteilen` ist als aufrufbare Funktion `verteileDokumente`
 * extrahiert; sowohl der alte Endpoint als auch die persistente Warteschlange
 * (`posteingang-queue.ts`, `zuordnen`) nutzen sie — kein Copy-Paste.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  getAkte, createAkte, getVorgang, createVorgang, updateVorgang,
  listPersonen, createPerson, updatePerson, createDokument, listVorgaenge,
  getVorgangSnapshot, syncPruefschritte, setFeldStatus,
} from '../storage';
import { audit } from '../audit';
import { pruefeVorgang } from '../checker';
import { pdfToText } from '../extract';
import { klassifiziereUndExtrahiere, type ExtraktionErgebnis, type ExtrahierteStammdaten, type Identitaet } from '../extraction';
import { matchVorgaenge, type MatchIdent, type MatchKandidat, type ScoredKandidat } from '../matching';
import { feldStatusHaushaltPfade } from '../feldstatus-mapping';
import { storeUpload, resolveStorageRef } from '../filestore';
import { stammdatenUebernahme } from '../stammdaten-uebernahme';
import { pruefeUndSynchronisiere } from '../pruefung';
import { flagPersonUnklar, kindergeldEmpfaenger, ordneNachweisZu, personenAusAntrag } from '../haushalt';
import { denyIfNotAppEditor } from './_shared';
import type { WohnungMiete, Akte, Vorgang, Dokument, Person } from '../types';

export const posteingangRoutes = new Hono();

export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/** Ein einzelnes Preview-Objekt (Client zeigt es an, sendet es unverändert an /verteilen zurück). */
export interface Preview extends ExtraktionErgebnis {
  dateiname: string;
  /** Erkennung über das DP-Segmentprofil (wird am Dokument gespeichert). */
  profil?: import('../types').ProfilErkennung;
  extrahierterTextGekuerzt: string;
  storageRef: string;
}

/**
 * Text aus rohen Bytes ziehen (nur PDF; andere Formate → leer, beobachtend).
 * Wird sowohl beim Browser-Upload (File) als auch bei der späteren Auswertung aus
 * bereits gespeicherten Refs (Warteschlange) genutzt.
 */
export async function extractTextFromBytes(bytes: Uint8Array, contentType: string, filename: string): Promise<string> {
  const isPdf = contentType === 'application/pdf' || /\.pdf$/i.test(filename);
  if (!isPdf) return '';
  try {
    return await pdfToText(bytes);
  } catch (err) {
    console.warn('[wohngeld] pdftotext fehlgeschlagen für', filename, err instanceof Error ? err.message : err);
    return '';
  }
}

/** Text aus einer hochgeladenen Datei ziehen (Wrapper über extractTextFromBytes). */
async function extractText(file: File, bytes: Uint8Array): Promise<string> {
  return extractTextFromBytes(bytes, file.type, file.name);
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
    const ergebnis = await klassifiziereUndExtrahiere(bytes, file.type || 'application/octet-stream', { userId, filename: stored.filename });

    previews.push({
      ...ergebnis,
      dateiname: stored.filename,
      extrahierterTextGekuerzt: text.slice(0, 4000),
      storageRef: stored.storageRef,
    });
  }

  return c.json({ previews, preview: previews[0] });
});

/**
 * Baut das Identitäts-Signal (`MatchIdent`) aus den identifizierenden Daten eines
 * Eingangs: Antrag-Stammdaten (Name + Adresse) und/oder Nachweis-Identität
 * (nachname/vorname/geburtsdatum). Name-Felder aus `identitaet` haben Vorrang.
 */
export function buildIdent(stammdaten?: ExtrahierteStammdaten, identitaet?: Identitaet): MatchIdent {
  const at = stammdaten?.antragsteller;
  const ad = stammdaten?.adresse;
  return {
    nachname: identitaet?.nachname ?? at?.nachname,
    vorname: identitaet?.vorname ?? at?.vorname,
    geburtsdatum: identitaet?.geburtsdatum ?? at?.geburtsdatum,
    plz: ad?.plz,
    ort: ad?.ort,
    strasse: ad?.strasse,
    hausnummer: ad?.hausnummer,
    ...(stammdaten?.wohngeldnummer ? { aktenzeichen: stammdaten.wohngeldnummer } : {}),
  };
}

/**
 * Ermittelt den Zuordnungs-Vorschlag: gleicht `ident` gegen ALLE bestehenden
 * Vorgänge ab (Vorgang + Akte + Antragsteller-Person). Reine Vorschlagsfunktion.
 * Wird vom `/match`-Endpoint und von der Warteschlangen-Auswertung genutzt.
 */
export async function ermittleMatchKandidaten(ident: MatchIdent): Promise<ScoredKandidat[]> {
  const vorgaenge = await listVorgaenge();
  const kandidaten: MatchKandidat[] = await Promise.all(
    vorgaenge.map(async (v): Promise<MatchKandidat> => {
      const [akte, personen] = await Promise.all([getAkte(v.akteId), listPersonen(v.id)]);
      const at = personen.find((p) => p.rolle === 'antragsteller');
      const w = v.wohnung ?? {};
      const antragstellerName = at
        ? [at.nachname, at.vorname].filter(Boolean).join(', ')
        : akte?.antragstellerName ?? akte?.name;
      return {
        vorgangId: v.id,
        // Im Dokument genannte Nummern sind Behörden-Nummern — gegen die Wohngeldnummer abgleichen.
        antragsId: v.wohngeldnummer || v.antragsId,
        akteName: akte?.name,
        antragstellerName,
        nachname: at?.nachname || undefined,
        vorname: at?.vorname || undefined,
        geburtsdatum: at?.geburtsdatum || undefined,
        plz: w.plz ?? akte?.plz,
        ort: w.ort ?? akte?.ort,
        strasse: w.strasse ?? akte?.strasse,
        hausnummer: w.hausnummer ?? akte?.hausnummer,
      };
    }),
  );
  return matchVorgaenge(ident, kandidaten);
}

/**
 * Zuordnungs-Vorschlag: gleicht die identifizierenden Daten eines Eingangs gegen
 * ALLE bestehenden Vorgänge ab. Reine Vorschlagsfunktion — es wird NICHTS zugeordnet.
 * Body `{ stammdaten?, identitaet? }` → `{ kandidaten: ScoredKandidat[] }`.
 */
posteingangRoutes.post('/posteingang/match', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const body = await c.req.json<{ stammdaten?: ExtrahierteStammdaten; identitaet?: Identitaet }>().catch(() => null);
  if (!body) return c.json({ error: 'Ungültiger Request-Body' }, 400);

  const ident = buildIdent(body.stammdaten, body.identitaet);
  const scored = await ermittleMatchKandidaten(ident);
  return c.json({ kandidaten: scored });
});


/** Eingabe der Verteilungs-Kernlogik. */
export interface VerteilenInput {
  akteId?: string;
  neueAkte?: Record<string, unknown>;
  vorgangId?: string;
  neuerVorgang?: Record<string, unknown>;
  dokumente: Preview[];
  pruefen?: boolean;
  /** Kam die Zuordnung über einen bestätigten System-Vorschlag zustande? (Audit) */
  viaVorschlag?: boolean;
  /** Match-Level des bestätigten Vorschlags (hoch/mittel/gering). (Audit) */
  matchLevel?: string;
  /** Eingangsdatum des Umschlags (fristauslösend) — für die Dokument-Provenienz. */
  eingegangenAm?: string;
}

/** Ergebnis der Verteilungs-Kernlogik (Fehler als Wert, damit der Aufrufer den HTTP-Status setzt). */
export type VerteilenResult =
  | { ok: true; vorgang: Vorgang; akte: Akte; dokumente: Dokument[]; befundeCount?: number; istNeuerVorgang: boolean }
  | { ok: false; status: 400 | 404 | 500; error: string };

/**
 * Kernlogik der Verteilung (extrahiert, wiederverwendbar): Akte/Vorgang
 * auflösen/anlegen (bzw. an bestehenden Vorgang anhängen = Nachreichung),
 * Stammdaten übernehmen, Dokumente anlegen, Feld-Provenienz setzen, optional
 * prüfen, Audit. Liest die Bytes NICHT neu — die Refs stecken in den Previews.
 */
export async function verteileDokumente(c: Context, input: VerteilenInput): Promise<VerteilenResult> {
  const dokumente = Array.isArray(input.dokumente) ? input.dokumente : [];
  if (!dokumente.length) return { ok: false, status: 400, error: 'Keine Dokumente zum Zuordnen übergeben' };

  const userId = getCurrentUserId(c);

  // Antrags-Preview (steuert Stammdaten-Übernahme) suchen.
  const antragPreview = dokumente.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const stammdaten = antragPreview?.stammdaten;
  const confByPfad = antragPreview?.confidenceByPfad ?? {};

  // 1. Akte auflösen/anlegen.
  let akte: Awaited<ReturnType<typeof getAkte>> = null;
  let vorgang: Awaited<ReturnType<typeof getVorgang>> = null;

  if (input.vorgangId) {
    vorgang = await getVorgang(input.vorgangId);
    if (!vorgang) return { ok: false, status: 404, error: 'Vorgang nicht gefunden' };
    akte = await getAkte(vorgang.akteId);
  } else if (input.akteId) {
    akte = await getAkte(input.akteId);
    if (!akte) return { ok: false, status: 404, error: 'Akte nicht gefunden' };
  } else if (input.neueAkte || stammdaten) {
    const src = (input.neueAkte ?? {}) as Record<string, unknown>;
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
    return { ok: false, status: 400, error: 'akteId, neueAkte oder vorgangId ist erforderlich' };
  }
  if (!akte) return { ok: false, status: 500, error: 'Akte konnte nicht ermittelt werden' };

  // 2. Vorgang auflösen/anlegen.
  const istNeuerVorgang = !vorgang;
  if (!vorgang) {
    const src = (input.neuerVorgang ?? {}) as Record<string, unknown>;
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
  let antragstellerId: string | undefined;
  const neuePersonen: Person[] = [];
  let uebernommenePfade: string[] = [];
  if (stammdaten) {
    // Neuer Vorgang: alles übernehmen; bestehender Vorgang: nur leere Felder (Handeingaben bleiben).
    const uebernahme = stammdatenUebernahme(vorgang, stammdaten, !istNeuerVorgang);
    uebernommenePfade = uebernahme.pfade;
    if (Object.keys(uebernahme.updates).length) {
      vorgang = await updateVorgang(vorgang.id, uebernahme.updates) ?? vorgang;
    }

    // Haushalt anlegen — nur, wenn der Vorgang noch keine Personen hat (Spec Haushalt §3.2).
    const vorhanden = await listPersonen(vorgang.id);
    if (vorhanden.length === 0) {
      const { personen: entwuerfe } = personenAusAntrag(stammdaten);
      for (const e of entwuerfe) {
        const { schluessel, ...daten } = e;
        const neu = await createPerson({ ...daten, vorgangId: vorgang.id });
        neuePersonen.push(neu);
        if (schluessel === 'P1') antragstellerId = neu.id;
      }
    } else {
      antragstellerId = vorhanden.find((p) => p.rolle === 'antragsteller')?.id;
    }
  }

  // 4. Dokumente anlegen — personenbezogene Nachweise der passenden Person zuordnen.
  const personenImVorgang = await listPersonen(vorgang.id);
  const angelegt: Dokument[] = [];
  let antragDokumentId: string | undefined;
  const eingegangenAm = input.eingegangenAm || new Date().toISOString();
  for (const d of dokumente) {
    const ref = resolveStorageRef(d.storageRef);
    const zuordnung = ordneNachweisZu(d.typ, d.identitaet, personenImVorgang);
    const dok = await createDokument({
      vorgangId: vorgang.id,
      typ: d.typ,
      titel: d.titel,
      quelle: d.dateiname,
      istOriginal: false,
      s3Key: ref.s3Key,
      pfad: ref.pfad,
      eingegangenAm,
      extrahierterText: (d.extrahierterTextGekuerzt || '').slice(0, 20000),
      analyse: d.analyse,
      extraktion: d.extraktion,
      ...(d.profil ? { profil: d.profil } : {}),
      ...(zuordnung.personId ? { personId: zuordnung.personId } : {}),
      ...(zuordnung.grund === 'unklar' ? { flags: [flagPersonUnklar()] } : {}),
    });
    if (antragPreview && d === antragPreview) antragDokumentId = dok.id;
    angelegt.push(dok);
  }

  // 4a. Kindergeld-Merkmal (nur für neu angelegte Personen; Spec Haushalt §3.5).
  if (neuePersonen.length) {
    const empfaenger = kindergeldEmpfaenger(neuePersonen, angelegt, vorgang.antragsdatum ?? eingegangenAm.slice(0, 10));
    if (empfaenger) {
      await updatePerson(empfaenger, { erhaelt_kindergeld: true }, { force: true });
      // Abgeleitet (Kinder unter 18 im Haushalt) ⇒ ebenfalls KI-Vorschlag.
      await setFeldStatus({
        vorgangId: vorgang.id, zielTyp: 'person', zielId: empfaenger,
        feldPfad: 'erhaelt_kindergeld', quelle: 'llm', bestaetigt: false, quellDokumentId: antragDokumentId,
      });
    }
  }

  // 4b. Feld-Provenienz (WP3): extrahierte Antrags-Felder als KI-Vorschlag markieren.
  if (stammdaten) {
    for (const feldPfad of uebernommenePfade) {
      await setFeldStatus({
        vorgangId: vorgang.id, zielTyp: 'vorgang', zielId: vorgang.id,
        feldPfad, quelle: 'llm', bestaetigt: false, quellDokumentId: antragDokumentId,
        confidence: confByPfad[feldPfad],
      });
    }
    // Jede aus dem Antrag angelegte Person ist ein KI-Vorschlag (Name/Geburtsdatum unbestätigt).
    for (const p of neuePersonen) {
      for (const feldPfad of feldStatusHaushaltPfade(p)) {
        await setFeldStatus({
          vorgangId: vorgang.id, zielTyp: 'person', zielId: p.id,
          feldPfad, quelle: 'llm', bestaetigt: false, quellDokumentId: antragDokumentId,
          confidence: p.id === antragstellerId ? confByPfad[feldPfad] : undefined,
        });
      }
    }
  }

  // Zuordnung per bestätigtem System-Vorschlag (bestehender Vorgang) gesondert protokollieren.
  const viaVorschlag = input.viaVorschlag === true && !istNeuerVorgang && !!input.vorgangId;
  await audit(c, {
    aktion: viaVorschlag ? 'dokument.zugeordnet' : 'dokument.hochgeladen',
    objektTyp: 'posteingang', objektId: vorgang.id, vorgangId: vorgang.id,
    detail: viaVorschlag
      ? `${angelegt.length} Dokument(e) per Zuordnungs-Vorschlag zugeordnet (Übereinstimmung: ${input.matchLevel ?? 'unbekannt'})`
      : `${angelegt.length} Dokument(e) aus dem Posteingang zugeordnet${istNeuerVorgang ? ' (neuer Vorgang)' : ''}`,
  });

  // 5. Optional direkt prüfen.
  let befundeCount: number | undefined;
  if (input.pruefen !== false) {
    befundeCount = (await pruefeUndSynchronisiere(vorgang.id))?.befundeCount;
  }

  return { ok: true, vorgang, akte, dokumente: angelegt, befundeCount, istNeuerVorgang };
}

/**
 * Verteilung: Previews einer (ggf. neuen) Akte/einem (ggf. neuen) Vorgang zuordnen.
 * Body: { akteId?, neueAkte?, vorgangId?, neuerVorgang?, dokumente:[preview...], pruefen? }
 */
posteingangRoutes.post('/posteingang/verteilen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const body = await c.req.json<VerteilenInput>().catch(() => null);
  if (!body) return c.json({ error: 'Ungültiger Request-Body' }, 400);

  const result = await verteileDokumente(c, { ...body, dokumente: Array.isArray(body.dokumente) ? body.dokumente : [] });
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ vorgang: result.vorgang, akte: result.akte, dokumente: result.dokumente, befundeCount: result.befundeCount }, 201);
});

// Direkt-Upload am Vorgang: siehe routes/posteingang-queue.ts (gleiche Erkennung wie der Posteingang).
