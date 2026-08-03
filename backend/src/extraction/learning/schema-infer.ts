/**
 * Schema-Inferenz beim Onboarding (Welle 5).
 *
 * Der Einstieg in ein neues Extraktionsprojekt war bisher reine Handarbeit:
 * Feldliste tippen, Typen raten, Positionstabellen selbst modellieren. Hier
 * schlaegt ein LLM aus EINEM Beispieldokument die Feldliste vor — inklusive
 * Listen-Feld fuer Positionstabellen. Der Vorschlag ist ausdruecklich ein
 * Entwurf: Er landet im Feld-Editor und wird vom Anwender bearbeitet, bevor
 * das Projekt entsteht.
 *
 * `parseInferredFields` ist pur und testbar; der LLM-Call sitzt aussen.
 * Identisch in beiden Worktrees.
 */

import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { parseJsonObject } from '../../services/extraction/extract-call';
import { validateProjectFields } from './validators';
import { PROJECT_FIELD_GROUP } from './pipeline-adapter';
import type { ProjectField, ProjectItemField } from './types';

/** Obergrenze fuer einen Vorschlag — mehr Felder sind fuer den Einstieg unbrauchbar. */
const MAX_FIELDS = 30;
/** Obergrenze fuer Spalten einer Positions-Tabelle. */
const MAX_ITEM_FIELDS = 12;
/** Wieviel Dokumenttext das Modell sieht (Kosten/Kontext-Grenze). */
const MAX_DOC_CHARS = 12000;

const SCALAR_TYPES = new Set(['text', 'number', 'date', 'boolean']);

export interface InferredSchema {
  name: string;
  description: string;
  fields: Record<string, ProjectField>;
}

/** Feld-ID aus einem Label/Vorschlag: snake_case, nur a-z0-9_. */
export function slugifyFieldId(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function uniqueId(base: string, taken: Set<string>): string | null {
  const root = base || 'feld';
  if (!taken.has(root)) return root;
  for (let n = 2; n < 50; n += 1) {
    const candidate = `${root}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

function normalizeItemFields(raw: unknown): Record<string, ProjectItemField> {
  if (!Array.isArray(raw)) return {};
  const cols: Record<string, ProjectItemField> = {};
  const taken = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    if (!label) continue;
    const type = typeof e.type === 'string' ? e.type : 'text';
    if (!SCALAR_TYPES.has(type)) continue; // keine Listen in Listen
    const id = uniqueId(slugifyFieldId(typeof e.id === 'string' && e.id ? e.id : label), taken);
    if (!id) continue;
    taken.add(id);
    cols[id] = {
      type: type as ProjectItemField['type'],
      label,
      ...(typeof e.description === 'string' && e.description.trim() ? { description: e.description.trim() } : {}),
    };
    if (taken.size >= MAX_ITEM_FIELDS) break;
  }
  return cols;
}

/**
 * Freitext-Antwort des Modells → validierter Feldsatz. Alles Unbrauchbare wird
 * verworfen statt korrigiert: ein halbgarer Vorschlag ist schlimmer als ein
 * kleinerer, sauberer.
 */
export function parseInferredFields(raw: string | null | undefined): InferredSchema | null {
  const parsed = parseJsonObject(raw ?? '');
  if (!parsed) return null;

  const fieldsRaw = Array.isArray(parsed.fields) ? parsed.fields : null;
  if (!fieldsRaw) return null;

  const fields: Record<string, ProjectField> = {};
  const taken = new Set<string>([PROJECT_FIELD_GROUP]); // reserviert fuer die synthetische Gruppe
  for (const entry of fieldsRaw) {
    if (Object.keys(fields).length >= MAX_FIELDS) break;
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    if (!label) continue;

    const type = typeof e.type === 'string' ? e.type : 'text';
    if (type !== 'list' && !SCALAR_TYPES.has(type)) continue;

    const id = uniqueId(slugifyFieldId(typeof e.id === 'string' && e.id ? e.id : label), taken);
    if (!id) continue;

    if (type === 'list') {
      const itemFields = normalizeItemFields(e.item_fields);
      if (Object.keys(itemFields).length === 0) continue; // Liste ohne Spalten ist wertlos
      taken.add(id);
      fields[id] = {
        type: 'list',
        required: false, // Positionslisten nie als Pflicht vorschlagen
        label,
        ...(typeof e.description === 'string' && e.description.trim() ? { description: e.description.trim() } : {}),
        item_fields: itemFields,
      };
      continue;
    }

    taken.add(id);
    fields[id] = {
      type: type as ProjectField['type'],
      required: e.required === true,
      label,
      ...(typeof e.description === 'string' && e.description.trim() ? { description: e.description.trim() } : {}),
    };
  }

  if (Object.keys(fields).length === 0) return null;
  // Sicherheitsnetz: der Vorschlag muss die gleiche Struktur-Pruefung bestehen
  // wie ein handgebautes Schema.
  if (validateProjectFields(fields)) return null;

  return {
    name: typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 100) : '',
    description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 300) : '',
    fields,
  };
}

const SYSTEM_PROMPT = `Du bist Experte fuer Dokumentenverarbeitung. Aus einem Beispieldokument schlaegst du ein Extraktions-Schema vor: die Felder, die man aus SOLCHEN Dokumenten regelmaessig herausziehen will.

Regeln:
- Nur Felder, die in diesem Dokumenttyp typischerweise IMMER vorkommen — keine Zufallsdetails.
- 5 bis 15 Felder. Sprechende deutsche Labels.
- Typen: "text", "number", "date", "boolean" oder "list".
- Betraege/Mengen als "number" (ohne Waehrungszeichen), Datumsangaben als "date".
- Wiederholende Zeilen (Rechnungs-/Lieferschein-/Rezeptpositionen, Stuecklisten) als EIN Feld vom Typ "list" mit den Spalten in "item_fields" — nicht als pos1/pos2/pos3.
- "required": true nur fuer Felder, ohne die das Dokument unbrauchbar waere.
- "description": kurzer Hinweis an die KI, woran das Feld zu erkennen ist (optional).

Antworte NUR mit JSON, keine Erklaerung:
{
  "name": "<Vorschlag fuer den Projektnamen, z.B. 'Eingangsrechnungen'>",
  "description": "<ein Satz, welche Dokumente hier verarbeitet werden>",
  "fields": [
    {"id": "rechnungsnummer", "label": "Rechnungsnummer", "type": "text", "required": true, "description": "..."},
    {"id": "positionen", "label": "Positionen", "type": "list", "item_fields": [
      {"id": "bezeichnung", "label": "Bezeichnung", "type": "text"},
      {"id": "betrag", "label": "Betrag", "type": "number"}
    ]}
  ]
}`;

/**
 * Feldvorschlag aus einem Beispieldokument (ein LLM-Call). Wirft mit deutscher
 * Meldung, wenn kein brauchbarer Vorschlag herauskommt — der Aufrufer zeigt sie
 * direkt an.
 */
export async function inferSchema(documentText: string, userId?: string): Promise<InferredSchema> {
  const text = (documentText ?? '').trim();
  if (!text) {
    throw new Error('Kein Text im Dokument gefunden — bitte ein Dokument mit lesbarem Inhalt hochladen.');
  }

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Beispieldokument:\n\n${text.slice(0, MAX_DOC_CHARS)}` },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'infer_schema',
  };

  const response = await llmService.chat(messages, undefined, usageContext, { userId });
  const inferred = parseInferredFields(response.content);
  if (!inferred) {
    throw new Error('Die KI hat keinen verwertbaren Feldvorschlag geliefert — bitte die Felder manuell anlegen.');
  }
  return inferred;
}
