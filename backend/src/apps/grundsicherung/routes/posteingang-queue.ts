/**
 * Grundsicherung — Persistente Posteingang-Warteschlange (Adapter auf den Antrag-Kern) und
 * Upload am Vorgang.
 *
 * Die Mechanik (ingest/Einlieferung, Liste, Detail, Datei/Vorschau/Seite, Auswertung im
 * Hintergrund mit Fortschritt, manuelle Trennung, Verwerfen, Patch, Löschen, KI-Verbrauch) liegt
 * in `apps/_antrag-kern/posteingang/routen.ts`. Hier die fachlichen Hooks:
 *  - `analysiere`: Erkennung NUR über das DP-Segmentprofil „Grundsicherung-Eingang" (Seiten
 *    klassifizieren, Sammel-PDF in Teile trennen, je Abschnitt auslesen) — kein Legacy-Weg.
 *  - `werteUmschlagAus`: Match über Name + Geburtsdatum (+ Aktenzeichen/Anschrift), Betreff.
 *  - `zuordnen`: `verteileDokumente` (neuer Vorgang oder Nachreichung; Quelle „weiterleitung"
 *    setzt den Ersteingang § 16 Abs. 2 SGB I).
 * Endpunkte, Request- und Antwortformen wie Wohngeld (Präfix /apps/grundsicherung).
 *
 * Als Fabrik (`createPosteingangQueue(deps)`) gebaut, damit die Hooks mit Kern-Fakes getestet
 * werden können; `posteingangQueueRoutes` nutzt die echten Abhängigkeiten.
 */
import type { Context } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { mitFortschritt } from '../../../extraction/fortschritt';
import { ausErkennung, type FortschrittMelder } from '../../_antrag-kern/posteingang/fortschritt';
import { sha256Hex } from '../../_antrag-kern/posteingang/zustand';
import {
  createPosteingangRoutes, type PosteingangKiAktion, type PosteingangRoutenOptionen,
  type TrennProtokoll, type ZuordnungErgebnis,
} from '../../_antrag-kern/posteingang/routen';
import type { KiBezug, KiVerbrauchUebersicht } from '../../_antrag-kern/ki-verbrauch';
import type { SeitenBereich, SplitDeps } from '../../_antrag-kern/posteingang/split';
import { getVorgang, posteingangStore } from '../storage';
import { audit, type AuditEvent } from '../audit';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { ablage } from '../filestore';
import { vorschauInfo, seitenAntwort } from '../seitenvorschau';
import { split, defaultSplitDeps, istPdf, brauchtGrenzpruefung, bereicheText } from '../posteingang-split';
import { erkenneDokumente, ladeProfil, type ErkannterAbschnitt, type GeladenesProfil, type ProfilLauf } from '../dp-erkennung';
import { messeKiVerbrauch, ordneKiVerbrauchZu, kiVerbrauchFuerPosteingang, type KiAktion } from '../ki-verbrauch';
import { governanceDetail } from '../ki-governance';
import { GRUNDSICHERUNG_PROFIL_VORLAGE_STAND } from '../../../extraction/templates/grundsicherung-eingang';
import { buildIdent, standardVerteilung, type DokumentVorlage, type VerteilenInput, type VerteilenResult } from '../verteilung';
import { ersteingangAus, ersteingangMitKorrektur, korrigiereStammdaten, leiteBetreffAb } from '../stammdaten-uebernahme';
import type { MatchIdent, ScoredKandidat } from '../matching';
import type { ExtrahierteStammdaten, Posteingang, PosteingangDatei, PosteingangQuelle, Vorgang } from '../types';

/** Obergrenze je Einlieferung (Summe aller Dateien). */
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/** Zulässige Kanäle des Grundsicherungs-Posteingangs (inkl. Weiterleitung einer anderen Stelle). */
export const POSTEINGANG_QUELLEN_GS: readonly PosteingangQuelle[] = ['manuell', 'scan', 'email', 'import', 'weiterleitung'];

export interface PosteingangQueueDeps {
  store: PosteingangRoutenOptionen<PosteingangDatei, ScoredKandidat, Posteingang>['store'];
  ablage: PosteingangRoutenOptionen<PosteingangDatei, ScoredKandidat, Posteingang>['ablage'];
  split: PosteingangRoutenOptionen<PosteingangDatei, ScoredKandidat, Posteingang>['split'] & {
    splitAktiv: () => boolean;
    baueTeile: (original: PosteingangDatei, bytes: Uint8Array, seitenGesamt: number, bereiche: SeitenBereich[], manuell: boolean, deps?: SplitDeps) => Promise<PosteingangDatei[]>;
  };
  audit: (c: Context, e: AuditEvent) => Promise<void>;
  kiVerbrauch: {
    messeKiVerbrauch: <T>(aktion: KiAktion, bezug: KiBezug, fn: () => Promise<T>) => Promise<T>;
    ordneKiVerbrauchZu: (posteingangId: string, vorgangId: string, istNeuerVorgang: boolean) => Promise<void>;
    kiVerbrauchFuerPosteingang: (posteingangId: string) => Promise<KiVerbrauchUebersicht>;
  };
  vorschau: PosteingangRoutenOptionen<PosteingangDatei, ScoredKandidat, Posteingang>['vorschau'];
  /** DP-Profil laden (einmal je Umschlag) und eine Datei erkennen. */
  ladeProfil: () => Promise<GeladenesProfil>;
  erkenne: (bytes: Uint8Array, opts: { filename?: string; userId?: string; profil?: GeladenesProfil }) => Promise<ProfilLauf>;
  verteile: (c: Context, input: VerteilenInput) => Promise<VerteilenResult>;
  ermittleMatchKandidaten: (ident: MatchIdent) => Promise<ScoredKandidat[]>;
  getVorgang: (id: string) => Promise<Vorgang | null>;
}

/** Rekonstruiert die Verteil-Vorlage aus einer gespeicherten Datei (Zuordnung ohne Re-Upload). */
export function dateiZuVorlage(d: PosteingangDatei): DokumentVorlage {
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

/** Übernimmt einen erkannten Profil-Abschnitt als Auswertung in die Datei (mutiert `d`). */
export function uebernimmAbschnitt(d: PosteingangDatei, a: ErkannterAbschnitt, quelle: 'datenbank' | 'vorlage', profilHash?: string): void {
  d.typ = a.typ;
  d.titel = a.titel;
  d.analyse = a.analyse;
  d.stammdaten = a.stammdaten;
  d.identitaet = a.identitaet;
  d.extraktion = { ...a.extraktion, erzeugtAm: new Date().toISOString() };
  d.fieldConfidences = a.confidenceByPfad;
  d.extrahierterTextGekuerzt = a.text.slice(0, 4000);
  d.analyseFehler = undefined;
  d.profil = { abschnitt: a.abschnitt, konfidenz: a.konfidenz, rohwerte: a.rohwerte, quelle, profilHash, vorlageStand: GRUNDSICHERUNG_PROFIL_VORLAGE_STAND };
}

export function createPosteingangQueue(d: PosteingangQueueDeps) {
  /**
   * Erkennung über das DP-Segmentprofil: je Datei Seiten klassifizieren, Sammel-PDFs in
   * Abschnitte trennen und auslesen. Bereits getrennte Teile, manuell festgelegte Dateien und
   * Bilder werden nicht (neu) getrennt; dort bestimmt der größte Abschnitt Typ und Felder.
   * Fehler je Datei landen in `analyseFehler` (kein Ersatzweg).
   */
  async function erkenneMitProfil(dateien: PosteingangDatei[], userId: string | null | undefined, melder?: FortschrittMelder) {
    const out: PosteingangDatei[] = [];
    const protokoll: TrennProtokoll[] = [];
    let profil: GeladenesProfil | undefined;
    for (const [i, x] of dateien.entries()) {
      melder?.setze({ phase: 'laden', text: `Datei „${x.dateiname}" wird geladen`, datei: x.dateiname, dateiNr: i + 1, dateienGesamt: dateien.length });
      try {
        const bytes = await d.ablage.loadDokumentDatei({ s3Key: x.s3Key, pfad: x.pfad });
        if (!bytes) { x.analyseFehler = 'Datei nicht auffindbar (kein hinterlegter Inhalt)'; out.push(x); continue; }
        profil ??= await d.ladeProfil();
        const geladen = profil;
        const r = await mitFortschritt(
          (e) => melder?.setze(ausErkennung(e)),
          () => d.erkenne(bytes, { filename: x.dateiname, userId: userId ?? undefined, profil: geladen }),
        );
        if (!r.abschnitte.length) { x.analyseFehler = 'Keine Inhalte erkannt (nur Leerseiten?)'; out.push(x); continue; }
        const trennen = istPdf(x) && d.split.splitAktiv() && brauchtGrenzpruefung(x) && r.abschnitte.length > 1;
        if (!trennen) {
          const groesster = [...r.abschnitte].sort((a, b) => (b.seiteBis - b.seiteVon) - (a.seiteBis - a.seiteVon))[0]!;
          uebernimmAbschnitt(x, groesster, r.quelle, r.profilHash);
          if (istPdf(x) && !x.teilVon && !x.trennung) x.trennung = { status: 'ein_dokument', seitenGesamt: r.seiten };
          out.push(x);
          continue;
        }
        const bereiche = r.abschnitte.map((a) => ({ from: a.seiteVon, to: a.seiteBis }));
        const teile = await d.split.baueTeile(x, bytes, r.seiten, bereiche, false);
        teile.forEach((t, k) => uebernimmAbschnitt(t, r.abschnitte[k]!, r.quelle, r.profilHash));
        out.push(...teile);
        protokoll.push({ dateiname: x.dateiname, bereiche, modell: `Profil „Grundsicherung-Eingang" (${r.quelle === 'datenbank' ? 'gepflegter Stand' : 'Vorlage'})` });
      } catch (err) {
        console.warn('[grundsicherung] Profil-Erkennung fehlgeschlagen:', x.dateiname, err instanceof Error ? err.message : err);
        x.analyseFehler = `Erkennung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`;
        out.push(x);
      }
    }
    return { dateien: out, protokoll };
  }

  async function analysiere(dateien: PosteingangDatei[], { userId, melder }: { userId: string | null | undefined; melder: FortschrittMelder }) {
    return erkenneMitProfil(dateien, userId, melder);
  }

  /** Neu gebildete Dateien nach manueller Trennung auswerten (mutiert `neu`, trennt nicht erneut). */
  async function werteNeueDateienAus(neu: PosteingangDatei[], { userId }: { userId: string | null | undefined }) {
    const ergebnis = await erkenneMitProfil(neu, userId);
    for (const x of neu) Object.assign(x, ergebnis.dateien.find((y) => y.hash === x.hash) ?? x);
  }

  /** Umschlag-Ebene: Match-Vorschlag (Antrag-Stammdaten + erste Nachweis-Identität) und Betreff. */
  async function werteUmschlagAus(dateien: PosteingangDatei[], betreffAlt?: string) {
    const antrag = dateien.find((x) => x.typ === 'grundsicherungsantrag' && x.stammdaten);
    const identitaet = dateien.map((x) => x.identitaet).find((i) => i && (i.nachname || i.vorname || i.geburtsdatum));
    const matchVorschlag = await d.ermittleMatchKandidaten(buildIdent(antrag?.stammdaten, antrag ? undefined : identitaet));
    return { matchVorschlag, betreff: leiteBetreffAb(dateien, betreffAlt) };
  }

  /**
   * Zuordnung — { akteId?|neueAkte?, vorgangId?, pruefen?, viaVorschlag?, matchLevel?, stammdaten? }
   * (wie Wohngeld). vorgangId ⇒ Nachreichung. Quelle „weiterleitung" ⇒ Ersteingang am Vorgang.
   */
  async function zuordnen(c: Context, eingang: Posteingang, rohBody: Record<string, unknown>): Promise<ZuordnungErgebnis> {
    const body = rohBody as {
      akteId?: string; neueAkte?: Record<string, unknown>; vorgangId?: string;
      pruefen?: boolean; viaVorschlag?: boolean; matchLevel?: string; stammdaten?: ExtrahierteStammdaten;
    };
    const dokumente = eingang.dateien.map(dateiZuVorlage);
    // Stammdaten-Korrektur aus dem Detail-Formular mit den erkannten Antragsdaten zusammenführen
    // (das Formular zeigt nur einen Teil — Personenliste, IBAN usw. dürfen nicht verloren gehen).
    if (body.stammdaten) {
      const antrag = dokumente.find((x) => x.typ === 'grundsicherungsantrag') ?? dokumente[0];
      if (antrag) antrag.stammdaten = korrigiereStammdaten(antrag.stammdaten, body.stammdaten);
    }
    const result = await d.verteile(c, {
      akteId: body.akteId, neueAkte: body.neueAkte, vorgangId: body.vorgangId,
      dokumente, pruefen: body.pruefen, viaVorschlag: body.viaVorschlag, matchLevel: body.matchLevel,
      eingegangenAm: eingang.eingegangenAm,
      ersteingang: ersteingangMitKorrektur(ersteingangAus(eingang), body.stammdaten?.ersteingang),
    });
    if (!result.ok) return { ok: false, error: result.error, status: result.status };
    return {
      ok: true,
      vorgangId: result.vorgang.id,
      akteId: result.akte.id,
      istNeuerVorgang: result.istNeuerVorgang,
      detail: `Eingang dem Vorgang ${result.vorgang.vorgangsnummer} zugeordnet${body.vorgangId && !result.istNeuerVorgang ? ' (Nachreichung)' : ' (neuer Vorgang)'}`,
      antwort: { vorgang: result.vorgang, akte: result.akte, befundeCount: result.befundeCount },
    };
  }

  /** Governance: jeder Messbereich trägt Profil-/Prompt-Stand im Detail. */
  const messe = <T>(aktion: KiAktion | PosteingangKiAktion, bezug: KiBezug, fn: () => Promise<T>) =>
    d.kiVerbrauch.messeKiVerbrauch(aktion, { ...bezug, detail: governanceDetail(bezug.detail ?? '') }, fn);

  const kern = createPosteingangRoutes<PosteingangDatei, ScoredKandidat, Posteingang>({
    store: d.store,
    ablage: d.ablage,
    split: d.split,
    audit: d.audit,
    kiVerbrauch: {
      messeKiVerbrauch: messe,
      ordneKiVerbrauchZu: d.kiVerbrauch.ordneKiVerbrauchZu,
      kiVerbrauchFuerPosteingang: d.kiVerbrauch.kiVerbrauchFuerPosteingang,
    },
    guards: { denyIfNotAppEditor, denyIfVorgangEingeschraenkt },
    vorschau: d.vorschau,
    analysiere,
    werteNeueDateienAus,
    werteUmschlagAus,
    zuordnen,
    quellen: POSTEINGANG_QUELLEN_GS,
    maxGesamtBytes: MAX_TOTAL_BYTES,
    logPraefix: '[grundsicherung]',
  });

  const routes = kern.routes;

  /**
   * POST /vorgaenge/:vorgangId/dokumente/upload — Upload am Vorgang, gleicher Weg wie der
   * Posteingang: Erkennung über das DP-Profil (Sammel-PDFs werden getrennt), danach Verteilung
   * an diesen Vorgang (Antragsdaten füllen leere Felder, Personen nur ohne vorhandene, Nachweise
   * den Personen zugeordnet), anschließend Prüfung. Antwort wie Wohngeld.
   */
  routes.post('/vorgaenge/:vorgangId/dokumente/upload', async (c) => {
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    const vorgangId = c.req.param('vorgangId');
    const vorgang = await d.getVorgang(vorgangId);
    if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
    const eingeschr = denyIfEingeschraenkt(vorgang);
    if (eingeschr) return c.json(eingeschr, 403);

    const form = await c.req.formData();
    const files = form.getAll('files').filter((e): e is File => e instanceof File);
    const single = form.get('file');
    if (single instanceof File) files.push(single);
    if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

    const userId = getCurrentUserId(c);
    const dateien: PosteingangDatei[] = [];
    let total = 0;
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      total += bytes.length;
      if (total > MAX_TOTAL_BYTES) return c.json({ error: 'Upload zu groß (max. 50 MB gesamt)' }, 413);
      const contentType = file.type || 'application/octet-stream';
      const stored = await d.ablage.storeUpload(bytes, file.name, contentType);
      const ref = d.ablage.resolveStorageRef(stored.storageRef);
      dateien.push({ dateiname: stored.filename, s3Key: ref.s3Key, pfad: ref.pfad, contentType, groesse: bytes.length, hash: sha256Hex(bytes) });
    }

    const erkannt = await messe('dokument_upload', {
      vorgangId, phase: 'bearbeitung', akteurId: userId, detail: `${dateien.length} Datei(en)`,
    }, () => erkenneMitProfil(dateien, userId));
    for (const t of erkannt.protokoll) {
      await d.audit(c, {
        aktion: 'posteingang.getrennt', objektTyp: 'vorgang', objektId: vorgangId, vorgangId,
        detail: `„${t.dateiname}" automatisch in ${t.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(t.bereiche)})${t.modell ? ` · ${t.modell}` : ''}`,
      });
    }
    const result = await d.verteile(c, {
      vorgangId,
      dokumente: erkannt.dateien.map(dateiZuVorlage),
      pruefen: true,
      eingegangenAm: new Date().toISOString(),
    });
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ dokumente: result.dokumente, dokument: result.dokumente[0], befundeCount: result.befundeCount }, 201);
  });

  return { routes, einliefern: kern.einliefern, hintergrund: kern.hintergrund, analysiere, werteUmschlagAus, zuordnen };
}

const standard = createPosteingangQueue({
  store: posteingangStore,
  ablage,
  split: { ...split, trenneManuell: split.trenneManuell, baueTeile: (o, b, s, be, m, deps) => split.baueTeile(o, b, s, be, m, deps ?? defaultSplitDeps) },
  audit,
  kiVerbrauch: { messeKiVerbrauch, ordneKiVerbrauchZu, kiVerbrauchFuerPosteingang },
  vorschau: { info: vorschauInfo, seitenAntwort },
  ladeProfil,
  erkenne: erkenneDokumente,
  verteile: standardVerteilung.verteileDokumente,
  ermittleMatchKandidaten: standardVerteilung.ermittleMatchKandidaten,
  getVorgang,
});

/** Programmatische Einlieferung in den Grundsicherungs-Posteingang (Naht für einen gemeinsamen Eingang). */
export const einliefern = standard.einliefern;

export const posteingangQueueRoutes = standard.routes;
