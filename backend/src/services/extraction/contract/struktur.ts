/**
 * Vertragsauswertung P3 — Klausel-Strukturbaum (deterministisch).
 *
 * Eingabe sind die Seiten-Transkripte (P2), Ausgabe der Baum aus Abschnitten
 * (§ / Ziffer / Artikel / Anlage / ##-Kopf) und deren Absaetzen bzw.
 * Dezimal-Unterpunkten mit stabilen IDs. Seiten werden VOR dem Parsen
 * verkettet — ein Absatz, der ueber eine Seitengrenze laeuft, bleibt eine
 * Klausel mit Seitenbereich [n, n+1] und behaelt seinen Paragraphentitel.
 *
 * Unnummerierte Absaetze bekommen implizite Nummern, damit Verweise wie
 * „Ziffer 8 Abs. 3" aufloesbar sind, obwohl der Vertrag sie nicht nummeriert.
 */

import { NICHT_BINDEND, type Klausel, type SeitenRolle, type SeitenTranskript } from './types';

interface Zeile {
  text: string;
  seite: number;
  rolle: SeitenRolle;
  /** Erste Zeile einer Seite (fuer Seitenrollen-Wurzeln). */
  seitenstart?: boolean;
}

type KopfArt = 'paragraph' | 'ziffer' | 'artikel' | 'anlage' | 'praeambel' | 'allgemein';

interface Kopf {
  art: KopfArt;
  nummer?: string;
  titel?: string;
}

const SATZENDE = /[.:;!?)"“”]$/;
/** Beginn eines Unterschriftsblocks. */
const SIGNATUR = /\{\{(?:unterschrift|stempel):|^\s*(?:Ort,?\s*(?:und\s*)?Datum|Datum,?\s*Ort|Unterschrift(?:en)?\b)|^\s*\**(?:Auftraggeber|Auftragnehmer|Kunde|Mieter|Nutzer|Vermieter|Betreiber|END)\**\s*:?\s*\**$/i;

/** Markdown-Kopf- und Fett-Auszeichnung entfernen. */
function ohneAuszeichnung(zeile: string): { text: string; markiert: boolean } {
  const m = /^\s*(#{1,6})\s+(.*)$/.exec(zeile);
  const text = (m ? m[2]! : zeile).replace(/^\*\*(.*)\*\*$/, '$1').replace(/\*\*/g, '').trim();
  return { text, markiert: !!m };
}

/**
 * Erkennt einen Abschnittskopf. `##`-markierte Zeilen sind immer Koepfe;
 * unmarkierte nur bei eindeutigen Mustern (§ n, Ziffer n, Artikel n) bzw.
 * bei kurzen Anlage-/Praeambel-Zeilen.
 */
export function erkenneKopf(rohzeile: string, kontext: { rolle?: SeitenRolle; seitenstart?: boolean } = {}): Kopf | null {
  const { text, markiert } = ohneAuszeichnung(rohzeile);
  if (!text) return null;
  const kurz = text.length <= 90 && !/[.;]$/.test(text.replace(/\s*\(.*\)$/, ''));

  let m = /^§\s*(\d+[a-z]?)\.?\s*(.*)$/i.exec(text);
  if (m) {
    // „§ 6 Abs. 3 …" am Zeilenanfang ist ein Verweis im Fliesstext, kein Kopf.
    if (/^Abs(atz|\.)/i.test(m[2]!.trim()) && !markiert) return null;
    if (!markiert && !kurz) return null;
    return { art: 'paragraph', nummer: m[1], titel: m[2]!.trim() || undefined };
  }
  m = /^(?:Ziffer|Ziff\.)\s*(\d+)\.?\s*[:.\-–]?\s*(.*)$/i.exec(text);
  if (m && (markiert || kurz)) return { art: 'ziffer', nummer: m[1], titel: m[2]!.trim() || undefined };
  // Nummerierte Ueberschrift „## 3. Stromversorgung" (nur markiert — unmarkiert ist es ein Absatz) = Ziffer.
  m = /^(\d{1,2})\.?\s+([A-ZÄÖÜ].*)$/.exec(text);
  if (m && markiert && kurz) return { art: 'ziffer', nummer: m[1], titel: m[2]!.trim() };
  m = /^(?:Artikel|Art\.)\s*(\d+)\.?\s*[:.\-–]?\s*(.*)$/i.exec(text);
  if (m && (markiert || kurz)) return { art: 'artikel', nummer: m[1], titel: m[2]!.trim() || undefined };
  m = /^(?:Anlage|Anhang)\s+([A-Z0-9]{1,4})\b\s*[:.\-–]?\s*(.*)$/i.exec(text);
  if (m && (markiert || (kurz && (kontext.rolle === 'anlage' || kontext.seitenstart)))) {
    return { art: 'anlage', nummer: m[1]!.toUpperCase(), titel: m[2]!.trim() || undefined };
  }
  if (/^(Präambel|Praeambel|Vorbemerkung(en)?)\b/i.test(text) && (markiert || kurz)) {
    return { art: 'praeambel', titel: text.replace(/[:.]$/, '') };
  }
  if (markiert) return { art: 'allgemein', titel: text.replace(/[:.]$/, '') };
  return null;
}

/** Absatz-/Unterpunkt-Nummer am Zeilenanfang. */
function erkenneAbsatz(zeile: string): { nummer: string; dezimal: boolean; rest: string } | null {
  const t = zeile.replace(/^\*\*/, '').trim();
  let m = /^(\d+(?:\.\d+)+)\.?\s+(.*)$/.exec(t);
  if (m) return { nummer: m[1]!, dezimal: true, rest: m[2]! };
  m = /^\((\d+)\)\s*(.*)$/.exec(t);
  if (m) return { nummer: m[1]!, dezimal: false, rest: m[2]! };
  m = /^(\d+)\.\s+(.*)$/.exec(t);
  if (m) return { nummer: m[1]!, dezimal: false, rest: m[2]! };
  m = /^Abs(?:atz|\.)\s*(\d+)\s*[:.]?\s*(.*)$/i.exec(t);
  if (m) return { nummer: m[1]!, dezimal: false, rest: m[2]! };
  return null;
}

/** Seiten zu einer Zeilenfolge verketten; Seitengrenze mitten im Satz ohne Leerzeile. */
function verkette(seiten: SeitenTranskript[]): Zeile[] {
  const zeilen: Zeile[] = [];
  for (const s of [...seiten].sort((a, b) => a.seite - b.seite)) {
    if (s.rolle === 'leer' || s.fehler || !s.text.trim()) continue;
    const eigene = s.text.replace(/\r/g, '').split('\n');
    while (eigene.length && !eigene[0]!.trim()) eigene.shift();
    while (eigene.length && !eigene[eigene.length - 1]!.trim()) eigene.pop();
    const letzte = [...zeilen].reverse().find((z) => z.text.trim());
    const erste = eigene[0]?.trim() ?? '';
    const fortsetzung = letzte && letzte.rolle === s.rolle && !SATZENDE.test(letzte.text.trim()) && !erkenneKopf(erste) && !erkenneAbsatz(erste);
    if (zeilen.length && !fortsetzung) zeilen.push({ text: '', seite: s.seite, rolle: s.rolle });
    eigene.forEach((text, i) => zeilen.push({ text, seite: s.seite, rolle: s.rolle, ...(i === 0 ? { seitenstart: true } : {}) }));
  }
  return zeilen;
}

interface Rohabschnitt {
  kopf: Kopf | { art: 'rubrum' | 'unterschriften' | 'seite'; titel?: string; nummer?: string };
  rolle: SeitenRolle;
  zeilen: Zeile[];
}

function abschnittsId(k: Rohabschnitt['kopf'], laufnummer: number, erstSeite: number): string {
  switch (k.art) {
    case 'paragraph': return `§${k.nummer}`;
    case 'ziffer': return `Z${k.nummer}`;
    case 'artikel': return `Art${k.nummer}`;
    case 'anlage': return `Anl${k.nummer}`;
    case 'praeambel': return 'praeambel';
    case 'rubrum': return 'rubrum';
    case 'unterschriften': return 'unterschriften';
    case 'seite': return `S${erstSeite}`;
    default: return `A${laufnummer}`;
  }
}

function anzeigeNummer(k: Rohabschnitt['kopf']): string | undefined {
  switch (k.art) {
    case 'paragraph': return `§ ${k.nummer}`;
    case 'ziffer': return `Ziffer ${k.nummer}`;
    case 'artikel': return `Artikel ${k.nummer}`;
    case 'anlage': return `Anlage ${k.nummer}`;
    default: return undefined;
  }
}

const ROLLEN_TITEL: Partial<Record<SeitenRolle, string>> = {
  muster: 'Muster', vorlage: 'Vorlage', datenblatt: 'Datenblatt', mandat: 'Mandat', unterschriften: 'Unterschriften', sonstiges: 'Sonstiges',
};

const blockText = (zs: Zeile[]) => zs.map((z) => z.text).join('\n').replace(/\n{3,}/g, '\n\n').trim();
const seitenVon = (zs: Zeile[], fallback: number): [number, number] => {
  const mit = zs.filter((z) => z.text.trim());
  return mit.length ? [mit[0]!.seite, mit[mit.length - 1]!.seite] : [fallback, fallback];
};

/** Zerlegt die verkettete Zeilenfolge in Rohabschnitte. */
function inAbschnitte(zeilen: Zeile[]): Rohabschnitt[] {
  const abschnitte: Rohabschnitt[] = [];
  let aktuell: Rohabschnitt = { kopf: { art: 'rubrum', titel: 'Rubrum' }, rolle: zeilen[0]?.rolle ?? 'vertragstext', zeilen: [] };
  // Je Zeile: folgt auf derselben Seite noch ein Abschnittskopf? (dann beginnt hier kein Unterschriftsblock)
  const kopfFolgtAufSeite: boolean[] = new Array(zeilen.length).fill(false);
  for (let i = zeilen.length - 2; i >= 0; i--) {
    const naechste = zeilen[i + 1]!;
    kopfFolgtAufSeite[i] = naechste.seite === zeilen[i]!.seite && (kopfFolgtAufSeite[i + 1]! || (!!naechste.text.trim() && !!erkenneKopf(naechste.text, { rolle: naechste.rolle })));
  }
  const neu = (kopf: Rohabschnitt['kopf'], z: Zeile) => {
    abschnitte.push(aktuell);
    aktuell = { kopf, rolle: z.rolle, zeilen: [] };
  };
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!;
    const kopf = z.text.trim() ? erkenneKopf(z.text, { rolle: z.rolle, seitenstart: z.seitenstart }) : null;
    if (kopf) {
      // Kopf ohne Titel: naechste kurze Zeile ohne Nummer ist der Titel.
      if (!kopf.titel && kopf.art !== 'allgemein') {
        const naechste = zeilen.slice(i + 1).find((x) => x.text.trim());
        const kandidat = naechste?.text.trim().replace(/\*\*/g, '') ?? '';
        if (naechste && kandidat.length <= 80 && !erkenneAbsatz(kandidat) && !erkenneKopf(kandidat) && !SATZENDE.test(kandidat)) {
          kopf.titel = kandidat.replace(/^#+\s*/, '');
          naechste.text = '';
        }
      }
      const gefuellt = aktuell.zeilen.filter((x) => x.text.trim()).length;
      // Wiederholter Kopf am Seitenanfang (gleiche Nummer wie der laufende Abschnitt) = Fortsetzung.
      if (z.seitenstart && kopf.nummer && 'nummer' in aktuell.kopf && aktuell.kopf.nummer === kopf.nummer && aktuell.kopf.art !== 'anlage') continue;
      // „Anlage 2"-Stempel auf dem Deckblatt kennzeichnet DIESES Dokument als Anlage eines anderen Vertrags.
      if (kopf.art === 'anlage' && aktuell.kopf.art === 'rubrum' && z.rolle === 'deckblatt') {
        aktuell.zeilen.push(z);
        continue;
      }
      // Dokumenttitel („## Wartungsvertrag") gehoert zum Rubrum, ist kein Abschnitt.
      if (kopf.art === 'allgemein' && aktuell.kopf.art === 'rubrum' && gefuellt < 3) {
        if (!aktuell.kopf.titel || aktuell.kopf.titel === 'Rubrum') aktuell.kopf.titel = kopf.titel;
        aktuell.zeilen.push(z);
        continue;
      }
      // Ueberschriften auf nicht bindenden Seiten (Mandat, Muster …) gliedern nur innerhalb der Seitenwurzel.
      if (kopf.art === 'allgemein' && NICHT_BINDEND.has(z.rolle)) {
        if (aktuell.rolle === z.rolle && aktuell.kopf.art === 'seite') aktuell.zeilen.push(z);
        else neu({ art: 'seite', titel: kopf.titel }, z);
        continue;
      }
      neu(kopf, z);
      continue;
    }
    // Unterschriftsblock: beginnt an der ersten Unterschriftszeile nach dem letzten Kopf der Seite —
    // davor stehender Fliesstext (Fortsetzung des letzten Abschnitts) bleibt in seinem Abschnitt.
    if (z.rolle === 'unterschriften' && aktuell.kopf.art !== 'unterschriften' && SIGNATUR.test(z.text) && !kopfFolgtAufSeite[i]) {
      neu({ art: 'unterschriften', titel: 'Unterschriften' }, z);
    } else if (z.seitenstart && z.rolle !== aktuell.rolle) {
      // Seitenrollen ohne eigenen Kopf: nicht bindende Seiten werden eigene Wurzeln.
      if (NICHT_BINDEND.has(z.rolle)) {
        neu({ art: 'seite', titel: ROLLEN_TITEL[z.rolle] }, z);
      } else if (NICHT_BINDEND.has(aktuell.rolle) || aktuell.kopf.art === 'unterschriften') {
        neu(z.rolle === 'unterschriften' ? { art: 'unterschriften', titel: 'Unterschriften' } : { art: 'seite', titel: ROLLEN_TITEL[z.rolle] ?? 'Fortsetzung' }, z);
      }
    }
    aktuell.zeilen.push(z);
  }
  abschnitte.push(aktuell);
  return abschnitte.filter((a) => a.kopf.art !== 'rubrum' || a.zeilen.some((z) => z.text.trim()));
}

/** Absaetze/Unterpunkte eines Abschnitts. */
function inAbsaetze(zeilen: Zeile[], implizitErlaubt = true): { intro: Zeile[]; teile: Array<{ nummer: string; dezimal: boolean; implizit: boolean; zeilen: Zeile[] }> } {
  const intro: Zeile[] = [];
  const teile: Array<{ nummer: string; dezimal: boolean; implizit: boolean; zeilen: Zeile[] }> = [];
  for (const z of zeilen) {
    const abs = z.text.trim() ? erkenneAbsatz(z.text) : null;
    if (abs) {
      teile.push({ nummer: abs.nummer, dezimal: abs.dezimal, implizit: false, zeilen: [z] });
      continue;
    }
    (teile.length ? teile[teile.length - 1]!.zeilen : intro).push(z);
  }
  if (teile.length || !implizitErlaubt) return { intro, teile };
  // Keine Nummern: Leerzeilen-Bloecke werden implizite Absaetze (nur wenn > 1 Block).
  const bloecke: Zeile[][] = [];
  let block: Zeile[] = [];
  for (const z of intro) {
    if (!z.text.trim()) {
      if (block.length) bloecke.push(block);
      block = [];
    } else block.push(z);
  }
  if (block.length) bloecke.push(block);
  if (bloecke.length <= 1) return { intro, teile: [] };
  return { intro: [], teile: bloecke.map((zs, i) => ({ nummer: String(i + 1), dezimal: false, implizit: true, zeilen: zs })) };
}

/**
 * Baut den Klausel-Strukturbaum aus den Seiten-Transkripten.
 * Reihenfolge der Ausgabe = Dokumentreihenfolge (Abschnitt vor seinen Absaetzen).
 */
export function baueStruktur(seiten: SeitenTranskript[]): Klausel[] {
  const zeilen = verkette(seiten);
  if (!zeilen.length) return [];
  const klauseln: Klausel[] = [];
  const vergeben = new Map<string, number>();
  const eindeutig = (id: string) => {
    const n = (vergeben.get(id) ?? 0) + 1;
    vergeben.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  };

  let laufnummer = 0;
  for (const a of inAbschnitte(zeilen)) {
    if (a.kopf.art === 'allgemein') laufnummer += 1;
    const erstSeite = a.zeilen.find((z) => z.text.trim())?.seite ?? a.zeilen[0]?.seite ?? 1;
    const id = eindeutig(abschnittsId(a.kopf, laufnummer, erstSeite));
    const nummer = anzeigeNummer(a.kopf);
    const label = [nummer, a.kopf.titel].filter(Boolean).join(' ') || id;
    const inAnlage = a.kopf.art === 'anlage';
    // Rubrum/Unterschriften/Seitenwurzeln: kein Absatz-Parsing (Adressbloecke sind keine Absaetze).
    const strukturiert = !['rubrum', 'unterschriften', 'seite'].includes(a.kopf.art);
    // Implizite Absatznummern nur im Vertragstext — Anlagen (Tabellen) und nicht bindende Seiten nicht zerlegen.
    const implizitErlaubt = a.kopf.art !== 'anlage' && !NICHT_BINDEND.has(a.rolle);
    const { intro, teile } = strukturiert ? inAbsaetze(a.zeilen, implizitErlaubt) : { intro: a.zeilen, teile: [] };
    const alle = a.zeilen;
    klauseln.push({
      id, ebene: 1, nummer, titel: a.kopf.titel, titelpfad: [label], text: blockText(intro),
      seiten: seitenVon(alle, erstSeite), rolle: a.rolle,
      ...(/definition|begriffsbestimmung|begriffe/i.test(a.kopf.titel ?? '') ? { definitionen: true } : {}),
    });

    const dezimalIds = new Map<string, string>();
    for (const t of teile) {
      let kid: string;
      let ebene = 2;
      let eltern = id;
      if (t.dezimal) {
        const stellen = t.nummer.split('.');
        ebene = stellen.length;
        const elternNummer = stellen.slice(0, -1).join('.');
        eltern = dezimalIds.get(elternNummer) ?? id;
        kid = eindeutig(inAnlage ? `${id}:${t.nummer}` : t.nummer);
        dezimalIds.set(t.nummer, kid);
      } else {
        kid = eindeutig(`${id}.${t.nummer}`);
      }
      const elternLabel = klauseln.find((k) => k.id === eltern)?.titelpfad ?? [label];
      const eigenerTitel = t.dezimal ? `Ziffer ${t.nummer}` : `Abs. ${t.nummer}`;
      klauseln.push({
        id: kid, ebene, nummer: t.nummer, ...(t.implizit ? { implizit: true } : {}),
        titelpfad: [...elternLabel, eigenerTitel],
        text: blockText(t.zeilen).replace(/^\(?\d+(?:\.\d+)*[.)]?\s+/, ''),
        seiten: seitenVon(t.zeilen, erstSeite), rolle: t.zeilen.find((z) => z.text.trim())?.rolle ?? a.rolle, eltern,
      });
    }
  }
  return klauseln;
}

/** Klauseln als Modell-Eingabe: `[ID] Titelpfad (S. n): Text`. */
export function klauselnAlsText(klauseln: Klausel[]): string {
  return klauseln
    .filter((k) => k.text.trim() || k.ebene === 1)
    .map((k) => {
      const seiten = k.seiten[0] === k.seiten[1] ? `S. ${k.seiten[0]}` : `S. ${k.seiten[0]}–${k.seiten[1]}`;
      return `[${k.id}] ${k.titelpfad.join(' › ')} (${seiten})${k.text.trim() ? `\n${k.text.trim()}` : ''}`;
    })
    .join('\n\n');
}
