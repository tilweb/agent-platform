/**
 * EMMA-2.7-Prozess-Extraktion aus den koordinatenbasierten Wörtern (`bbox.ts`).
 *
 * Extrahiert je Prozess: Kopf (Nr, Export-Name) und die Variablen-Tabelle
 * („Variable Informationen") als typisierte Zeilen — via Spalten-Raster.
 * Referenz-Verhalten: PAKET_2/10_Engine/varliste_engine_v1.py (Raster
 * SP_ID=120/NAME=235/TYP=305/INIT=420, kalibriert am Übungsfall gegen
 * _varliste_demo_daten.json). Schritt-Tabelle/Call-Graph → emma-schritte.ts.
 */
import { pdfToBBox, zeilen, type BBoxWord } from './bbox';

/** Spalten-Grenzen (linke Kante der jeweils nächsten Spalte). */
const SP = { id: 120, name: 235, typ: 305, init: 420 } as const;

const TYPEN = new Set(['string', 'int', 'bool', 'datetime', 'double', 'password', 'Timer']);
const SCHNITT = new Set(['Privat', 'Eingehend', 'Ausgehend', 'EinAus']);

/** Trennzeichen am Zeilenende → beim Kleben KEIN Leerzeichen (PDF-Umbruch-Heuristik). */
const SEP_ENDE = /[-_\\/.:=([{,;]$/;

export interface EmmaVariable {
  p: string;        // Prozessnummer
  id: string;
  name: string;
  typ: string;
  init: string;
  schnitt: string;
  pos: number;      // laufende Position im Prozess (1-basiert)
  fund: { s: string; typ: string }[]; // Schritte, die diese Variable via {CV:pos} nutzen (+ Schritt-Typ)
  umbruch?: boolean; // true wenn Name/Init aus einer geratenen Umbruch-Klebung stammt (→ ❓, nie Befund)
}

export interface EmmaCvRef { s: string; nnn: number; name: string; }

export interface EmmaProcessExtract {
  nr: string;
  name_export: string;
  prozess_stand?: string;
  druck_stand?: string;
  variablen: EmmaVariable[];
  aufrufe: string[];                       // TestCaseID-Ziele (Call-Graph, nur >0)
  cvrefs: EmmaCvRef[];                      // {CV:nnn - Name}-Vorkommen je Schritt
  ausgaenge: { erfolg: number; fehler: number };
}

/** Schritt-IDs stehen ganz links (x≈32); Variablen-IDs in der ID-Spalte (x≈95). */
const STEP_ID_MAX_X = 60;

type Spalte = 'id' | 'name' | 'typ' | 'init' | 'schnitt';
function bucketOf(x: number): Spalte {
  if (x < SP.id) return 'id';
  if (x < SP.name) return 'name';
  if (x < SP.typ) return 'typ';
  if (x < SP.init) return 'init';
  return 'schnitt';
}

function spalten(row: BBoxWord[]): Record<Spalte, string[]> {
  const s: Record<Spalte, string[]> = { id: [], name: [], typ: [], init: [], schnitt: [] };
  for (const w of row) s[bucketOf(w.x)].push(w.text);
  return s;
}

/** Prozessnummer + Export-Name aus dem Kopf (erste „Prozess N:"-Zeile). */
function kopf(rows: BBoxWord[][], fallbackNr: string): { nr: string; name_export: string } {
  for (const row of rows) {
    const txt = row.map((w) => w.text).join(' ');
    const m = txt.match(/Prozess\s+(\d+):/);
    if (m) {
      const name = txt.replace(/\s*\(\d{2}\.\d{2}\.\d{4}[^)]*\)\s*$/, '').replace(/\s+emma@\S+.*$/, '').trim();
      return { nr: m[1]!, name_export: name };
    }
  }
  return { nr: fallbackNr, name_export: `Prozess ${fallbackNr}` };
}

/** Extrahiert einen Prozess aus seinen bbox-Seiten. */
export function extractProcess(pages: Awaited<ReturnType<typeof pdfToBBox>>, fallbackNr = ''): EmmaProcessExtract {
  const allRows = pages.flatMap((p) => zeilen(p));
  const { nr, name_export } = kopf(allRows, fallbackNr);

  const variablen: EmmaVariable[] = [];
  let pos = 0;
  let inTable = false;

  // Schritt-Tabelle (Call-Graph, {CV:}-Fundstellen, Ausgänge)
  const aufrufe: string[] = [];
  const cvrefs: EmmaCvRef[] = [];
  const ausgaenge = { erfolg: 0, fehler: 0 };
  const stepTyp = new Map<string, string>();
  let curStep = '';
  const druckCand: string[] = [];   // freistehende Datums-Zeilen (Seiten-Kopf) → Druck-Stand
  let prozessStand = '';            // Datum im Prozess-Kopf „Prozess N: … (DATE)" → Prozess-Stand
  const DT = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})/;

  for (const row of allRows) {
    const sp = spalten(row);
    const rowText = row.map((w) => w.text).join(' ');

    // Zeitstempel (DD.MM.YYYY HH:MM:SS → ISO): der Prozess-Stand steht in KLAMMERN
    // „(DD.MM.YYYY HH:MM:SS)" — beim Übungsfall in der Kopfzeile, bei echten EMMA-
    // Exporten (Heinzl) im Body. Die freistehende Datums-Zeile ist der Druck-Stand.
    const dt = rowText.match(DT);
    if (dt) {
      const iso = `${dt[3]}-${dt[2]}-${dt[1]} ${dt[4]}`;
      const inKlammer = new RegExp(`\\(\\s*${dt[1]}\\.${dt[2]}\\.${dt[3]}`).test(rowText);
      if (inKlammer) prozessStand = iso;
      else druckCand.push(iso);
    }

    // Schritt-Zeile: fuehrende Schritt-ID ganz links (x < STEP_ID_MAX_X), unabhaengig vom Typ-Wort
    if (!inTable) {
      const first = row[0];
      if (first && /^\d{1,3}$/.test(first.text) && first.x < STEP_ID_MAX_X) {
        curStep = first.text;
        const typWord = row[1]?.text ?? '';
        stepTyp.set(curStep, typWord);
        if (typWord === 'Erfolg') ausgaenge.erfolg++;
        if (typWord === 'Fehler') ausgaenge.fehler++;
      }
      if (curStep) {
        const tc = rowText.match(/TestCaseID:\s*(-?\d+)/);
        if (tc) { const n = Number(tc[1]); if (n > 0 && !aufrufe.includes(String(n))) aufrufe.push(String(n)); }
        for (const m of rowText.matchAll(/\{CV:\s*(\d+)\s*-\s*([^}]+)\}/g)) {
          cvrefs.push({ s: curStep, nnn: Number(m[1]), name: (m[2] ?? '').trim() });
        }
      }
    }

    // Tabellen-Kopf erkennen (öffnet den Variablen-Abschnitt)
    if (/\bSchnittstelle\b/.test(rowText) && /\b(Typ|Initial\w*|Wert)\b/.test(rowText) && !sp.id.some((t) => /^\d{1,4}$/.test(t))) {
      inTable = true;
      continue;
    }

    const idTok = sp.id.find((t) => /^\d{1,4}$/.test(t));
    const typTok = sp.typ.find((t) => TYPEN.has(t));
    const schnittTok = sp.schnitt.find((t) => SCHNITT.has(t));

    // Gültige Variablen-Zeile: numerische ID + bekannter Typ + bekannte Schnittstelle
    if (idTok && typTok && schnittTok) {
      variablen.push({
        p: nr,
        id: idTok,
        name: sp.name.join(' ').trim(),
        typ: typTok,
        init: sp.init.join(' ').trim(),
        schnitt: schnittTok,
        pos: ++pos,
        fund: [],
      });
      continue;
    }

    // Fortsetzungs-Zeile (Umbruch): keine ID/Typ/Schnitt, aber Name- und/oder
    // Init-Spalte gefüllt, im Tabellen-Abschnitt nach einer Variablen-Zeile →
    // an Name bzw. Init der letzten Variable kleben. Trennzeichen am Ende → ohne
    // Leerzeichen (geratenes Muster, PAKET_2 §_kleben). Geklebte Felder = ❓ (umbruch).
    if (inTable && variablen.length && !idTok && !typTok && !schnittTok && (sp.name.length || sp.init.length)) {
      const last = variablen[variablen.length - 1]!;
      const nameAdd = sp.name.join(' ').trim();
      const initAdd = sp.init.join(' ').trim();
      if (nameAdd) {
        last.name = SEP_ENDE.test(last.name) ? last.name + nameAdd : last.name + ' ' + nameAdd;
        last.umbruch = true;
      }
      if (initAdd) {
        last.init = SEP_ENDE.test(last.init) ? last.init + initAdd : last.init + ' ' + initAdd;
        last.umbruch = true;
      }
    }
  }

  // Fund-Verknüpfung: {CV:nnn - Name} → Variable. Der NAME im Token ist maßgeblich
  // (nnn kann inkonsistent sein — designierter „Wertfehler"-Fall des Übungsfalls); nnn
  // nur als Fallback, wenn der Name nicht auf genau eine Variable zeigt. Dedupe je Schritt.
  const byName = new Map<string, EmmaVariable>();
  for (const v of variablen) if (!byName.has(v.name.trim())) byName.set(v.name.trim(), v);
  const byPos = new Map(variablen.map((v) => [v.pos, v]));
  for (const ref of cvrefs) {
    const v = byName.get(ref.name.trim()) ?? byPos.get(ref.nnn);
    if (v && !v.fund.some((f) => f.s === ref.s)) v.fund.push({ s: ref.s, typ: stepTyp.get(ref.s) ?? '' });
  }

  // Druck-Stand = häufigste freistehende Datums-Zeile (Seiten-Kopf jeder Seite); Prozess-Stand aus dem Kopf.
  const freq = new Map<string, number>();
  for (const d of druckCand) freq.set(d, (freq.get(d) ?? 0) + 1);
  const druck_stand = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)[0];
  const prozess_stand = prozessStand || druck_stand;

  return { nr, name_export, prozess_stand, druck_stand, variablen, aufrufe, cvrefs, ausgaenge };
}

/** Bequemer Einstieg: PDF-Bytes → Prozess-Extrakt. */
export async function extractProcessFromPdf(bytes: Uint8Array, fallbackNr = ''): Promise<EmmaProcessExtract> {
  const pages = await pdfToBBox(bytes);
  return extractProcess(pages, fallbackNr);
}
