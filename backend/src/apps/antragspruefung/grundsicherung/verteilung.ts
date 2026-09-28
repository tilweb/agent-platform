/**
 * Grundsicherung — Verteilung erkannter Dokumente an Akte/Vorgang (Posteingang-Zuordnung und
 * Upload am Vorgang) sowie der Match-Vorschlag.
 *
 * `verteileDokumente`: Akte/Vorgang auflösen oder anlegen (bzw. an bestehenden Vorgang anhängen
 * = Nachreichung), Antragsdaten in LEERE Felder übernehmen, Ersteingang (Weiterleitung) setzen,
 * Personen der Einsatzgemeinschaft/des Haushalts aus dem Antrag anlegen (nur wenn noch keine da
 * sind), Dokumente anlegen und personenbezogene Nachweise der Person zuordnen (`personId`),
 * Feld-Status für KI-Werte setzen, protokollieren, danach prüfen.
 *
 * Als Fabrik mit Abhängigkeiten (`createVerteilung(deps)`), damit die Kernlogik mit
 * In-Memory-Fakes getestet werden kann; `standardVerteilung` nutzt die echten Speicher.
 */
import type { Context } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  getAkte, createAkte, getVorgang, createVorgang, updateVorgang, listVorgaenge,
  listPersonen, createPerson, createDokument, setFeldStatus,
} from './storage';
import { audit } from './audit';
import { pruefeUndSynchronisiere } from './pruefung';
import { resolveStorageRef } from './filestore';
import { feldStatusPersonPfade, flagPersonUnklar, ordneNachweisZu, personenAusAntrag } from './haushalt';
import { matchVorgaenge, type MatchIdent, type MatchKandidat, type ScoredKandidat } from './matching';
import { ersteingangUebernahme, stammdatenUebernahme } from './stammdaten-uebernahme';
import type {
  Akte, Dokument, DokumentAnalyse, DokumentExtraktion, DokumentTyp, Ersteingang, ExtrahierteStammdaten,
  Identitaet, Person, ProfilErkennung, Vorgang,
} from './types';

/** Ein erkanntes Dokument, bereit zur Verteilung (aus einer Posteingang-Datei rekonstruiert). */
export interface DokumentVorlage {
  typ: DokumentTyp;
  titel?: string;
  analyse?: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
  identitaet?: Identitaet;
  confidenceByPfad?: Record<string, number>;
  extraktion?: DokumentExtraktion;
  profil?: ProfilErkennung;
  dateiname: string;
  extrahierterTextGekuerzt?: string;
  /** `s3:<key>` bzw. `local:<pfad>` (leer = ohne Datei). */
  storageRef: string;
}

export interface VerteilenInput {
  akteId?: string;
  neueAkte?: Record<string, unknown>;
  vorgangId?: string;
  neuerVorgang?: Record<string, unknown>;
  dokumente: DokumentVorlage[];
  pruefen?: boolean;
  /** Zuordnung über einen bestätigten System-Vorschlag? (Audit) */
  viaVorschlag?: boolean;
  matchLevel?: string;
  /** Eingangsdatum des Umschlags (fristauslösend) — Dokument-Provenienz. */
  eingegangenAm?: string;
  /** Ersteingang bei einer anderen Stelle (Posteingang-Quelle „weiterleitung", § 16 Abs. 2 SGB I). */
  ersteingang?: Ersteingang;
}

export type VerteilenResult =
  | { ok: true; vorgang: Vorgang; akte: Akte; dokumente: Dokument[]; personen: Person[]; befundeCount?: number; istNeuerVorgang: boolean }
  | { ok: false; status: 400 | 404 | 500; error: string };

export const standardVerteilungDeps = {
  getAkte, createAkte, getVorgang, createVorgang, updateVorgang, listVorgaenge,
  listPersonen, createPerson, createDokument, setFeldStatus,
  audit, resolveStorageRef,
  pruefeUndSynchronisiere: async (vorgangId: string) => (await pruefeUndSynchronisiere(vorgangId))?.befundeCount,
};

export type VerteilungDeps = typeof standardVerteilungDeps;

/**
 * Identitäts-Signal für den Match: Antrag-Stammdaten (Name, Geburtsdatum, Anschrift, Aktenzeichen)
 * und/oder Nachweis-Identität. Name/Geburtsdatum aus `identitaet` haben Vorrang.
 */
export function buildIdent(stammdaten?: ExtrahierteStammdaten, identitaet?: Identitaet): MatchIdent {
  const at = stammdaten?.antragsteller;
  const ad = stammdaten?.adresse;
  return {
    nachname: identitaet?.nachname ?? at?.nachname,
    vorname: identitaet?.vorname ?? at?.vorname,
    geburtsdatum: identitaet?.geburtsdatum ?? at?.geburtsdatum,
    plz: ad?.plz, ort: ad?.ort, strasse: ad?.strasse, hausnummer: ad?.hausnummer,
    ...(stammdaten?.aktenzeichen ? { aktenzeichen: stammdaten.aktenzeichen } : {}),
  };
}

/** Vergleichsdaten eines Vorgangs für den Match (rein). */
export function matchKandidat(v: Vorgang, akte: Akte | null, personen: Person[]): MatchKandidat {
  const at = personen.find((p) => p.rolle === 'antragsteller');
  const w = v.wohnung ?? {};
  return {
    vorgangId: v.id,
    vorgangsnummer: v.vorgangsnummer,
    aktenzeichen: v.aktenzeichen,
    akteName: akte?.name,
    antragstellerName: at ? [at.nachname, at.vorname].filter(Boolean).join(', ') : akte?.antragstellerName ?? akte?.name,
    nachname: at?.nachname || undefined,
    vorname: at?.vorname || undefined,
    geburtsdatum: at?.geburtsdatum || undefined,
    plz: w.plz ?? akte?.plz, ort: w.ort ?? akte?.ort, strasse: w.strasse ?? akte?.strasse, hausnummer: w.hausnummer ?? akte?.hausnummer,
  };
}

export function createVerteilung(d: VerteilungDeps) {
  /** Zuordnungs-Vorschlag: `ident` gegen ALLE bestehenden Vorgänge (reine Vorschlagsfunktion). */
  async function ermittleMatchKandidaten(ident: MatchIdent): Promise<ScoredKandidat[]> {
    const vorgaenge = await d.listVorgaenge();
    const kandidaten = await Promise.all(vorgaenge.map(async (v) => {
      const [akte, personen] = await Promise.all([d.getAkte(v.akteId), d.listPersonen(v.id)]);
      return matchKandidat(v, akte, personen);
    }));
    return matchVorgaenge(ident, kandidaten);
  }

  async function verteileDokumente(c: Context, input: VerteilenInput): Promise<VerteilenResult> {
    const dokumente = Array.isArray(input.dokumente) ? input.dokumente : [];
    if (!dokumente.length) return { ok: false, status: 400, error: 'Keine Dokumente zum Zuordnen übergeben' };
    const userId = getCurrentUserId(c);

    const antrag = dokumente.find((x) => x.typ === 'grundsicherungsantrag' && x.stammdaten);
    const stammdaten = antrag?.stammdaten;
    const confByPfad = antrag?.confidenceByPfad ?? {};

    // 1. Akte / Vorgang auflösen oder anlegen.
    let akte: Akte | null = null;
    let vorgang: Vorgang | null = null;
    if (input.vorgangId) {
      vorgang = await d.getVorgang(input.vorgangId);
      if (!vorgang) return { ok: false, status: 404, error: 'Vorgang nicht gefunden' };
      akte = await d.getAkte(vorgang.akteId);
    } else if (input.akteId) {
      akte = await d.getAkte(input.akteId);
      if (!akte) return { ok: false, status: 404, error: 'Akte nicht gefunden' };
    } else if (input.neueAkte || stammdaten) {
      const src = (input.neueAkte ?? {}) as Record<string, unknown>;
      const at = stammdaten?.antragsteller;
      const nameAusAntrag = at ? [at.nachname, at.vorname].filter(Boolean).join(', ') || undefined : undefined;
      const name = (typeof src.name === 'string' && src.name.trim()) || nameAusAntrag || 'Neue Akte';
      akte = await d.createAkte({
        antragstellerName: at ? [at.vorname, at.nachname].filter(Boolean).join(' ') || undefined : undefined,
        strasse: stammdaten?.adresse?.strasse, hausnummer: stammdaten?.adresse?.hausnummer,
        plz: stammdaten?.adresse?.plz, ort: stammdaten?.adresse?.ort,
        ...src,
        name,
        ownerId: userId,
      });
    } else {
      return { ok: false, status: 400, error: 'akteId, neueAkte oder vorgangId ist erforderlich' };
    }
    if (!akte) return { ok: false, status: 500, error: 'Akte konnte nicht ermittelt werden' };

    const istNeuerVorgang = !vorgang;
    if (!vorgang) {
      const src = (input.neuerVorgang ?? {}) as Record<string, unknown>;
      vorgang = await d.createVorgang({
        akteId: akte.id,
        ...(stammdaten?.antragsart ? { antragsart: stammdaten.antragsart } : {}),
        ...(stammdaten?.anspruchsgrund ? { anspruchsgrund: stammdaten.anspruchsgrund } : {}),
        ...(stammdaten?.antragsdatum ? { antragsdatum: stammdaten.antragsdatum } : {}),
        ...src,
        ownerId: userId,
      });
    }

    // 2. Antragsdaten übernehmen (neu: alles; Nachreichung: nur leere Felder) + Ersteingang.
    let uebernommenePfade: string[] = [];
    const updates: Partial<Vorgang> = {};
    if (stammdaten) {
      const u = stammdatenUebernahme(vorgang, stammdaten, !istNeuerVorgang);
      uebernommenePfade = u.pfade;
      Object.assign(updates, u.updates);
    }
    Object.assign(updates, ersteingangUebernahme(vorgang, input.ersteingang));
    if (Object.keys(updates).length) vorgang = (await d.updateVorgang(vorgang.id, updates, { force: true })) ?? vorgang;

    // 3. Personen aus dem Antrag — nur, wenn der Vorgang noch keine Personen hat.
    const neuePersonen: Person[] = [];
    if (stammdaten && (await d.listPersonen(vorgang.id)).length === 0) {
      for (const e of personenAusAntrag(stammdaten)) neuePersonen.push(await d.createPerson({ ...e, vorgangId: vorgang.id }));
    }

    // 4. Dokumente anlegen — personenbezogene Nachweise der passenden Person zuordnen.
    const personen = await d.listPersonen(vorgang.id);
    const eingegangenAm = input.eingegangenAm || new Date().toISOString();
    const angelegt: Dokument[] = [];
    let antragDokumentId: string | undefined;
    for (const x of dokumente) {
      const ref = x.storageRef ? d.resolveStorageRef(x.storageRef) : {};
      const zuordnung = ordneNachweisZu(x.typ, x.identitaet, personen);
      const dok = await d.createDokument({
        vorgangId: vorgang.id,
        typ: x.typ,
        titel: x.titel,
        quelle: x.dateiname,
        istOriginal: false,
        s3Key: ref.s3Key,
        pfad: ref.pfad,
        eingegangenAm,
        extrahierterText: (x.extrahierterTextGekuerzt || '').slice(0, 20000),
        analyse: x.analyse ?? {},
        ...(x.extraktion ? { extraktion: x.extraktion } : {}),
        ...(x.profil ? { profil: x.profil } : {}),
        ...(zuordnung.personId ? { personId: zuordnung.personId } : {}),
        ...(zuordnung.grund === 'unklar' ? { flags: [flagPersonUnklar()] } : {}),
      });
      if (x === antrag) antragDokumentId = dok.id;
      angelegt.push(dok);
    }

    // 5. Feld-Provenienz: übernommene Antragswerte und angelegte Personen sind KI-Vorschläge.
    for (const feldPfad of uebernommenePfade) {
      await d.setFeldStatus({
        vorgangId: vorgang.id, zielTyp: 'vorgang', zielId: vorgang.id, feldPfad,
        quelle: 'llm', bestaetigt: false, quellDokumentId: antragDokumentId, confidence: confByPfad[feldPfad],
      });
    }
    for (const p of neuePersonen) {
      for (const feldPfad of feldStatusPersonPfade(p)) {
        await d.setFeldStatus({
          vorgangId: vorgang.id, zielTyp: 'person', zielId: p.id, feldPfad,
          quelle: 'llm', bestaetigt: false, quellDokumentId: antragDokumentId,
          confidence: p.rolle === 'antragsteller' ? confByPfad[feldPfad] : undefined,
        });
      }
    }

    const viaVorschlag = input.viaVorschlag === true && !istNeuerVorgang && !!input.vorgangId;
    const unklar = angelegt.filter((x) => x.flags?.some((f) => f.code === 'person-unklar')).length;
    await d.audit(c, {
      aktion: viaVorschlag ? 'dokument.zugeordnet' : 'dokument.hochgeladen',
      objektTyp: 'posteingang', objektId: vorgang.id, vorgangId: vorgang.id,
      detail: (viaVorschlag
        ? `${angelegt.length} Dokument(e) per Zuordnungs-Vorschlag zugeordnet (Übereinstimmung: ${input.matchLevel ?? 'unbekannt'})`
        : `${angelegt.length} Dokument(e) aus dem Posteingang zugeordnet${istNeuerVorgang ? ' (neuer Vorgang)' : ''}`)
        + (neuePersonen.length ? `, ${neuePersonen.length} Person(en) aus dem Antrag angelegt` : '')
        + (unklar ? `, ${unklar} ohne eindeutige Person` : '')
        + (updates.ersteingang ? `, Ersteingang ${updates.ersteingang.stelle ? `bei „${updates.ersteingang.stelle}" ` : ''}übernommen` : ''),
    });

    let befundeCount: number | undefined;
    if (input.pruefen !== false) befundeCount = await d.pruefeUndSynchronisiere(vorgang.id);

    return { ok: true, vorgang, akte, dokumente: angelegt, personen: neuePersonen, befundeCount, istNeuerVorgang };
  }

  return { verteileDokumente, ermittleMatchKandidaten };
}

export const standardVerteilung = createVerteilung(standardVerteilungDeps);
