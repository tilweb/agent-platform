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
import {
  splitAktiv, brauchtGrenzpruefung, pruefeUndTrenne, trenneManuell, findeOriginal,
  ersetzeGruppe, alleSpeicherRefs, istPdf, baueTeile, defaultSplitDeps, type SeitenBereich,
} from '../posteingang-split';
import { erkenneDokumente, erkennungPerProfil, ladeProfil, type ErkannterAbschnitt } from '../dp-erkennung';
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
    ...(d.profil ? { profil: d.profil } : {}),
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

/** Umschlag-Ebene nach der Datei-Auswertung: Match-Vorschlag, Betreff, Status. */
async function umschlagAuswerten(dateien: PosteingangDatei[], betreffAlt?: string) {
  // Umschlag-Match: Antrag-Stammdaten + erste Nachweis-Identität über alle Dateien.
  const antrag = dateien.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const identitaet = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname || i.geburtsdatum));
  const kandidaten = await ermittleMatchKandidaten(buildIdent(antrag?.stammdaten, identitaet));
  const betreff = leiteBetreffAb(dateien) ?? betreffAlt;
  const alleFehler = dateien.length > 0 && dateien.every((d) => d.analyseFehler);
  return { kandidaten, betreff, alleFehler, status: (alleFehler ? 'fehler' : 'analysiert') as Posteingang['status'] };
}

function bereicheText(bereiche?: SeitenBereich[]): string {
  return (bereiche ?? []).map((b) => (b.from === b.to ? `S. ${b.from}` : `S. ${b.from}–${b.to}`)).join(', ');
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
async function erkenneMitProfil(dateien: PosteingangDatei[], userId: string | null | undefined) {
  const out: PosteingangDatei[] = [];
  const protokoll: Array<{ dateiname: string; bereiche?: SeitenBereich[]; modell?: string }> = [];
  const profil = await ladeProfil();
  for (const d of dateien) {
    if (!istPdf(d)) { await analysiereDatei(d, userId); out.push(d); continue; }
    try {
      const bytes = await loadDokumentDatei({ s3Key: d.s3Key, pfad: d.pfad });
      if (!bytes) { d.analyseFehler = 'Datei nicht auffindbar (kein hinterlegter Inhalt)'; out.push(d); continue; }
      const r = await erkenneDokumente(bytes, { filename: d.dateiname, userId: userId ?? undefined, profil });
      if (!r.abschnitte.length) { d.analyseFehler = 'Keine Inhalte erkannt (nur Leerseiten?)'; out.push(d); continue; }
      const trennen = splitAktiv() && brauchtGrenzpruefung(d) && r.abschnitte.length > 1;
      if (!trennen) {
        // Ganze Datei als ein Dokument: größter Abschnitt bestimmt Typ und Felder.
        const groesster = [...r.abschnitte].sort((x, y) => (y.seiteBis - y.seiteVon) - (x.seiteBis - x.seiteVon))[0]!;
        uebernimmAbschnitt(d, groesster, r.quelle, r.profilHash);
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
  if (!splitAktiv()) return { dateien, protokoll: [] as Array<{ dateiname: string; bereiche?: SeitenBereich[]; modell?: string }> };
  const out: PosteingangDatei[] = [];
  const protokoll: Array<{ dateiname: string; bereiche?: SeitenBereich[]; modell?: string }> = [];
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
      // Erkennung: DP-Segmentprofil (Standard) oder bisheriger Weg (Split + eigene Klassifikation).
      const profilWeg = erkennungPerProfil();
      const split = profilWeg
        ? await erkenneMitProfil(eingang.dateien.map((d) => ({ ...d })), userId)
        : await trenneSammelPdfs(eingang.dateien.map((d) => ({ ...d })), userId);
      const dateien = split.dateien;
      for (const t of split.protokoll) {
        await audit(c, {
          aktion: 'posteingang.getrennt', objektTyp: 'posteingang', objektId: id,
          detail: `„${t.dateiname}" automatisch in ${t.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(t.bereiche)})${t.modell ? ` · Modell ${t.modell}` : ''}`,
        });
      }

      if (!profilWeg) for (const d of dateien) await analysiereDatei(d, userId);

      const { kandidaten, betreff, alleFehler, status } = await umschlagAuswerten(dateien, eingang.betreff);
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

/**
 * POST /posteingang/:id/trennung — { hash, startSeiten? }. Manuelle Korrektur des
 * Mehrdokument-Splits: `hash` = Hash des Originals (bzw. der ungetrennten Datei),
 * `startSeiten` = Seiten, auf denen ein neues Dokument beginnt. Leer/[1] ⇒ als ein
 * Dokument behandeln. War der Eingang schon ausgewertet, werden die neuen Dateien
 * sofort ausgewertet und der Match-Vorschlag neu berechnet.
 */
posteingangQueueRoutes.post('/posteingang/:id/trennung', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);

  const id = c.req.param('id');
  const eingang = await getPosteingang(id);
  if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
  if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);
  if (eingang.status === 'in_analyse') return c.json({ error: 'Auswertung läuft gerade — bitte kurz warten' }, 409);

  const body = await c.req.json<{ hash?: string; startSeiten?: unknown }>().catch(() => null);
  const hash = typeof body?.hash === 'string' ? body.hash : '';
  const startSeiten = Array.isArray(body?.startSeiten) ? body!.startSeiten.map((n) => Number(n)) : [];
  const gefunden = hash ? findeOriginal(eingang.dateien, hash) : null;
  if (!gefunden) return c.json({ error: 'Datei nicht gefunden' }, 404);
  if (!istPdf(gefunden.original)) return c.json({ error: 'Nur PDF-Dateien können getrennt werden' }, 400);

  let ergebnis: Awaited<ReturnType<typeof trenneManuell>>;
  try {
    ergebnis = await trenneManuell(gefunden.original, startSeiten);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Trennung fehlgeschlagen' }, 400);
  }

  // Bytes der bisherigen Teile entfernen (best-effort) — das Original bleibt.
  const alteTeile = eingang.dateien.filter((d) => d.teilVon?.hash === hash);
  for (const t of alteTeile) await removeStoredFile({ s3Key: t.s3Key, pfad: t.pfad });

  const dateien = ersetzeGruppe(eingang.dateien, hash, ergebnis.dateien).map((d) => ({ ...d }));
  const userId = getCurrentUserId(c);
  let updates: Partial<Posteingang> = { dateien };
  if (eingang.status === 'analysiert' || eingang.status === 'fehler') {
    const neu = dateien.filter((d) => !d.typ && !d.analyseFehler);
    if (erkennungPerProfil()) {
      // Manuell gebildete Teile/Dateien nicht erneut trennen (brauchtGrenzpruefung = false).
      const ergebnis = await erkenneMitProfil(neu, userId);
      for (const d of neu) Object.assign(d, ergebnis.dateien.find((x) => x.hash === d.hash) ?? d);
    } else {
      for (const d of neu) await analysiereDatei(d, userId);
    }
    const { kandidaten, betreff, status } = await umschlagAuswerten(dateien, eingang.betreff);
    updates = { dateien, matchVorschlag: kandidaten, betreff, status };
  }
  const updated = await updatePosteingang(id, updates);

  await audit(c, {
    aktion: ergebnis.getrennt ? 'posteingang.getrennt' : 'posteingang.trennung_aufgehoben',
    objektTyp: 'posteingang', objektId: id,
    detail: ergebnis.getrennt
      ? `„${gefunden.original.dateiname}" manuell in ${ergebnis.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(ergebnis.bereiche)})`
      : `„${gefunden.original.dateiname}" manuell als ein Dokument (${ergebnis.seitenGesamt} Seiten) festgelegt`,
  });
  return c.json({ posteingang: updated });
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

  // Teile UND Originale getrennter Sammel-PDFs entfernen.
  for (const ref of alleSpeicherRefs(eingang.dateien)) {
    await removeStoredFile(ref);
  }
  const geloescht = await deletePosteingang(id);
  await audit(c, { aktion: 'posteingang.geloescht', objektTyp: 'posteingang', objektId: id, detail: `${eingang.dateien.length} Datei(en) entfernt` });
  return c.json({ ok: geloescht });
});
