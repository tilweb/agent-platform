/**
 * Parser fuer EMMA-Studio-Prozess-Exporte.
 *
 * Eingabe: der Text aus `pdftotext -layout <Prozess_NNNN.pdf>` (bewahrt die
 * `Key:Value`-Schritt-Eigenschaften, die der Checker braucht).
 *
 * Strategie: Seiten-Chrome entfernen → Schritt-Bloecke ueber die fuehrende
 * kleine Schritt-ID abgrenzen → je Block bekannte Keys extrahieren
 * (TestCaseID, MaxLoopCount, ResetBeforeStart, Subject, TimeOut, ...).
 * Positions-/Spalten-unabhaengig, damit Export-Drift den Checker nicht bricht.
 */
import type { EmmaProcess, EmmaFamily, EmmaLoop, EmmaOcrRead, EmmaCall, EmmaVariable, EmmaFixedWait, EmmaFixedClick, EmmaKeyTippen } from './types';

/** Seiten-Kopf/-Fuss + Tabellen-Header entfernen. */
function stripChrome(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^Prozess\s+\d+:.*emma@ottrobotics/i.test(t)) return false; // laufender Seitenkopf
      if (/emma@ottrobotics\s*$/.test(t) && /Prozess\s+\d+:/i.test(t)) return false;
      if (/^Seite\s+\d+\s*\/\s*\d+/i.test(t)) return false;           // Seitenzahl-Zeile
      if (/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(t)) return false; // Footer-Datum
      if (/^Informationen zum Schritt$/i.test(t)) return false;
      if (/^ID\s+Typ\s+Name\s+Kommentar/i.test(t)) return false;      // Schritt-Tabellenkopf
      return true;
    });
}

const STEP_START = /^\s{0,4}(\d{1,3})\s{2,}(\S.*)$/;
const VAR_HEADER = /^\s*ID\s+Name\s+Typ\s+Initial\w*\s+Wert\s+Schnittstelle/i;
const VAR_ROW = /^\s*(\d{3,})\s+(.+?)\s{2,}(int|bool|Text|text|string|Datum|Timer|Dezimal|Passwort|Ganzzahl)\s+(\S*)\s+(Privat|Eingehend|Ausgehend|EinAus|\S+)\s*$/;

/** Extrahiert alle Vorkommen eines Keys aus einem Block. */
function allValues(block: string, key: string): string[] {
  const re = new RegExp(`${key}:\\s*([^\\n]*)`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push((m[1] ?? '').trim());
  return out;
}
function firstValue(block: string, key: string): string | null {
  const v = allValues(block, key);
  return v[0] ?? null;
}

function parseBool(v: string | null): boolean | null {
  if (v == null) return null;
  if (/^true/i.test(v)) return true;
  if (/^false/i.test(v)) return false;
  return null;
}

/** Standalone-Koordinate X:/Y: lesen — matcht NICHT das X in "OffsetX:". */
function coord(block: string, key: 'X' | 'Y'): number | null {
  const m = block.match(new RegExp(`(?:^|\\s)${key}:\\s*(-?\\d+)`, 'm'));
  return m ? Number(m[1]) : null;
}

export function parseProcess(sourceFile: string, text: string): EmmaProcess {
  const lines = stripChrome(text);

  // Prozessnummer + Name
  let nr = '';
  let name = '';
  const fileNr = sourceFile.match(/Prozess[_\s]*(\d+)/i);
  for (const l of lines) {
    const m = l.trim().match(/^Prozess\s+(\d+)\b/i);
    if (m) { nr = m[1] ?? ''; break; }
  }
  if (!nr && fileNr) nr = fileNr[1] ?? '';
  // Name: erste Zeile die nicht "Prozess NNNN" ist
  for (const l of lines) {
    const t = l.trim();
    if (/^Prozess\s+\d+/i.test(t)) continue;
    if (t.length > 2) { name = t.replace(/\s*\(\d{2}\.\d{2}\.\d{4}.*\)\s*$/, '').trim(); break; }
  }

  // In Schritt-Bloecke + Variablen-Sektion splitten
  const stepBlocks: { id: number; text: string }[] = [];
  const variables: EmmaVariable[] = [];
  let inVars = false;
  let cur: { id: number; text: string } | null = null;

  for (const line of lines) {
    if (VAR_HEADER.test(line)) { inVars = true; if (cur) { stepBlocks.push(cur); cur = null; } continue; }
    if (inVars) {
      const vm = line.match(VAR_ROW);
      if (vm) variables.push({ varId: vm[1] ?? '', name: (vm[2] ?? '').trim(), typ: vm[3] ?? '', init: vm[4] ?? '', schnittstelle: (vm[5] ?? '').trim() });
      continue;
    }
    const sm = line.match(STEP_START);
    if (sm) {
      if (cur) stepBlocks.push(cur);
      cur = { id: Number(sm[1]), text: (sm[2] ?? '') + '\n' };
    } else if (cur) {
      cur.text += line + '\n';
    }
  }
  if (cur) stepBlocks.push(cur);

  // Aus den Bloecken Bausteine extrahieren (dedupe je Schritt-ID)
  const loops = new Map<number, EmmaLoop>();
  const ocrReads = new Map<number, EmmaOcrRead>();
  const fixedWaits = new Map<number, EmmaFixedWait>();
  const fixedClicks = new Map<number, EmmaFixedClick>();
  const keyTippen = new Map<number, EmmaKeyTippen>();
  const calls: EmmaCall[] = [];
  const seenCall = new Set<string>();
  const dateLiterals = new Set<string>();
  const hardcodedPaths = new Set<string>();
  let hasPlaintextPassword = false;

  for (const b of stepBlocks) {
    const nameHint = (b.text.split('\n')[0] ?? '').replace(/\s{2,}.*$/, '').trim();

    // Schleife
    const maxRaw = firstValue(b.text, 'MaxLoopCount');
    if (maxRaw !== null && !loops.has(b.id)) {
      const maxIstLiteral = /^\d+$/.test(maxRaw);
      loops.set(b.id, {
        schrittId: b.id,
        maxLoopCount: maxRaw,
        maxIstLiteral,
        resetBeforeStart: parseBool(firstValue(b.text, 'ResetBeforeStart')),
        resetOnMax: parseBool(firstValue(b.text, 'ResetOnMax')),
        zaehlerVariabel: /Schleife:V:/i.test(b.text) || /\{CV:/i.test(maxRaw),
        nameHint,
      });
    }

    // OCR-Reads (Subject:Text / Subject:RegEx)
    for (const subj of allValues(b.text, 'Subject')) {
      const s = subj.trim();
      if (/^(Text|RegEx)\b/i.test(s) && !ocrReads.has(b.id)) {
        const to = firstValue(b.text, 'TimeOut') ?? firstValue(b.text, 'Timeout');
        ocrReads.set(b.id, {
          schrittId: b.id,
          subject: /RegEx/i.test(s) ? 'RegEx' : 'Text',
          timeoutMs: to && /^\d+$/.test(to) ? Number(to) : null,
          textExtractionMode: firstValue(b.text, 'TextExtractionMode'),
          nameHint,
        });
      }
    }

    // Feste Wartezeit (Warten im Zeit-Modus: Subject:Time + Timeout in Sekunden)
    if (/Subject:\s*Time\b/i.test(b.text) && !fixedWaits.has(b.id)) {
      const to = firstValue(b.text, 'Timeout') ?? firstValue(b.text, 'TimeOut');
      const ms = to && /^\d+(\.\d+)?$/.test(to.trim()) ? Number(to.trim()) : 0; // EMMA-Timeout in Millisekunden
      fixedWaits.set(b.id, { schrittId: b.id, sekunden: Math.round(ms) / 1000, istManipulation: /manipulation/i.test(b.text), nameHint });
    }

    // Feste Klick-Position (Klicken mit absoluten X/Y-Koordinaten, ohne Anker)
    const hatAnker = /Subject:\s*(Shape|Object|Image|Text|RegEx)\b/i.test(b.text) || /ImageCompositionId/i.test(b.text);
    if (!hatAnker && !fixedClicks.has(b.id)) {
      const x = coord(b.text, 'X');
      const y = coord(b.text, 'Y');
      if (x !== null && y !== null) {
        fixedClicks.set(b.id, { schrittId: b.id, x, y, vermutlichFundgebunden: x === 0 && y === 0, nameHint });
      }
    }

    // Tippen-Schritt (PM-W-a): Keybased-Flag ist Tippen-spezifisch. Text kann {CV:…} + Klartext mischen.
    if (/Keybased:/i.test(b.text) && !keyTippen.has(b.id)) {
      keyTippen.set(b.id, {
        schrittId: b.id,
        text: firstValue(b.text, 'Text') ?? '',
        keybased: parseBool(firstValue(b.text, 'Keybased')) === true,
        noMod: parseBool(firstValue(b.text, '_NoModificationText')) === true,
        nameHint,
      });
    }

    // Verschachtelter Prozess → TestCaseID (inkl. -1/0 = toter Aufruf)
    for (const tc of allValues(b.text, 'TestCaseID')) {
      const n = Number(tc.match(/-?\d+/)?.[0]);
      if (Number.isNaN(n)) continue;
      const key = `${b.id}:${n}`;
      if (seenCall.has(key)) continue;
      seenCall.add(key);
      calls.push({ schrittId: b.id, testCaseId: n, nameHint });
    }

    // Datums-Literale (PM-10 Kohorten): TT.MM.JJJJ + JJJJ-MM-TT + JJJJMMTT in Dateinamen
    for (const d of b.text.match(/\b\d{2}\.\d{2}\.\d{4}\b/g) ?? []) dateLiterals.add(d);
    for (const d of b.text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []) dateLiterals.add(d);

    // Hart verdrahtete Windows-Pfade (D6/D10) + Klartext-Kennwort (D8)
    for (const m of b.text.matchAll(/([A-Za-z]:\\[^\s"'\n]{2,})/g)) { if (m[1]) hardcodedPaths.add(m[1]); }
    if (/(?:Password|Kennwort|Passwort)\s*:\s*[^\s{<][^\n]*/i.test(b.text)) hasPlaintextPassword = true;
  }

  return {
    nr: nr || (fileNr?.[1] ?? sourceFile),
    name: name || sourceFile,
    sourceFile,
    loops: [...loops.values()],
    ocrReads: [...ocrReads.values()],
    fixedWaits: [...fixedWaits.values()],
    fixedClicks: [...fixedClicks.values()],
    keyTippen: [...keyTippen.values()],
    calls,
    variables,
    dateLiterals: [...dateLiterals],
    hardcodedPaths: [...hardcodedPaths],
    hasPlaintextPassword,
    schrittCount: stepBlocks.length,
  };
}

export function parseFamily(files: { name: string; text: string }[]): EmmaFamily {
  const processes = files.map((f) => parseProcess(f.name, f.text));
  const byNr = new Map<string, EmmaProcess>();
  for (const p of processes) byNr.set(p.nr, p);
  return { processes, byNr };
}
