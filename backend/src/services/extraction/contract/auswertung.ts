/**
 * Vertragsauswertung P4 — Katalog, Klausel-Inventar und Erweiterungsfelder
 * aus dem Strukturbaum (Text, Qwen 3.5).
 *
 * Das Modell sieht die Klauseln als `[ID] Titelpfad: Text` und antwortet mit
 * Klausel-IDs als Fundstellen — es zitiert nicht, die Oberflaeche zeigt den
 * Originalwortlaut. Fristen werden nur beschrieben, nie in Daten umgerechnet
 * (das macht das Fristenradar).
 */

import type { Message } from '../../llm';
import { klauselnAlsText } from './struktur';
import { rufeModell, parallelBegrenzt, type ModellKontext } from './modell';
import {
  NICHT_BINDEND,
  type FristAngabe, type InventarEintrag, type InventarTyp, type Klausel, type KatalogElement, type KatalogStatus, type KatalogWert, type Modalitaet, type Verknuepfung,
} from './types';

// ── JSON-Schema-Bausteine (alles nullbar, alle Schluessel required) ─────────
const str = { type: ['string', 'null'] };
const num = { type: ['number', 'null'] };
const bool = { type: ['boolean', 'null'] };
const strListe = { type: 'array', items: { type: 'string' } };
const nEnum = (werte: string[]) => ({ type: ['string', 'null'], enum: [...werte, null] });
const arr = (items: Record<string, unknown>) => ({ type: 'array', items });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const EINHEITEN = ['tage', 'werktage', 'wochen', 'monate', 'jahre'];
const RICHTUNGEN = ['vor', 'nach', 'bis', 'innerhalb'];
const fristSchema = obj({ dauer: num, einheit: nEnum(EINHEITEN), richtung: nEnum(RICHTUNGEN), bezug: str, zum: str, wortlaut: str });

const KATALOG_STATUS: KatalogStatus[] = ['gefunden', 'nicht_geregelt', 'anlage_fehlt', 'delegiert', 'geerbt', 'bedingt'];
const MODALITAETEN: Modalitaet[] = ['muss', 'soll', 'bemueht', 'kann', 'darf_nicht'];
const INVENTAR_TYPEN: InventarTyp[] = ['pflicht', 'recht', 'frist', 'ausschluss', 'haftung', 'zahlung', 'sonstiges'];

const text = obj({ text: str });
/** Wert-Schema je Katalogelement (Spezifikation §4). */
export const KATALOG_WERTE: Record<KatalogElement, Record<string, unknown>> = {
  vertragsart: obj({ bezeichnung: str, kategorie: str }),
  parteien: arr(obj({ rolle: str, name: str, anschrift: str, aliasse: strListe })),
  vertragsnummern: arr(obj({ art: str, wert: str })),
  unterschriften: arr(obj({ partei: str, vorhanden: bool, datum: str, ort: str, stempel: bool, vertretung: str, handschriftlich: bool })),
  datum_abschluss: obj({ datum: str, regel: str }),
  beginn: obj({ datum: str, regel: str }),
  laufzeit: obj({ art: nEnum(['befristet', 'unbefristet', 'mindestlaufzeit']), dauer: str, ende: str }),
  verlaengerung: obj({ automatisch: bool, schritt: str }),
  kuendigung: obj({ frist: fristSchema, form: str, ausserordentlich: str }),
  entgelte: arr(obj({ bezeichnung: str, betrag: num, formel: str, bezugsgroesse: str, richtung: str, rhythmus: str, netto_brutto: nEnum(['netto', 'brutto']) })),
  zahlungsbedingungen: obj({ zahlungsziel: str, verfahren: str }),
  preisanpassung: arr(obj({ wer: str, ausloeser: str, frist: str, wirksam_ab: str })),
  haftung: obj({ beschraenkung: str, hoechstbetrag: str, ausnahmen: str }),
  gewaehrleistung: text,
  verfuegbarkeit_sla: obj({ zusage: str, modalitaet: nEnum(MODALITAETEN) }),
  vertragsstrafe: text,
  vertraulichkeit: text,
  exklusivitaet_wettbewerb: text,
  gerichtsstand: obj({ ort: str, bedingung: str }),
  rechtswahl: text,
  schriftform: text,
  widerruf: text,
  anlagen: arr(obj({ bezeichnung: str, vorhanden: bool })),
};
export const KATALOG_ELEMENTE = Object.keys(KATALOG_WERTE) as KatalogElement[];

/** Katalog in zwei Teilen abfragen — kuerzere Antworten, weniger Entgleisungsrisiko. */
export const KATALOG_TEILE: KatalogElement[][] = [
  ['vertragsart', 'parteien', 'vertragsnummern', 'unterschriften', 'datum_abschluss', 'beginn', 'laufzeit', 'verlaengerung', 'kuendigung', 'anlagen'],
  ['entgelte', 'zahlungsbedingungen', 'preisanpassung', 'haftung', 'gewaehrleistung', 'verfuegbarkeit_sla', 'vertragsstrafe', 'vertraulichkeit', 'exklusivitaet_wettbewerb', 'gerichtsstand', 'rechtswahl', 'schriftform', 'widerruf'],
];

export function katalogSchema(elemente: KatalogElement[] = Object.keys(KATALOG_WERTE) as KatalogElement[], mitZusatz = true): Record<string, unknown> {
  const katalog: Record<string, unknown> = {};
  for (const el of elemente) {
    katalog[el] = obj({ status: { type: 'string', enum: KATALOG_STATUS }, wert: KATALOG_WERTE[el], bedingung: str, verweis: str, klauseln: strListe });
  }
  return obj({
    katalog: obj(katalog),
    ...(mitZusatz ? {
      verknuepfungen: arr(obj({ art: { type: 'string', enum: ['vertragsnummer', 'kundennummer', 'rahmenvertrag', 'zusatz_zu', 'ersetzt', 'sonstige'] }, wert: { type: 'string' }, klausel: str })),
      auffaelligkeiten: arr(obj({ text: { type: 'string' }, klauseln: strListe })),
    } : {}),
  });
}

export function inventarSchema(): Record<string, unknown> {
  return obj({
    eintraege: arr(obj({
      typ: { type: 'string', enum: INVENTAR_TYPEN },
      partei: { type: 'string' },
      gegenueber: str,
      inhalt: { type: 'string' },
      modalitaet: { type: 'string', enum: MODALITAETEN },
      ausloeser: str,
      bedingung: str,
      frist: fristSchema,
      klauseln: strListe,
    })),
  });
}

export interface ErweiterungsFeld {
  type: 'text' | 'number' | 'date' | 'boolean' | 'list';
  label: string;
  description?: string;
  item_fields?: Record<string, { type: 'text' | 'number' | 'date' | 'boolean'; label: string; description?: string }>;
}

const skalar = (t: string) => (t === 'number' ? num : t === 'boolean' ? bool : str);
export function erweiterungSchema(felder: Record<string, ErweiterungsFeld>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [id, f] of Object.entries(felder)) {
    if (f.type === 'list') {
      const items: Record<string, unknown> = {};
      for (const [iid, it] of Object.entries(f.item_fields ?? {})) items[iid] = skalar(it.type);
      props[id] = obj({ zeilen: arr(obj(items)), klauseln: strListe });
    } else props[id] = obj({ wert: skalar(f.type), klauseln: strListe });
  }
  return obj({ felder: obj(props) });
}

// ── Prompts ─────────────────────────────────────────────────────────────────
const GRUNDREGELN = `Du wertest einen deutschen Vertrag aus. Der Vertrag liegt als Liste von Klauseln vor, jede mit ID in eckigen Klammern, Titelpfad und Seiten.
Regeln:
- Fundstellen ("klauseln") sind IMMER IDs aus der Liste (z. B. "§6.3", "Z7.2", "2.5.3", "Anl1", "rubrum", "unterschriften"). Keine IDs erfinden.
- Nur angeben, was im Vertrag steht. Nichts ergänzen, nichts aus allgemeinem Recht ableiten.
- Durchgestrichener Text (~~…~~) und nicht angekreuzte Optionen ([ ]) gelten NICHT. Angekreuzte Optionen ([x]) gelten.
- {{hs: …}} ist handschriftlich eingetragen, {{stempel: …}} ein Stempel. {{unterschrift: …}} bedeutet: eine Unterschrift IST vorhanden (auch wenn kein Name erkennbar ist). {{keine unterschrift}} bedeutet: das Unterschriftsfeld ist leer. Hat eine Partei im Unterschriftsbereich keine {{unterschrift: …}}-Markierung, ist ihre Unterschrift nicht vorhanden.
- Formularbeschriftungen wie "Ort, Datum", "Unterschrift und Firmenstempel", "Name in Druckbuchstaben" sind Beschriftungen, keine Platzhalter.
- Datumsangaben als YYYY-MM-DD, wenn eindeutig; sonst wie im Vertrag. Beträge als Zahl ohne Währungszeichen.
- Fristen NICHT in Kalenderdaten umrechnen — nur beschreiben (Dauer, Einheit, Richtung, Bezugspunkt, "zum …", Wortlaut).
- Parteien mit ihrer Rolle im Vertrag bezeichnen (z. B. "Auftraggeber", "Auftragnehmer", "Kunde", "Mieter").`;

const KATALOG_ANWEISUNG = `${GRUNDREGELN}

Fülle den Katalog. Status je Element:
- gefunden: im Vertrag geregelt
- nicht_geregelt: der Vertrag regelt das nicht (wert leer lassen)
- anlage_fehlt: der Vertrag verweist dafür auf eine Anlage/Preisliste, die nicht im Dokument enthalten ist (verweis = Bezeichnung der Anlage)
- delegiert: wird ausdrücklich in einem anderen Vertrag geregelt, z. B. Rahmenvertrag oder Einzelvertrag (verweis = welcher)
- geerbt: gilt laut Vertrag wie im Hauptvertrag, z. B. bei einer Zusatzvereinbarung (verweis = welcher)
- bedingt: gilt nur unter einer Bedingung (bedingung = welche, z. B. "nur wenn der Kunde Kaufmann ist")
Hinweise:
- "klauseln" je Element nur die maßgeblichen Fundstellen (in der Regel 1–4), nicht alle Klauseln des Vertrags.
- "bedingung" und "verweis" nur bei den Status "bedingt" bzw. "anlage_fehlt"/"delegiert"/"geerbt" füllen, sonst null.
- vertragsart aus dem INHALT bestimmen; weicht der Titel ab, beides nennen.
- unterschriften: je Partei ein Eintrag; vorhanden=false, wenn das Unterschriftsfeld leer ist.
- anlagen: alle im Vertrag genannten Anlagen/Anhänge; vorhanden=true nur, wenn die Anlage im Dokument enthalten ist (eigene Klausel "Anl…").
- verfuegbarkeit_sla.modalitaet: "muss" bei fester Zusage, "bemueht" bei "bemüht sich", "in der Regel", "ist bestrebt".
- verknuepfungen: Vertrags-/Kundennummern, Bezüge auf andere Verträge ("Rahmenvertrag vom …", "Zusatzvereinbarung zum …", "ersetzt den Vertrag von …").
- auffaelligkeiten: Widersprüche im Vertrag, falsche Verweise, Platzhalter ("XXX", leere Pflichtfelder), abweichende Angaben (z. B. unterschiedliche Adressen derselben Partei).`;

const INVENTAR_ANWEISUNG = `${GRUNDREGELN}

Erfasse VOLLSTÄNDIG alle Pflichten, Rechte, Fristen, Ausschlüsse, Haftungsregeln und Zahlungsregeln aus den folgenden Klauseln — jeden Absatz prüfen, nichts zusammenfassen, was unterschiedliche Parteien oder Fristen betrifft.
Je Eintrag:
- typ: pflicht | recht | frist | ausschluss (z. B. "ausdrücklich nicht Bestandteil") | haftung | zahlung | sonstiges
- partei: wer verpflichtet/berechtigt ist (Rolle; auch Dritte, z. B. "Generalunternehmer"); gegenueber: gegenüber wem
- inhalt: knapp und sinngemäß, eigenständig verständlich
- modalitaet: muss (verpflichtend, "hat … zu", "ist verpflichtet") | soll | bemueht ("bemüht sich", "in der Regel", "ist bestrebt", "nach besten Kräften") | kann (Recht/Option) | darf_nicht
- ausloeser: Ereignis, an das die Pflicht/Frist anknüpft (z. B. "Störungsmeldung", "Inbetriebnahme")
- bedingung: falls nur unter Bedingung
- frist: Dauer/Einheit/Richtung/Bezug/"zum …"/Wortlaut — alle null, wenn keine Frist
- klauseln: IDs der Fundstellen
Nur Klauseln aus dem Abschnitt "Auszuwertende Klauseln" erfassen; der Kontext dient nur dem Verständnis.`;

const ERWEITERUNG_ANWEISUNG = `${GRUNDREGELN}

Fülle die Felder des Profils aus dem Vertrag (inkl. Anlagen). Listenfelder: je Zeile/Objekt ein Eintrag, Tabellen vollständig. Nicht vorhandene Werte als null. Je Feld die Fundstellen angeben.`;

// ── Auswertung ──────────────────────────────────────────────────────────────
export interface AuswertungsErgebnis {
  katalog: Partial<Record<KatalogElement, KatalogWert>>;
  verknuepfungen: Verknuepfung[];
  auffaelligkeiten: Array<{ text: string; klauseln: string[] }>;
  inventar: InventarEintrag[];
  erweiterung: { data: Record<string, unknown>; fundstellen: Record<string, string[]> };
  aufrufe: number;
  probleme: string[];
}

const ZEICHEN_JE_GRUPPE = 20_000;

/** Bindende Klauseln in Gruppen ≤ Budget, Abschnitte bleiben zusammen (zu grosse werden an Absaetzen geteilt). */
export function inventarGruppen(klauseln: Klausel[], budget = ZEICHEN_JE_GRUPPE): Klausel[][] {
  const bindend = klauseln.filter((k) => !NICHT_BINDEND.has(k.rolle) && !['rubrum', 'unterschriften'].includes(k.id));
  const abschnitte: Klausel[][] = [];
  for (const k of bindend) {
    if (k.ebene === 1 || !abschnitte.length) abschnitte.push([k]);
    else abschnitte[abschnitte.length - 1]!.push(k);
  }
  const laenge = (ks: Klausel[]) => ks.reduce((n, k) => n + k.text.length + 80, 0);
  const gruppen: Klausel[][] = [];
  let aktuell: Klausel[] = [];
  const abschliessen = () => { if (aktuell.length) gruppen.push(aktuell); aktuell = []; };
  for (const a of abschnitte) {
    if (laenge(a) > budget) {
      abschliessen();
      let teil: Klausel[] = [];
      for (const k of a) {
        if (teil.length && laenge([...teil, k]) > budget) { gruppen.push(teil); teil = [a[0]!]; }
        teil.push(k);
      }
      if (teil.length) gruppen.push(teil);
      continue;
    }
    if (laenge([...aktuell, ...a]) > budget) abschliessen();
    aktuell.push(...a);
  }
  abschliessen();
  return gruppen.filter((g) => g.some((k) => k.text.trim()));
}

const leer = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

function bereinigeFrist(f: unknown): FristAngabe | undefined {
  if (!f || typeof f !== 'object') return undefined;
  const r = f as Record<string, unknown>;
  if (['dauer', 'einheit', 'richtung', 'bezug', 'zum', 'wortlaut'].every((k) => leer(r[k]))) return undefined;
  const out: FristAngabe = { wortlaut: typeof r.wortlaut === 'string' ? r.wortlaut : '' };
  if (typeof r.dauer === 'number') out.dauer = r.dauer;
  if (typeof r.einheit === 'string') out.einheit = r.einheit as FristAngabe['einheit'];
  if (typeof r.richtung === 'string') out.richtung = r.richtung as FristAngabe['richtung'];
  if (typeof r.bezug === 'string' && r.bezug.trim()) out.bezug = r.bezug;
  if (typeof r.zum === 'string' && r.zum.trim()) out.zum = r.zum;
  return out;
}

const idsAus = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim() && x.trim() !== 'null').map((x) => x.trim()) : []);

/** Null-Felder entfernen (Ergebnis lesbarer, Schema bleibt beim Modell streng). */
function ohneNull(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ohneNull);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) out[k] = ohneNull(x);
    return out;
  }
  return v;
}

function kontextText(klauseln: Klausel[], katalog: Partial<Record<KatalogElement, KatalogWert>>): string {
  const rubrum = klauseln.find((k) => k.id === 'rubrum')?.text.slice(0, 2500) ?? '';
  const parteien = katalog.parteien?.wert;
  const definitionen = klauseln.filter((k) => k.definitionen || (k.eltern && klauseln.find((e) => e.id === k.eltern)?.definitionen));
  const defText = klauselnAlsText(definitionen).slice(0, 10_000);
  return [
    rubrum && `Rubrum:\n${rubrum}`,
    Array.isArray(parteien) && parteien.length ? `Parteien: ${JSON.stringify(ohneNull(parteien))}` : '',
    defText && `Begriffsbestimmungen:\n${defText}`,
  ].filter(Boolean).join('\n\n');
}

export async function werteAus(
  kontext: ModellKontext,
  klauseln: Klausel[],
  opts: { felder?: Record<string, ErweiterungsFeld>; parallel: number; anweisungen?: string; beiSchritt?: (schritt: string) => void | Promise<void> },
): Promise<AuswertungsErgebnis> {
  const probleme: string[] = [];
  let aufrufe = 0;
  const zusatz = opts.anweisungen?.trim() ? `\n\nFachliche Hinweise des Profils:\n${opts.anweisungen.trim()}` : '';
  const bindend = klauseln.filter((k) => !NICHT_BINDEND.has(k.rolle));
  const vertragsText = klauselnAlsText(bindend);

  // 1. Katalog (ganzer Vertrag)
  await opts.beiSchritt?.('katalog');
  const katalog: Partial<Record<KatalogElement, KatalogWert>> = {};
  let verknuepfungen: Verknuepfung[] = [];
  let auffaelligkeiten: Array<{ text: string; klauseln: string[] }> = [];
  const teile = await Promise.all(KATALOG_TEILE.map(async (elemente, i) => {
    try {
      aufrufe += 1;
      const a = await rufeModell(kontext, {
        messages: [
          { role: 'system', content: KATALOG_ANWEISUNG + zusatz },
          { role: 'user', content: `Vertrag:\n\n${vertragsText}` },
        ] as Message[],
        schema: katalogSchema(elemente, i === 0), name: 'vertragskatalog', operation: 'contract_catalog', timeoutMs: 300_000, maxTokens: 8192,
        label: `contract-structured Katalog ${i + 1}/${KATALOG_TEILE.length}`, modus: 'frei',
      });
      if (!a.json?.katalog) probleme.push(`Katalog ${i + 1}: Modellantwort nicht lesbar`);
      return a.json;
    } catch (err) {
      probleme.push(`Katalog ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }));
  {
    const k = Object.assign({}, ...teile.map((t) => (t?.katalog ?? {}) as object)) as Record<string, Record<string, unknown>>;
    const kopf = teile[0] ?? null;
    for (const el of KATALOG_ELEMENTE) {
      const e = k?.[el];
      if (!e) continue;
      const status = (KATALOG_STATUS as string[]).includes(e.status as string) ? e.status as KatalogStatus : 'nicht_geregelt';
      katalog[el] = {
        status,
        wert: status === 'nicht_geregelt' ? null : ohneNull(e.wert),
        ...(typeof e.bedingung === 'string' && e.bedingung.trim() ? { bedingung: e.bedingung } : {}),
        ...(typeof e.verweis === 'string' && e.verweis.trim() ? { verweis: e.verweis } : {}),
        klauseln: idsAus(e.klauseln),
      };
    }
    verknuepfungen = (Array.isArray(kopf?.verknuepfungen) ? kopf!.verknuepfungen as Array<Record<string, unknown>> : [])
      .filter((v) => typeof v.wert === 'string' && v.wert.trim())
      .map((v) => ({ art: v.art as Verknuepfung['art'], wert: String(v.wert), ...(typeof v.klausel === 'string' ? { klausel: v.klausel } : {}) }));
    auffaelligkeiten = (Array.isArray(kopf?.auffaelligkeiten) ? kopf!.auffaelligkeiten as Array<Record<string, unknown>> : [])
      .filter((x) => typeof x.text === 'string' && x.text.trim())
      .map((x) => ({ text: String(x.text), klauseln: idsAus(x.klauseln) }));
  }

  // 2. Inventar (Abschnittsgruppen, parallel) und 3. Erweiterung
  const ktx = kontextText(klauseln, katalog);
  const gruppen = inventarGruppen(klauseln);
  await opts.beiSchritt?.(`inventar:${gruppen.length}`);
  const inventarTeile = parallelBegrenzt(gruppen, opts.parallel, async (g, i) => {
    try {
      aufrufe += 1;
      const a = await rufeModell(kontext, {
        messages: [
          { role: 'system', content: INVENTAR_ANWEISUNG + zusatz },
          { role: 'user', content: `Kontext:\n${ktx}\n\nAuszuwertende Klauseln:\n\n${klauselnAlsText(g)}` },
        ] as Message[],
        schema: inventarSchema(), name: 'klauselinventar', operation: 'contract_inventory', timeoutMs: 240_000, maxTokens: 8192, label: `contract-structured Inventar ${i + 1}/${gruppen.length}`,
      });
      const eintraege = Array.isArray(a.json?.eintraege) ? a.json!.eintraege as Array<Record<string, unknown>> : null;
      if (!eintraege) { probleme.push(`Inventar-Gruppe ${i + 1}: Modellantwort nicht lesbar`); return []; }
      return eintraege.filter((e) => typeof e.inhalt === 'string' && e.inhalt.trim()).map((e): InventarEintrag => {
        const frist = bereinigeFrist(e.frist);
        return {
          typ: (INVENTAR_TYPEN as string[]).includes(e.typ as string) ? e.typ as InventarTyp : 'sonstiges',
          partei: typeof e.partei === 'string' ? e.partei : '',
          ...(typeof e.gegenueber === 'string' && e.gegenueber.trim() ? { gegenueber: e.gegenueber } : {}),
          inhalt: String(e.inhalt),
          modalitaet: (MODALITAETEN as string[]).includes(e.modalitaet as string) ? e.modalitaet as Modalitaet : 'muss',
          ...(typeof e.ausloeser === 'string' && e.ausloeser.trim() ? { ausloeser: e.ausloeser } : {}),
          ...(typeof e.bedingung === 'string' && e.bedingung.trim() ? { bedingung: e.bedingung } : {}),
          ...(frist ? { frist } : {}),
          klauseln: idsAus(e.klauseln),
        };
      });
    } catch (err) {
      probleme.push(`Inventar-Gruppe ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  });

  const felder = opts.felder ?? {};
  const erweiterungAufruf = (async () => {
    const data: Record<string, unknown> = {};
    const fundstellen: Record<string, string[]> = {};
    if (!Object.keys(felder).length) return { data, fundstellen };
    const beschreibung = Object.entries(felder).map(([id, f]) => {
      const spalten = f.type === 'list' ? ` Spalten: ${Object.entries(f.item_fields ?? {}).map(([iid, it]) => `${iid} (${it.label}${it.description ? `: ${it.description}` : ''})`).join(', ')}` : '';
      return `- ${id} (${f.type}): ${f.label}${f.description ? ` — ${f.description}` : ''}${spalten}`;
    }).join('\n');
    try {
      aufrufe += 1;
      const a = await rufeModell(kontext, {
        messages: [
          { role: 'system', content: `${ERWEITERUNG_ANWEISUNG}\n\nFelder:\n${beschreibung}${zusatz}` },
          { role: 'user', content: `Vertrag:\n\n${vertragsText}` },
        ] as Message[],
        schema: erweiterungSchema(felder), name: 'profilfelder', operation: 'contract_fields', timeoutMs: 240_000, maxTokens: 8192, label: 'contract-structured Erweiterung',
      });
      const f = (a.json?.felder ?? null) as Record<string, Record<string, unknown>> | null;
      if (!f) probleme.push('Erweiterung: Modellantwort nicht lesbar');
      for (const [id, def] of Object.entries(felder)) {
        const e = f?.[id];
        data[id] = def.type === 'list' ? (Array.isArray(e?.zeilen) ? e!.zeilen : []) : (e?.wert ?? null);
        fundstellen[id] = idsAus(e?.klauseln);
      }
    } catch (err) {
      probleme.push(`Erweiterung: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { data, fundstellen };
  })();

  const [inventarListen, erweiterung] = await Promise.all([inventarTeile, erweiterungAufruf]);
  return { katalog, verknuepfungen, auffaelligkeiten, inventar: inventarListen.flat(), erweiterung, aufrufe, probleme };
}
