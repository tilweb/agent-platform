/**
 * Vertragskatalog als normale Profilfelder (API-Doku docs/dp-api-vertrag-schema-2026-10-12.md).
 *
 * Bei Profilen mit Strategie `contract-structured` gehoeren die Elemente des festen Vertragskatalogs als Felder zum
 * Profil: generisch aus `KATALOG_WERTE` abgeleitet, beim Laden angehaengt und nie gespeichert (immer der aktuelle
 * Katalog des Codes, vom Nutzer nicht loeschbar). Damit laufen sie wie jedes Feld durch Pruefansicht, Korrektur,
 * Export, Evaluation und `projects.list`. Die Strategie fuellt sie aus `vertrag.katalog`.
 *
 * Feld-IDs: `katalog_<element>[_<pfad>]`, je Element zusaetzlich `_status` und `_fundstellen`.
 */

import { KATALOG_STATUS, KATALOG_WERTE } from '../services/extraction/contract/auswertung';
import type { KatalogElement, KatalogWert } from '../services/extraction/contract/types';
import type { ExtractionProject, ProjectField, ProjectItemField } from './learning/types';

export const KATALOG_PRAEFIX = 'katalog_';
export const KATALOG_GRUPPE = 'Vertragskatalog';

export const KATALOG_LABEL: Record<KatalogElement, string> = {
  vertragsart: 'Vertragsart', parteien: 'Parteien', vertragsnummern: 'Vertrags-/Kundennummern', unterschriften: 'Unterschriften',
  datum_abschluss: 'Abschluss', beginn: 'Beginn', laufzeit: 'Laufzeit', verlaengerung: 'Verlängerung', kuendigung: 'Kündigung',
  entgelte: 'Entgelte', zahlungsbedingungen: 'Zahlungsbedingungen', preisanpassung: 'Preisanpassung', haftung: 'Haftung',
  gewaehrleistung: 'Gewährleistung', verfuegbarkeit_sla: 'Verfügbarkeit / Störungen', vertragsstrafe: 'Vertragsstrafe',
  vertraulichkeit: 'Vertraulichkeit', exklusivitaet_wettbewerb: 'Exklusivität / Wettbewerb', gerichtsstand: 'Gerichtsstand',
  rechtswahl: 'Rechtswahl', schriftform: 'Schriftform', widerruf: 'Widerruf', anlagen: 'Anlagen',
};

const STATUS_BESCHREIBUNG = 'gefunden = geregelt · nicht_geregelt · anlage_fehlt = in nicht beigefügter Anlage geregelt · delegiert = in anderem Vertrag geregelt · geerbt = gilt wie im Hauptvertrag · bedingt = gilt nur unter einer Bedingung';

export const TEIL_LABEL: Record<string, string> = {
  bezeichnung: 'Bezeichnung', kategorie: 'Kategorie', rolle: 'Rolle', name: 'Name', anschrift: 'Anschrift', aliasse: 'Kurzbezeichnungen',
  art: 'Art', wert: 'Wert', partei: 'Partei', vorhanden: 'Vorhanden', klausel: 'Fundstelle', datum: 'Datum', ort: 'Ort', stempel: 'Stempel',
  vertretung: 'Vertreten durch', handschriftlich: 'Handschriftlich', regel: 'Regel', dauer: 'Dauer', ende: 'Ende', automatisch: 'Automatisch',
  schritt: 'Verlängerungsschritt', frist: 'Frist', einheit: 'Einheit', richtung: 'Richtung', bezug: 'Bezugspunkt', zum: 'Zum (Termin)', wortlaut: 'Wortlaut',
  form: 'Form', ausserordentlich: 'Außerordentlich', betrag: 'Betrag', formel: 'Formel', bezugsgroesse: 'Bezugsgröße', rhythmus: 'Rhythmus',
  netto_brutto: 'Netto/Brutto', zahlungsziel: 'Zahlungsziel', verfahren: 'Verfahren', wer: 'Wer', ausloeser: 'Auslöser', wirksam_ab: 'Wirksam ab',
  beschraenkung: 'Beschränkung', hoechstbetrag: 'Höchstbetrag', ausnahmen: 'Ausnahmen', zusage: 'Zusage', modalitaet: 'Verbindlichkeit',
  // Einschränkung, unter der die Regel gilt (z. B. Gerichtsstand „sofern der Kunde Kaufmann ist").
  bedingung: 'Gilt nur, wenn',
};

interface Schema { type?: string | string[]; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] }
interface Blatt { pfad: string[]; schema: Schema }

const hatTyp = (s: Schema, t: string) => (Array.isArray(s.type) ? s.type.includes(t) : s.type === t);

/** Blaetter eines Objekt-Schemas (verschachtelte Objekte aufgeloest, Listen von Strings als Blatt). */
function blaetter(s: Schema, pfad: string[] = []): Blatt[] {
  if (hatTyp(s, 'object') && s.properties) return Object.entries(s.properties).flatMap(([k, v]) => blaetter(v, [...pfad, k]));
  return [{ pfad, schema: s }];
}

function blattTyp(b: Blatt): { type: ProjectItemField['type']; werte?: string[] } {
  const s = b.schema;
  if (s.enum) return { type: 'text', werte: s.enum.filter((x): x is string => typeof x === 'string') };
  if (hatTyp(s, 'number')) return { type: 'number' };
  if (hatTyp(s, 'boolean')) return { type: 'boolean' };
  if (b.pfad[b.pfad.length - 1] === 'datum') return { type: 'date' };
  return { type: 'text' }; // Strings, Listen von Strings (als „a; b")
}

const werteliste = (werte: string[]) => ({ source: 'list' as const, values: werte.map((value) => ({ value })), severity: 'warn' as const });
const teilLabel = (pfad: string[]) => pfad.map((k) => TEIL_LABEL[k] ?? k).join(' – ');
const feldId = (el: string, pfad: string[]) => [KATALOG_PRAEFIX + el, ...pfad].join('_');

interface Abbildung { el: KatalogElement; art: 'liste' | 'blatt' | 'status' | 'fundstellen'; pfad: string[]; blaetter?: Blatt[] }

/** Feld-ID → wie der Wert aus `vertrag.katalog` gelesen wird. */
function abbildungen(): Map<string, Abbildung> {
  const out = new Map<string, Abbildung>();
  for (const el of Object.keys(KATALOG_WERTE) as KatalogElement[]) {
    const s = KATALOG_WERTE[el] as Schema;
    if (hatTyp(s, 'array') && s.items) {
      out.set(feldId(el, []), { el, art: 'liste', pfad: [], blaetter: blaetter(s.items) });
    } else {
      const bs = blaetter(s);
      // Elemente aus nur einem Text (`{ text }`) heissen schlicht wie das Element.
      if (bs.length === 1 && bs[0]!.pfad.join() === 'text') out.set(feldId(el, []), { el, art: 'blatt', pfad: ['text'], blaetter: bs });
      else for (const b of bs) out.set(feldId(el, b.pfad), { el, art: 'blatt', pfad: b.pfad, blaetter: [b] });
    }
    out.set(feldId(el, ['status']), { el, art: 'status', pfad: [] });
    out.set(feldId(el, ['fundstellen']), { el, art: 'fundstellen', pfad: [] });
  }
  return out;
}

const ABBILDUNGEN = abbildungen();

/** Die Katalogfelder in Profilform (Reihenfolge: je Element Status, Werte, Fundstellen). */
export function katalogFelder(): Record<string, ProjectField> {
  const felder: Record<string, ProjectField> = {};
  for (const el of Object.keys(KATALOG_WERTE) as KatalogElement[]) {
    const name = KATALOG_LABEL[el];
    felder[feldId(el, ['status'])] = {
      type: 'text', required: false, label: `${name}: Status`, group: KATALOG_GRUPPE,
      description: `Ob und wie „${name}" im Vertrag geregelt ist. ${STATUS_BESCHREIBUNG}`, catalog: werteliste(KATALOG_STATUS),
    };
    for (const [id, a] of ABBILDUNGEN) {
      if (a.el !== el || (a.art !== 'liste' && a.art !== 'blatt')) continue;
      if (a.art === 'liste') {
        felder[id] = {
          type: 'list', required: false, label: name, group: KATALOG_GRUPPE,
          item_fields: Object.fromEntries(a.blaetter!.map((b) => {
            const t = blattTyp(b);
            return [b.pfad.join('_'), { type: t.type, label: teilLabel(b.pfad), ...(t.werte ? { catalog: werteliste(t.werte) } : {}) }];
          })),
        };
      } else {
        const t = blattTyp(a.blaetter![0]!);
        felder[id] = {
          type: t.type, required: false, group: KATALOG_GRUPPE,
          label: a.pfad.join() === 'text' ? name : `${name}: ${teilLabel(a.pfad)}`,
          ...(t.werte ? { catalog: werteliste(t.werte) } : {}),
        };
      }
    }
    felder[feldId(el, ['fundstellen'])] = {
      type: 'text', required: false, label: `${name}: Fundstellen`, group: KATALOG_GRUPPE,
      description: 'Klausel-IDs im Vertrag, z. B. „§6.3, Anl1"',
    };
  }
  return felder;
}

export const istKatalogFeld = (id: string) => id.startsWith(KATALOG_PRAEFIX) && ABBILDUNGEN.has(id);
export const istVertragsprofil = (p: Pick<ExtractionProject, 'extraction'>) => p.extraction?.strategy === 'contract-structured';

/** Profil beim Laden: Vertragsprofile bekommen die Katalogfelder (hinter den eigenen Feldern). */
export function mitKatalogFeldern<T extends Pick<ExtractionProject, 'fields' | 'extraction'>>(p: T): T {
  if (!istVertragsprofil(p)) return p;
  return { ...p, fields: { ...ohneKatalogFelder(p.fields), ...katalogFelder() } };
}

/** Vor dem Speichern: Katalogfelder entfernen — sie kommen immer aus dem Code. */
export function ohneKatalogFelder(fields: ExtractionProject['fields']): ExtractionProject['fields'] {
  return Object.fromEntries(Object.entries(fields).filter(([id]) => !istKatalogFeld(id)));
}

const lese = (x: unknown, pfad: string[]): unknown => pfad.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), x);
const flach = (v: unknown): unknown => (Array.isArray(v) ? (v.length ? v.map(String).join('; ') : null) : v ?? null);
const leer = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

/**
 * `vertrag.katalog` → flache Werte und Konfidenzen je Katalogfeld. Konfidenz ist eine Faustregel wie bei den
 * Erweiterungsfeldern (das Modell liefert keine je Element): Status 0,85; Werte 0,85 bei „gefunden" mit Fundstelle,
 * sonst 0,6; leere Werte 0.
 */
export function katalogWerte(katalog: Partial<Record<KatalogElement, KatalogWert>>): { werte: Record<string, unknown>; konfidenz: Record<string, number> } {
  const werte: Record<string, unknown> = {};
  const konfidenz: Record<string, number> = {};
  for (const [id, a] of ABBILDUNGEN) {
    const k = katalog[a.el];
    let v: unknown;
    if (a.art === 'status') v = k?.status ?? 'nicht_geregelt';
    else if (a.art === 'fundstellen') v = k?.klauseln?.length ? k.klauseln.join(', ') : null;
    else if (!k || k.status === 'nicht_geregelt') v = a.art === 'liste' ? [] : null;
    else if (a.art === 'liste') {
      v = (Array.isArray(k.wert) ? k.wert : []).map((item) => Object.fromEntries(a.blaetter!.map((b) => [b.pfad.join('_'), flach(lese(item, b.pfad))])));
    } else v = flach(lese(k.wert, a.pfad));
    werte[id] = v;
    konfidenz[id] = leer(v) ? 0 : a.art === 'status' ? 0.85 : k?.status === 'gefunden' && k.klauseln?.length ? 0.85 : 0.6;
  }
  return { werte, konfidenz };
}
