/**
 * Vertragsauswertung P5 — Konsolidierung (deterministisch).
 *
 * Prueft und ergaenzt die Modell-Auswertung gegen den Strukturbaum:
 * Fundstellen normalisieren/verwerfen, Querverweise aufloesen, fehlende
 * Anlagen und Unterschriften, Platzhalter, Gueltigkeitsangaben aus der
 * Transkript-Auszeichnung, Inventar-Dubletten, Fristinformation (ohne
 * Berechnung) und Befunde. Befunde werden nur markiert — kein Workflow.
 */

import type { AuswertungsErgebnis } from './auswertung';
import {
  NICHT_BINDEND,
  type FristRegel, type GueltigkeitsAngabe, type InventarEintrag, type Klausel, type KatalogElement, type KatalogWert, type Querverweis,
  type SeitenTranskript, type VertragsAuswertung, type VertragsBefund, type Verknuepfung,
} from './types';

/** Gesetzesabkuerzungen nach „§ n" — solche Verweise zeigen nicht in den Vertrag. */
const GESETZ = /^\s*(?:Abs(?:atz|\.)?\s*\d+\s*)?(?:S(?:atz|\.)\s*\d+\s*)?(?:Nr\.?\s*\d+\s*)?(?:des\s+|der\s+)?(?:BGB|HGB|ZPO|UStG|EnWG|MsbG|GewO|WEG|WoEigG|SGB|StGB|AO|DSGVO|BDSG|BetrKV|LSV|AFIR|UWG|EEG|EStG|KStG|InsO|GmbHG|AktG|ProdHaftG|HPflG|GEIG|MessEG|MessEV|PAngV|VVG|GWB|TKG|TTDSG|BauGB|BImSchG|KWKG|StromStG|[A-ZÄÖÜ][A-Za-zäöü]{1,10}G|[A-ZÄÖÜ]{2,6})\b/;

const VERWEIS_MUSTER = /(§\s*(\d+[a-z]?)(?:\s*(?:Abs(?:atz|\.)?)\s*(\d+))?)|((?:Ziffer|Ziff\.|Nr\.)\s*(\d+(?:\.\d+)*)(?:\s*(?:Abs(?:atz|\.)?)\s*(\d+))?)|((?:Anlage|Anhang)\s+([A-Z0-9]{1,3})\b)/g;

const nummerVon = (k: Klausel): string | undefined => {
  const m = /^(?:§|Z|Art)(\d+[a-z]?)$/.exec(k.id.replace(/#\d+$/, ''));
  return m?.[1];
};

export interface Aufloeser {
  ids: Set<string>;
  /** „§ 6", „Ziffer 6", „6" → Abschnitts-ID (unabhaengig von § oder Ziffer). */
  abschnitt(nummer: string): string | undefined;
  /** Absatz/Unterpunkt: „6" + „3" → „§6.3"; Dezimal „2.5.3" → „2.5.3". */
  unterpunkt(nummer: string, absatz?: string): string | undefined;
  anlage(kennung: string): string | undefined;
}

export function baueAufloeser(klauseln: Klausel[]): Aufloeser {
  const ids = new Set(klauseln.map((k) => k.id));
  const abschnitte = new Map<string, string>();
  for (const k of klauseln) {
    if (k.ebene !== 1 || NICHT_BINDEND.has(k.rolle)) continue;
    const n = nummerVon(k);
    if (n && !abschnitte.has(n)) abschnitte.set(n, k.id);
  }
  return {
    ids,
    abschnitt: (n) => abschnitte.get(n),
    unterpunkt: (n, abs) => {
      if (n.includes('.')) {
        if (ids.has(n)) return n;
        // „Ziffer 6.2" in einem Vertrag mit Ziffer 6 und unnummerierten/impliziten Absaetzen.
        const [haupt, rest] = [n.split('.')[0]!, n.split('.').slice(1).join('.')];
        const sec = abschnitte.get(haupt);
        return sec && ids.has(`${sec}.${rest}`) ? `${sec}.${rest}` : undefined;
      }
      const sec = abschnitte.get(n);
      if (!sec) return undefined;
      if (!abs) return sec;
      return ids.has(`${sec}.${abs}`) ? `${sec}.${abs}` : undefined;
    },
    anlage: (x) => {
      const id = `Anl${x.toUpperCase()}`;
      return ids.has(id) ? id : undefined;
    },
  };
}

/** Freie Fundstellen-Angabe des Modells („§ 6 Abs. 3", „Ziffer 3", „§6.3") auf eine Baum-ID abbilden. */
export function normalisiereId(roh: string, a: Aufloeser): string | undefined {
  const r = roh.trim().replace(/^\[|\]$/g, '');
  if (a.ids.has(r)) return r;
  const kompakt = r.replace(/\s+/g, '');
  if (a.ids.has(kompakt)) return kompakt;
  let m = /^(?:§|Ziffer|Ziff\.|Z|Art\.?|Artikel)\s*(\d+[a-z]?)(?:\s*(?:Abs(?:atz|\.)?|\.)\s*(\d+))?$/i.exec(r);
  if (m) return a.unterpunkt(m[1]!, m[2]);
  m = /^(\d+(?:\.\d+)+)$/.exec(r);
  if (m) return a.unterpunkt(m[1]!);
  m = /^(?:Anlage|Anhang|Anl\.?)\s*([A-Z0-9]{1,3})$/i.exec(r);
  if (m) return a.anlage(m[1]!);
  return undefined;
}

export function findeVerweise(klauseln: Klausel[], a: Aufloeser): Querverweis[] {
  const out: Querverweis[] = [];
  const gesehen = new Set<string>();
  for (const k of klauseln) {
    if (NICHT_BINDEND.has(k.rolle)) continue;
    for (const m of k.text.matchAll(VERWEIS_MUSTER)) {
      const nach = k.text.slice((m.index ?? 0) + m[0].length);
      let ziel: string | undefined;
      if (m[1]) {
        if (GESETZ.test(nach)) continue;
        ziel = a.unterpunkt(m[2]!, m[3]);
      } else if (m[4]) {
        if (/^Nr\./.test(m[4]) && !/\d\.\d/.test(m[5]!)) continue; // „Nr. 3" in Aufzaehlungen ist meist kein Vertragsverweis
        ziel = a.unterpunkt(m[5]!, m[6]);
      } else if (m[7]) {
        ziel = a.anlage(m[8]!);
      }
      const text = m[0].replace(/\s+/g, ' ').trim();
      const schluessel = `${k.id}|${text}`;
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      // Selbstbezug eines Abschnitts auf seine eigene Nummer ohne Absatz ist kein Verweis.
      if (ziel && (ziel === k.id || ziel === k.eltern) && !m[3] && !m[6]) continue;
      out.push({ von: k.id, text, ...(ziel ? { ziel } : {}) });
    }
  }
  return out;
}

/** Gueltigkeitsangaben aus der Transkript-Auszeichnung je Klausel. */
export function findeGueltigkeit(klauseln: Klausel[]): GueltigkeitsAngabe[] {
  const out: GueltigkeitsAngabe[] = [];
  for (const k of klauseln) {
    for (const m of k.text.matchAll(/~~([^~]+)~~/g)) out.push({ art: 'gestrichen', text: m[1]!.trim(), klausel: k.id });
    for (const zeile of k.text.split('\n')) {
      const m = /^\s*(?:[-*]\s*)?\[ \]\s*(.+)$/.exec(zeile);
      if (m) out.push({ art: 'nicht_angekreuzt', text: m[1]!.trim().slice(0, 300), klausel: k.id });
    }
    for (const m of k.text.matchAll(/\{\{hs:\s*([^}]*)\}\}/g)) if (m[1]!.trim()) out.push({ art: 'handschriftlich', text: m[1]!.trim(), klausel: k.id });
  }
  return out;
}

const PLATZHALTER = [/\bX{3,}\b/, /\b\d+\.X\b/, /\[\s*\.{0,3}\s*\]/, /<[^>]{0,20}einfügen[^>]*>/i];

export function findePlatzhalter(klauseln: Klausel[]): VertragsBefund[] {
  const out: VertragsBefund[] = [];
  for (const k of klauseln) {
    if (NICHT_BINDEND.has(k.rolle) || k.id === 'unterschriften' || k.rolle === 'unterschriften') continue;
    // Ankreuzfelder „[ ]" sind Optionen, keine Platzhalter.
    const text = k.text.replace(/^\s*(?:[-*]\s*)?\[[ x]\]/gim, '');
    const treffer = PLATZHALTER.map((re) => re.exec(text)?.[0]).filter(Boolean);
    if (treffer.length) out.push({ typ: 'platzhalter', text: `Platzhalter nicht ausgefüllt: ${treffer.join(', ')}`, klauseln: [k.id] });
  }
  return out;
}

const normInhalt = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim().slice(0, 90);

export function dedupliziereInventar(eintraege: InventarEintrag[]): InventarEintrag[] {
  const gesehen = new Map<string, InventarEintrag>();
  for (const e of eintraege) {
    const key = `${e.typ}|${[...e.klauseln].sort().join(',')}|${normInhalt(e.inhalt)}`;
    if (!gesehen.has(key)) gesehen.set(key, e);
  }
  return [...gesehen.values()];
}

function fundstellenPruefen(ids: string[], a: Aufloeser, verworfen: Set<string>): string[] {
  const out: string[] = [];
  for (const roh of ids) {
    const id = normalisiereId(roh, a);
    if (id) { if (!out.includes(id)) out.push(id); } else verworfen.add(roh);
  }
  return out;
}

function fristenAus(katalog: Partial<Record<KatalogElement, KatalogWert>>, inventar: InventarEintrag[]): FristRegel[] {
  const out: FristRegel[] = [];
  const k = katalog.kuendigung;
  const frist = (k?.wert as { frist?: Record<string, unknown>; form?: string } | null)?.frist;
  if (k && k.status !== 'nicht_geregelt' && frist && (frist.dauer != null || frist.wortlaut)) {
    out.push({
      art: 'ordentliche Kündigung',
      ...(frist as object),
      wortlaut: String(frist.wortlaut ?? ''),
      ...((k.wert as { form?: string }).form ? { form: (k.wert as { form?: string }).form } : {}),
      klauseln: k.klauseln,
    } as FristRegel);
  }
  for (const e of inventar) {
    if (!e.frist) continue;
    out.push({ art: e.inhalt, partei: e.partei, ...e.frist, klauseln: e.klauseln });
  }
  return out;
}

function verknuepfungenAus(modell: Verknuepfung[], klauseln: Klausel[]): Verknuepfung[] {
  const out = [...modell];
  const kopf = klauseln.filter((k) => k.id === 'rubrum' || k.ebene === 1).slice(0, 3);
  for (const k of kopf) {
    for (const m of k.text.matchAll(/(Vertrags|Kunden)[-\s]?(?:Nr\.?|nummer)\s*:?\s*([A-Z0-9][\w\-/]{2,})/gi)) {
      const art = m[1]!.toLowerCase().startsWith('vertrag') ? 'vertragsnummer' : 'kundennummer';
      if (!out.some((v) => v.wert === m[2])) out.push({ art, wert: m[2]!, klausel: k.id });
    }
  }
  return out;
}

export function konsolidiere(seiten: SeitenTranskript[], klauseln: Klausel[], aw: AuswertungsErgebnis): {
  vertrag: VertragsAuswertung; erweiterung: AuswertungsErgebnis['erweiterung'];
} {
  const a = baueAufloeser(klauseln);
  const verworfen = new Set<string>();
  const befunde: VertragsBefund[] = [];

  // Fundstellen normalisieren
  const katalog: Partial<Record<KatalogElement, KatalogWert>> = {};
  for (const [el, w] of Object.entries(aw.katalog) as Array<[KatalogElement, KatalogWert]>) {
    katalog[el] = { ...w, klauseln: fundstellenPruefen(w.klauseln, a, verworfen) };
  }
  const inventar = dedupliziereInventar(aw.inventar.map((e) => ({ ...e, klauseln: fundstellenPruefen(e.klauseln, a, verworfen) })));
  const erweiterung = {
    data: aw.erweiterung.data,
    fundstellen: Object.fromEntries(Object.entries(aw.erweiterung.fundstellen).map(([id, ids]) => [id, fundstellenPruefen(ids, a, verworfen)])),
  };

  // Querverweise + fehlende Anlagen
  const verweise = findeVerweise(klauseln, a);
  const fehlendeAnlagen = new Map<string, string[]>();
  for (const v of verweise) {
    if (v.ziel) continue;
    const anl = /^(?:Anlage|Anhang)\s+(\S+)/.exec(v.text);
    if (anl) {
      const key = `Anlage ${anl[1]}`;
      fehlendeAnlagen.set(key, [...(fehlendeAnlagen.get(key) ?? []), v.von]);
    } else {
      befunde.push({ typ: 'verweis_ins_leere', text: `Verweis „${v.text}" zeigt auf keinen vorhandenen Abschnitt/Absatz.`, klauseln: [v.von] });
    }
  }
  // Anlagenliste des Modells an der Struktur pruefen (vorhanden = Anlage steht im Dokument).
  const anlagenWert = katalog.anlagen?.wert;
  if (Array.isArray(anlagenWert)) {
    katalog.anlagen = {
      ...katalog.anlagen!,
      wert: anlagenWert.map((x) => {
        const bez = String((x as { bezeichnung?: string }).bezeichnung ?? '');
        const kennung = /(?:Anlage|Anhang)\s+([A-Z0-9]{1,3})\b/i.exec(bez)?.[1];
        const vorhanden = kennung ? !!a.anlage(kennung) : !!(x as { vorhanden?: boolean }).vorhanden;
        if (!vorhanden && kennung && !fehlendeAnlagen.has(`Anlage ${kennung.toUpperCase()}`)) fehlendeAnlagen.set(`Anlage ${kennung.toUpperCase()}`, katalog.anlagen!.klauseln);
        return { ...(x as object), vorhanden };
      }),
    };
  }
  for (const [anl, von] of fehlendeAnlagen) {
    befunde.push({ typ: 'anlage_fehlt', text: `${anl} wird referenziert, ist aber nicht im Dokument enthalten.`, klauseln: [...new Set(von)] });
  }

  // Unterschriften
  const unterschriften = katalog.unterschriften?.wert;
  if (Array.isArray(unterschriften)) {
    for (const u of unterschriften as Array<{ partei?: string; vorhanden?: boolean }>) {
      if (u.vorhanden === false) befunde.push({ typ: 'unterschrift_fehlt', text: `Unterschrift fehlt: ${u.partei ?? 'unbekannte Partei'}.`, klauseln: katalog.unterschriften!.klauseln });
    }
  }

  befunde.push(...findePlatzhalter(klauseln));
  for (const x of aw.auffaelligkeiten) befunde.push({ typ: 'widerspruch', text: x.text, klauseln: fundstellenPruefen(x.klauseln, a, verworfen) });
  for (const p of aw.probleme) befunde.push({ typ: 'verarbeitung', text: p, klauseln: [] });
  if (verworfen.size) befunde.push({ typ: 'verarbeitung', text: `Unbekannte Fundstellen verworfen: ${[...verworfen].slice(0, 10).join(', ')}`, klauseln: [] });
  for (const s of seiten.filter((x) => x.fehler)) befunde.push({ typ: 'verarbeitung', text: `Seite ${s.seite} konnte nicht gelesen werden (${s.fehler}).`, klauseln: [] });

  return {
    vertrag: {
      version: 1,
      seiten: seiten.map((s) => ({ seite: s.seite, rolle: s.rolle })),
      klauseln,
      gueltigkeit: findeGueltigkeit(klauseln),
      katalog,
      inventar,
      fristen: fristenAus(katalog, inventar),
      verknuepfungen: verknuepfungenAus(aw.verknuepfungen, klauseln),
      verweise,
      befunde,
    },
    erweiterung,
  };
}
