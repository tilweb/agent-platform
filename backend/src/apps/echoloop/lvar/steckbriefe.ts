/**
 * Prozess-Steckbriefe (Reiter 2) — Ist/Soll-Paar je Prozess.
 *
 * Ableitung nach NK §A9 + Soll-Kaskade:
 *   Typ MP/TP/SP: **MP maschinell** ableitbar (ruft andere auf ∧ wird selbst nicht
 *     gerufen); CFG-Prozess ist immer SP; **TP↔SP ist fachlich und wird NIE geraten**
 *     (bleibt UNENTSCHIEDEN, bis der Mensch entscheidet). Ein gesetzter Typ gewinnt.
 *   Soll-Name: Kaskade **Entschieden > Twin(RGA) > Struktur-Ableitung** (D-095:
 *     der maschinelle Default wird als VORSCHLAG gekennzeichnet, nie als Entscheid).
 *   Kritikalität bleibt leer, wenn nicht belegt (der Mensch stuft ein — ein
 *     vorbefülltes „hoch" wäre eine Behauptung, die niemand aufgestellt hat).
 *
 * Rein & deterministisch (kein LLM). Gegen den Übungsfall kalibriert.
 */

export type ProzessTyp = 'MP' | 'TP' | 'SP';
export type TypQuelle = 'gesetzt' | 'abgeleitet' | 'config' | 'offen';
export type SollQuelle = 'entschieden' | 'twin' | 'vorschlag' | 'offen';

export interface SteckbriefEingang {
  ist: string;
  typGesetzt?: ProzessTyp;            // vom Menschen entschieden (gewinnt)
  istConfig?: boolean;               // CFG-Prozess (Namens-Marker) → immer SP
  sollEntschieden?: string;          // belegt entschiedener Ziel-Name
  sollTwin?: string;                 // aus dem RGA-Twin importiert
  krit?: string;
  kritGrund?: string;
  beschreibung?: string;             // aus der Panel-Beschreibung (EMMA exportiert sie nicht → oft leer)
  ergebnis?: string;
  stand?: string;                    // Prozess-Stand (ISO) für Alt-Stand-Badge
}

export interface SteckbriefInput {
  namensraum?: string;               // z.B. MW
  familie?: string;                  // z.B. ERECH
  prozesse: Record<string, SteckbriefEingang>;
  callGraph: { von: string; nach: string }[];  // aus der Extraktion (aufrufe)
}

export interface Steckbrief {
  nr: string;
  ist: string;
  typ: ProzessTyp | 'UNENTSCHIEDEN';
  typQuelle: TypQuelle;
  soll?: string;
  sollQuelle: SollQuelle;
  krit?: string;
  kritGrund?: string;
  beschreibung?: string;
  beschreibungQuelle: 'belegt' | 'struktur-vorschlag' | 'offen';
  ergebnis?: string;
  aufrufer: string[];                // wer ruft diesen Prozess
  gerufen: string[];                 // wen ruft dieser Prozess
  altStand?: boolean;                // Prozess-Stand älter als das Familien-Maximum
}

const ROLLE_SUFFIX: Record<ProzessTyp, string> = { MP: 'MASTER', TP: 'SUB', SP: 'SUB' };

/** Funktions-Teil eines Soll-Namens aus dem Ist-Namen (ohne Umlaute/Leerzeichen, Bindestrich-Wörter). */
function funktion(ist: string): string {
  return ist
    .replace(/·.*$/, '').trim()                                   // Zusatz hinter „·" abschneiden
    .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
    .split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
    .replace(/[^A-Za-z0-9-]/g, '');
}

export function baueSteckbriefe(input: SteckbriefInput): Steckbrief[] {
  const nrs = Object.keys(input.prozesse);
  const gerufenVon = new Map<string, string[]>();
  const ruft = new Map<string, string[]>();
  for (const { von, nach } of input.callGraph) {
    if (!ruft.has(von)) ruft.set(von, []);
    if (!ruft.get(von)!.includes(nach)) ruft.get(von)!.push(nach);
    if (!gerufenVon.has(nach)) gerufenVon.set(nach, []);
    if (!gerufenVon.get(nach)!.includes(von)) gerufenVon.get(nach)!.push(von);
  }

  // Familien-Maximum der Stände (für Alt-Stand-Badge).
  const staende = nrs.map((nr) => input.prozesse[nr]!.stand).filter(Boolean) as string[];
  const maxStand = staende.length ? staende.slice().sort().at(-1) : undefined;

  const ns = input.namensraum ?? '';
  const fam = input.familie ?? '';

  return nrs.map((nr) => {
    const e = input.prozesse[nr]!;
    const gerufen = ruft.get(nr) ?? [];
    const aufrufer = gerufenVon.get(nr) ?? [];

    // Typ: gesetzt > config(SP) > MP-Ableitung > unentschieden (TP/SP fachlich).
    let typ: Steckbrief['typ'];
    let typQuelle: TypQuelle;
    if (e.typGesetzt) { typ = e.typGesetzt; typQuelle = 'gesetzt'; }
    else if (e.istConfig) { typ = 'SP'; typQuelle = 'config'; }
    else if (gerufen.length > 0 && aufrufer.length === 0) { typ = 'MP'; typQuelle = 'abgeleitet'; }
    else { typ = 'UNENTSCHIEDEN'; typQuelle = 'offen'; }

    // Soll-Kaskade: entschieden > twin > struktur-Ableitung (vorschlag).
    let soll: string | undefined;
    let sollQuelle: SollQuelle;
    if (e.sollEntschieden) { soll = e.sollEntschieden; sollQuelle = 'entschieden'; }
    else if (e.sollTwin) { soll = e.sollTwin; sollQuelle = 'twin'; }
    else if (ns && fam) {
      const suffix = e.istConfig ? 'UTIL' : typ === 'MP' || typ === 'TP' || typ === 'SP' ? ROLLE_SUFFIX[typ] : 'SUB';
      soll = `${ns}_${fam}_${funktion(e.ist)}_${suffix}`;
      sollQuelle = 'vorschlag';                                  // D-095: nur Vorschlag
    } else { sollQuelle = 'offen'; }

    const beschreibungQuelle = e.beschreibung ? 'belegt' : (aufrufer.length || gerufen.length) ? 'struktur-vorschlag' : 'offen';
    const beschreibung = e.beschreibung ?? (beschreibungQuelle === 'struktur-vorschlag'
      ? `Vorschlag aus der Struktur: ${gerufen.length ? `ruft ${gerufen.join(', ')}` : 'ruft nichts'}${aufrufer.length ? `, gerufen von ${aufrufer.join(', ')}` : ''}.`
      : undefined);

    return {
      nr, ist: e.ist, typ, typQuelle, soll, sollQuelle,
      krit: e.krit, kritGrund: e.kritGrund,
      beschreibung, beschreibungQuelle, ergebnis: e.ergebnis,
      aufrufer, gerufen,
      altStand: maxStand && e.stand ? e.stand < maxStand : undefined,
    };
  });
}
