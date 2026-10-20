/**
 * Wohngeld — Persistente Posteingang-Warteschlange (S1–S4), Adapter auf den Antrag-Kern.
 *
 * Die Mechanik (ingest/Einlieferung, Liste, Detail, Datei/Vorschau/Seite, Auswertung im
 * Hintergrund inkl. Fortschritt und Hängend-Erkennung, manuelle Trennung, Verwerfen, Patch,
 * Löschen, KI-Verbrauch) liegt in `apps/_antrag-kern/posteingang/routen.ts`. Hier bleiben die
 * fachlichen Hooks: Erkennung (DP-Segmentprofil bzw. Split + eigene Klassifikation), Umschlag-
 * Match + Betreff, Zuordnung über `verteileDokumente` — sowie der Direkt-Upload am Vorgang.
 */
import type { Context } from 'hono';
import { getCurrentUserId } from '../../../../auth/middleware';
import { getVorgang, posteingangStore } from '../storage';
import { mitFortschritt } from '../../../../extraction/fortschritt';
import { seitenAntwort } from './seitenvorschau-route';
import { vorschauInfo } from '../seitenvorschau';
import { ausErkennung, type FortschrittMelder } from '../../kern/posteingang/fortschritt';
import { sha256Hex } from '../../kern/posteingang/zustand';
import { createPosteingangRoutes, type TrennProtokoll, type ZuordnungErgebnis } from '../../kern/posteingang/routen';
import { createVorgangUploadJob, type VorgangUploadErgebnis } from '../../kern/vorgang-upload';
import { audit } from '../audit';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { ablage, storeUpload, resolveStorageRef, loadDokumentDatei } from '../filestore';
import { klassifiziereUndExtrahiere } from '../extraction';
import { korrigiereStammdaten } from '../stammdaten-uebernahme';
import {
  verteileDokumente, ermittleMatchKandidaten, buildIdent, extractTextFromBytes,
  MAX_TOTAL_BYTES, type Preview,
} from './posteingang';
import { leiteBetreffAb } from '../posteingang-helpers';
import {
  split, splitAktiv, brauchtGrenzpruefung, pruefeUndTrenne, istPdf, baueTeile, bereicheText, defaultSplitDeps,
} from '../posteingang-split';
import { erkenneDokumente, erkennungPerProfil, ladeProfil, type ErkannterAbschnitt } from '../dp-erkennung';
import { messeKiVerbrauch, ordneKiVerbrauchZu, kiVerbrauchFuerPosteingang } from '../ki-verbrauch';
import type { Posteingang, PosteingangDatei } from '../types';
import type { ScoredKandidat } from '../matching';

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
    ...(d.profil ? { profil: d.profil } : {}),
  };
}

/** Klassifiziert + extrahiert eine Datei (mutiert `d`). Fehler landen in `analyseFehler`. */
async function analysiereDatei(d: PosteingangDatei, userId: string | null | undefined): Promise<void> {
  try {
    const bytes = await loadDokumentDatei({ s3Key: d.s3Key, pfad: d.pfad });
    if (!bytes) { d.analyseFehler = 'Datei nicht auffindbar (kein hinterlegter Inhalt)'; return; }
    const text = await extractTextFromBytes(bytes, d.contentType, d.dateiname);
    const erg = await klassifiziereUndExtrahiere(bytes, d.contentType || 'application/octet-stream', { userId: userId ?? undefined, filename: d.dateiname });
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

/** Umschlag-Ebene nach der Datei-Auswertung: Match-Vorschlag und Betreff (Status setzt der Kern). */
async function werteUmschlagAus(dateien: PosteingangDatei[], betreffAlt?: string) {
  // Umschlag-Match: Antrag-Stammdaten + erste Nachweis-Identität über alle Dateien.
  const antrag = dateien.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const identitaet = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname || i.geburtsdatum));
  const kandidaten = await ermittleMatchKandidaten(buildIdent(antrag?.stammdaten, identitaet));
  const betreff = leiteBetreffAb(dateien) ?? betreffAlt;
  return { matchVorschlag: kandidaten, betreff };
}

/** Übernimmt einen erkannten Profil-Abschnitt als Auswertung in die Datei (mutiert `d`). */
function uebernimmAbschnitt(d: PosteingangDatei, a: ErkannterAbschnitt, quelle: 'datenbank' | 'vorlage', profilHash?: string): void {
  d.typ = a.typ;
  d.titel = a.titel;
  d.analyse = a.analyse;
  d.stammdaten = a.stammdaten;
  d.identitaet = a.identitaet;
  d.extraktion = { ...a.extraktion!, erzeugtAm: new Date().toISOString() };
  d.fieldConfidences = a.confidenceByPfad;
  d.extrahierterTextGekuerzt = a.text.slice(0, 4000);
  d.analyseFehler = undefined;
  d.profil = { abschnitt: a.abschnitt, konfidenz: a.konfidenz, rohwerte: a.rohwerte, quelle, profilHash };
}

/**
 * Erkennung über das DP-Segmentprofil (Standard): je PDF Seiten klassifizieren, in
 * Abschnitte trennen und auslesen — ersetzt Grenzprüfung + eigene Klassifikation.
 * Bereits getrennte Teile und manuell festgelegte Dateien werden nicht neu getrennt;
 * dort bestimmt der größte erkannte Abschnitt Typ und Felder. Nicht-PDFs und Fehler
 * laufen über den bisherigen Weg.
 */
async function erkenneMitProfil(dateien: PosteingangDatei[], userId: string | null | undefined, melder?: FortschrittMelder) {
  const out: PosteingangDatei[] = [];
  const protokoll: TrennProtokoll[] = [];
  const profil = await ladeProfil();
  for (const [i, d] of dateien.entries()) {
    melder?.setze({ phase: 'laden', text: `Datei „${d.dateiname}" wird geladen`, datei: d.dateiname, dateiNr: i + 1, dateienGesamt: dateien.length });
    if (!istPdf(d)) { melder?.setze({ phase: 'auslesen', text: `„${d.dateiname}" wird ausgelesen` }); await analysiereDatei(d, userId); out.push(d); continue; }
    try {
      const bytes = await loadDokumentDatei({ s3Key: d.s3Key, pfad: d.pfad });
      if (!bytes) { d.analyseFehler = 'Datei nicht auffindbar (kein hinterlegter Inhalt)'; out.push(d); continue; }
      const r = await mitFortschritt(
        (e) => melder?.setze(ausErkennung(e)),
        () => erkenneDokumente(bytes, { filename: d.dateiname, userId: userId ?? undefined, profil }),
      );
      if (!r.abschnitte.length) { d.analyseFehler = 'Keine Inhalte erkannt (nur Leerseiten?)'; out.push(d); continue; }
      const trennen = splitAktiv() && brauchtGrenzpruefung(d) && r.abschnitte.length > 1;
      if (!trennen) {
        // Ganze Datei als ein Dokument: größter Abschnitt bestimmt Typ und Felder.
        const groesster = [...r.abschnitte].sort((x, y) => (y.seiteBis - y.seiteVon) - (x.seiteBis - x.seiteVon))[0]!;
        uebernimmAbschnitt(d, groesster, r.quelle, r.profilHash);
        // Ganze Datei bleibt ein Dokument: Seitenangaben des Abschnitts auf die Datei beziehen.
        if (d.analyse?.unterschrift_seite) d.analyse = { ...d.analyse, unterschrift_seite: d.analyse.unterschrift_seite + groesster.seiteVon - 1 };
        if (!d.teilVon && !d.trennung) d.trennung = { status: 'ein_dokument', seitenGesamt: r.seiten };
        out.push(d);
        continue;
      }
      const bereiche = r.abschnitte.map((a) => ({ from: a.seiteVon, to: a.seiteBis }));
      const teile = await baueTeile(d, bytes, r.seiten, bereiche, false, defaultSplitDeps);
      teile.forEach((t, i) => uebernimmAbschnitt(t, r.abschnitte[i]!, r.quelle, r.profilHash));
      out.push(...teile);
      protokoll.push({ dateiname: d.dateiname, bereiche, modell: `Profil „Wohngeld-Eingang" (${r.quelle === 'datenbank' ? 'gepflegter Stand' : 'Vorlage'})` });
    } catch (err) {
      console.warn('[wohngeld] Profil-Erkennung fehlgeschlagen — bisheriger Weg:', err instanceof Error ? err.message : err);
      const alt = await trenneSammelPdfs([d], userId);
      for (const x of alt.dateien) await analysiereDatei(x, userId);
      out.push(...alt.dateien);
      protokoll.push(...alt.protokoll);
    }
  }
  return { dateien: out, protokoll };
}

/**
 * Mehrdokument-Split vor der Klassifikation: jede Sammel-PDF wird (konservativ)
 * an erkannten Dokumentgrenzen in Teil-Dateien getrennt. Liefert die neue
 * Dateiliste + Protokoll der Trennungen fürs Audit.
 */
async function trenneSammelPdfs(dateien: PosteingangDatei[], userId: string | null | undefined) {
  if (!splitAktiv()) return { dateien, protokoll: [] as TrennProtokoll[] };
  const out: PosteingangDatei[] = [];
  const protokoll: TrennProtokoll[] = [];
  for (const d of dateien) {
    if (!brauchtGrenzpruefung(d)) { out.push(d); continue; }
    try {
      const r = await pruefeUndTrenne(d, { userId: userId ?? undefined });
      out.push(...r.dateien);
      if (r.getrennt) protokoll.push({ dateiname: d.dateiname, bereiche: r.bereiche, modell: r.modell });
    } catch (err) {
      console.warn('[wohngeld] Mehrdokument-Split fehlgeschlagen:', err instanceof Error ? err.message : err);
      out.push({ ...d, trennung: { status: 'unsicher', hinweis: 'Dokumentgrenzen konnten nicht geprüft werden — als ein Dokument behandelt.' } });
    }
  }
  return { dateien: out, protokoll };
}

/**
 * Auswertung eines Umschlags: DP-Segmentprofil (Standard) oder bisheriger Weg
 * (Split + eigene Klassifikation je Datei).
 */
async function analysiere(dateien: PosteingangDatei[], { userId, melder }: { userId: string | null | undefined; melder: FortschrittMelder }) {
  if (erkennungPerProfil()) return erkenneMitProfil(dateien, userId, melder);
  melder.setze({ phase: 'trennen', text: 'Dokumentgrenzen werden geprüft' });
  const r = await trenneSammelPdfs(dateien, userId);
  for (const [i, d] of r.dateien.entries()) {
    melder.setze({ phase: 'auslesen', text: `Dokument ${i + 1} von ${r.dateien.length} wird ausgelesen`, fertig: i, gesamt: r.dateien.length });
    await analysiereDatei(d, userId);
  }
  return r;
}

/** Neu gebildete Dateien nach manueller Trennung auswerten (mutiert `neu`). */
async function werteNeueDateienAus(neu: PosteingangDatei[], { userId }: { userId: string | null | undefined }) {
  if (erkennungPerProfil()) {
    // Manuell gebildete Teile/Dateien nicht erneut trennen (brauchtGrenzpruefung = false).
    const ergebnis = await erkenneMitProfil(neu, userId);
    for (const d of neu) Object.assign(d, ergebnis.dateien.find((x) => x.hash === d.hash) ?? d);
  } else {
    for (const d of neu) await analysiereDatei(d, userId);
  }
}

/**
 * Zuordnung — { akteId?|neueAkte?, vorgangId?, pruefen?, viaVorschlag?, matchLevel?, stammdaten? }.
 * Rekonstruiert die Previews aus den Refs und ruft die gemeinsame Kernlogik
 * `verteileDokumente`. vorgangId ⇒ Nachreichung an bestehenden Vorgang.
 */
async function zuordnen(c: Context, eingang: Posteingang, rohBody: Record<string, unknown>): Promise<ZuordnungErgebnis> {
  const body = rohBody as {
    akteId?: string; neueAkte?: Record<string, unknown>; vorgangId?: string;
    pruefen?: boolean; viaVorschlag?: boolean; matchLevel?: string;
    stammdaten?: Preview['stammdaten'];
  };

  const dokumente = eingang.dateien.map(dateiZuPreview);
  // Optionale Stammdaten-Korrektur aus dem Detail-Formular mit den erkannten Antragsdaten
  // zusammenführen (Formular zeigt nur einen Teil — Haushalt/Wohngeldnummer bleiben erhalten).
  if (body.stammdaten) {
    const antrag = dokumente.find((d) => d.typ === 'wohngeldantrag') ?? dokumente[0];
    if (antrag) antrag.stammdaten = korrigiereStammdaten(antrag.stammdaten, body.stammdaten);
  }

  const result = await verteileDokumente(c, {
    akteId: body.akteId, neueAkte: body.neueAkte, vorgangId: body.vorgangId,
    dokumente, pruefen: body.pruefen, viaVorschlag: body.viaVorschlag, matchLevel: body.matchLevel,
    eingegangenAm: eingang.eingegangenAm,
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };

  return {
    ok: true,
    vorgangId: result.vorgang.id,
    akteId: result.akte.id,
    istNeuerVorgang: result.istNeuerVorgang,
    detail: `Eingang dem Vorgang ${result.vorgang.antragsId} zugeordnet${body.vorgangId && !result.istNeuerVorgang ? ' (Nachreichung)' : ' (neuer Vorgang)'}`,
    antwort: { vorgang: result.vorgang, akte: result.akte, befundeCount: result.befundeCount },
  };
}

const kern = createPosteingangRoutes<PosteingangDatei, ScoredKandidat, Posteingang>({
  store: posteingangStore,
  ablage,
  split,
  audit,
  kiVerbrauch: { messeKiVerbrauch, ordneKiVerbrauchZu, kiVerbrauchFuerPosteingang },
  guards: { denyIfNotAppEditor, denyIfVorgangEingeschraenkt },
  vorschau: { info: vorschauInfo, seitenAntwort },
  analysiere,
  werteNeueDateienAus,
  werteUmschlagAus,
  zuordnen,
  quellen: ['manuell', 'scan', 'email', 'import'],
  maxGesamtBytes: MAX_TOTAL_BYTES,
  logPraefix: '[wohngeld]',
  jobArt: 'wohngeld-posteingang',
});

/** Programmatische Einlieferung in den Wohngeld-Posteingang (Naht für einen gemeinsamen Eingang). */
export const einliefern = kern.einliefern;

export const posteingangQueueRoutes = kern.routes;

// ── Upload direkt am Vorgang ────────────────────────────────────────────────

/**
 * POST /vorgaenge/:vorgangId/dokumente/upload — Dokumente-Tab der Detailseite.
 * Gleicher Weg wie der Posteingang (Spec Testrückmeldungen, Punkt 2): Erkennung über das
 * DP-Segmentprofil (Sammel-PDFs werden getrennt), danach Verteilung an diesen Vorgang —
 * Antragsdaten füllen leere Felder, Haushalt nur ohne vorhandene Personen, Nachweise werden
 * Personen zugeordnet, anschließend Prüfung.
 */
posteingangQueueRoutes.post('/vorgaenge/:vorgangId/dokumente/upload', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);

  const form = await c.req.formData();
  const files = form.getAll('files').filter((e): e is File => e instanceof File);
  const single = form.get('file');
  if (single instanceof File) files.push(single);
  if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

  const dateien: PosteingangDatei[] = [];
  let total = 0;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);
    const contentType = file.type || 'application/octet-stream';
    const stored = await storeUpload(bytes, file.name, contentType);
    const ref = resolveStorageRef(stored.storageRef);
    dateien.push({ dateiname: stored.filename, s3Key: ref.s3Key, pfad: ref.pfad, contentType, groesse: bytes.length, hash: sha256Hex(bytes) });
  }

  // Erkennung, Verteilung und Prüfung laufen als fortsetzbarer Job (Worker oder Web); die Oberfläche fragt ab.
  const jobId = await vorgangUpload.stelleUploadEin(c, vorgangId, dateien);
  await audit(c, {
    aktion: 'vorgang.dokumente_hochgeladen', objektTyp: 'vorgang', objektId: vorgangId, vorgangId,
    detail: `${dateien.length} Datei(en) hochgeladen, Auswertung im Hintergrund`,
  });
  return c.json({ job: jobId }, 202);
});

/** GET /vorgaenge/:vorgangId/dokumente/upload/:jobId — Status des Uploads (am Ende Antwort wie früher). */
posteingangQueueRoutes.get('/vorgaenge/:vorgangId/dokumente/upload/:jobId', async (c) => {
  const status = await vorgangUpload.uploadStatus(c.req.param('vorgangId'), c.req.param('jobId'));
  if (!status) return c.json({ error: 'Upload nicht gefunden' }, 404);
  return c.json(status);
});

/** Upload am Vorgang: Erkennung wie im Posteingang (DP-Profil oder bisheriger Weg), Verteilung, Prüfung. */
async function verarbeiteVorgangUpload(
  c: Context,
  e: { vorgangId: string; dateien: PosteingangDatei[]; userId: string | null; melde: (text: string) => Promise<void> },
): Promise<VorgangUploadErgebnis> {
  const { vorgangId, dateien } = e;
  const userId = e.userId ?? undefined;
  await e.melde('Dokumente werden erkannt');
  const erkannt = await messeKiVerbrauch('dokument_upload', {
    vorgangId, phase: 'bearbeitung', akteurId: userId, detail: `${dateien.length} Datei(en)`,
  }, async () => {
    if (erkennungPerProfil()) return erkenneMitProfil(dateien, userId);
    const r = await trenneSammelPdfs(dateien, userId);
    for (const d of r.dateien) await analysiereDatei(d, userId);
    return r;
  });
  for (const t of erkannt.protokoll) {
    await audit(c, {
      aktion: 'posteingang.getrennt', objektTyp: 'vorgang', objektId: vorgangId, vorgangId,
      detail: `„${t.dateiname}" automatisch in ${t.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(t.bereiche)})${t.modell ? ` · Modell ${t.modell}` : ''}`,
    });
  }
  await e.melde('Dokumente werden dem Vorgang zugeordnet und geprüft');
  const result = await verteileDokumente(c, {
    vorgangId,
    dokumente: erkannt.dateien.map(dateiZuPreview),
    pruefen: true,
    eingegangenAm: new Date().toISOString(),
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, antwort: { dokumente: result.dokumente, dokument: result.dokumente[0], befundeCount: result.befundeCount } };
}

const vorgangUpload = createVorgangUploadJob<PosteingangDatei>({ jobArt: 'wohngeld-vorgang-upload', verarbeite: verarbeiteVorgangUpload });
