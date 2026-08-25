/**
 * NK-Vorschlags-Engine (Scheibe B) — schlägt für jede Ist-Variable eine Rolle
 * (C/H/T/U) und einen NK-konformen Zielnamen VOR. Vorschlag ≠ Entscheid (D-095):
 * der Kunde übernimmt oder ändert jede Zeile im Explorer; der Vorschlag ist nur
 * der konforme Startpunkt. (Der NK-Experte schreibt diese Zuordnung lokal von Hand;
 * ein Kunde ist kein NK-Experte, deshalb schlägt die App vor.)
 *
 * BEWUSST DEMÜTIG: Die Rolle ist fachlich-semantisch und NICHT zuverlässig aus dem
 * Namen ableitbar (Übungsfall: „Archivordner"→C, „Anlagenordner"→H — beide Pfade,
 * andere Rolle). Nur SICHERE Signale werden genutzt (Kopplung über mehrere Prozesse,
 * bereits-konform, Schnittstelle); alles andere fällt auf den §A3-Safe-Default H_.
 * Namen werden mit denselben Regel-Konstanten konstruiert, gegen die `pruefeNK`
 * prüft (`ROLLE_PREFIX`/`VERWORFEN`/`KATEGORIE_WOERTER`) → per Konstruktion
 * G1/G2/G6-konform. Rein & deterministisch (kein LLM).
 */
import { ROLLE_PREFIX, KATEGORIE_WOERTER, VERWORFEN, NEGATION_WOERTER, type NkRolle, type NkNamensmodul, type VarFundort } from './nk';

export type Konfidenz = 'hoch' | 'mittel' | 'niedrig';

export interface NamensVorschlag {
  alt: string;
  neu: string;
  rolle: NkRolle;
  konfidenz: Konfidenz;
  begruendung: string;
  istKonform: boolean;   // Ist-Name trägt schon ein Kanon-Präfix → vorab „erledigt"
}

export interface VorschlagEingang { name: string; p: string; typ?: string; schnitt?: string; }

const PREFIX_RE = /^(C_|H_|T_)[A-Z][A-Za-z0-9]*$/;   // bereits NK-konform (Präfix vorhanden)
const CONFIG_RE = /schwell|config|konfig|postfach|drucker|vorlage|aufbewahr/i;
const TRACK_RE = /status|ergebnis|erfolg|letzter|lauf|zeit|start/i;

/** PascalCase ohne Trenner; Umlaut-Transliteration; Sonderzeichen-Strip. */
function pascal(ist: string): string {
  const stamm = ist
    .replace(/·.*$/, '').trim()
    .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
    .split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return stamm || 'Wert';
}

/** §A3b: verworfenes Kategorie-Wort am Ende ersetzen (Ordner→Pfad, Nr→Nummer, …). */
function ersetzeVerworfen(stamm: string, verworfen: Record<string, string>): string {
  for (const [bad, gut] of Object.entries(verworfen)) {
    const re = new RegExp(`${bad}$`, 'i');
    if (re.test(stamm)) return stamm.replace(re, gut);
  }
  return stamm;
}

const hatKategorieWort = (stamm: string, kategorie: string[]): boolean => kategorie.some((w) => stamm.endsWith(w));

/**
 * Erzeugt Namensvorschläge für alle Ist-Variablen + ein daraus gebautes
 * `NkNamensmodul` (Startpunkt für `assembleLvar`; Kunden-Overrides werden im
 * Service darübergelegt).
 */
export function schlageNamenVor(
  fundorte: VarFundort[],
  variablen: VorschlagEingang[] = [],
  opts: { verworfen?: Record<string, string>; kategorieWoerter?: string[] } = {},
): { modul: NkNamensmodul; vorschlaege: NamensVorschlag[] } {
  const verworfen = opts.verworfen ?? VERWORFEN;                  // Kunden-Config oder Paket-Standard
  const kategorie = opts.kategorieWoerter ?? KATEGORIE_WOERTER;
  // Ist-Namen deduplizieren; Prozess-Anzahl aus fundorte, Typ/Schnitt aus variablen.
  const prozesseVon = new Map<string, Set<string>>();
  const merke = (name: string, p: string) => {
    if (!prozesseVon.has(name)) prozesseVon.set(name, new Set());
    prozesseVon.get(name)!.add(p);
  };
  for (const f of fundorte) merke(f.name, f.p);
  const metaVon = new Map<string, VorschlagEingang>();
  for (const v of variablen) {
    if (!metaVon.has(v.name)) metaVon.set(v.name, v);
    if (!prozesseVon.has(v.name)) merke(v.name, v.p);   // falls fundorte leer
  }

  const vorschlaege: NamensVorschlag[] = [...prozesseVon.keys()].sort().map((name) => {
    const nProz = prozesseVon.get(name)!.size;
    const schnitt = metaVon.get(name)?.schnitt;

    // (1) bereits NK-konform (Kanon-Präfix vorhanden) → Identität, nichts zu tun.
    if (PREFIX_RE.test(name)) {
      return { alt: name, neu: name, rolle: name.slice(0, 1) as NkRolle, konfidenz: 'hoch', begruendung: 'Ist-Name ist bereits NK-konform.', istKonform: true };
    }

    // (2) Rolle demütig ableiten — nur aus sicheren Signalen.
    let rolle: NkRolle; let konfidenz: Konfidenz; let begruendung: string;
    if (nProz > 1) {
      rolle = 'U'; konfidenz = 'hoch';
      begruendung = `Kommt in ${nProz} Prozessen vor → über Namensgleichheit gekoppelter Fachwert (kein Präfix).`;
    } else if (CONFIG_RE.test(name)) {
      rolle = 'C'; konfidenz = 'mittel';
      begruendung = 'Wirkt wie ein Konfigurationswert → Präfix C_. Bitte prüfen.';
    } else if (schnitt === 'Ausgehend' || schnitt === 'EinAus' || TRACK_RE.test(name)) {
      rolle = 'T'; konfidenz = 'mittel';
      begruendung = 'Geht nach außen / Status → überlebt den Lauf, Präfix T_. Bitte prüfen.';
    } else {
      rolle = 'H'; konfidenz = 'niedrig';
      begruendung = 'Prozesslokale Hilfsvariable — sicherer Standard (§A3). Bitte prüfen.';
    }

    // (3) Namen konstruieren (per Konstruktion G1/G2/G6-konform).
    const stamm = ersetzeVerworfen(pascal(name), verworfen);
    const neu = ROLLE_PREFIX[rolle] + stamm;

    // (4) Weiche Hinweise — senken die Konfidenz, ändern den Namen NICHT (Mensch entscheidet).
    const hinweise: string[] = [];
    if (NEGATION_WOERTER.some((w) => stamm.includes(w))) hinweise.push('Negation vermeiden (§A3b: Ist/Hat/Darf)');
    if (!hatKategorieWort(stamm, kategorie)) hinweise.push('Kategorie-Wort am Ende prüfen (§A3b)');
    if (hinweise.length) { begruendung += ' · ' + hinweise.join(' · '); if (konfidenz === 'hoch') konfidenz = 'mittel'; }

    return { alt: name, neu, rolle, konfidenz, begruendung, istKonform: false };
  });

  const modul: NkNamensmodul = { map: vorschlaege.map((v) => ({ alt: v.alt, neu: v.neu, rolle: v.rolle })) };
  return { modul, vorschlaege };
}
