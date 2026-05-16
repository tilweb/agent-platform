/**
 * Lessons-Learned-Service — Phase E (demo/messe / YAML-Variante).
 *
 * Sub-Resource am Projektauftrag (= Projekt-ID nach Phase A). CRUD via YAML
 * unter data/apps/projektmanagement/projektauftraege/{id}/lessons-learned/
 * {ll-id}.yaml (analog Statusberichte). Suggest-Endpoint ruft den LLM-Coach
 * und gibt Vorschlaege zurueck.
 */

import { parse, stringify } from 'yaml';
import { withLock, VersionConflictError } from './concurrency';
import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import type {
  LessonLearned,
  LessonLearnedCreateInput,
  LessonLearnedUpdateInput,
  LessonLearnedSuggestion,
  Statusbericht,
  Projektauftrag,
} from './types';

const BASE_PATH = './data/apps/projektmanagement';
const AUFTRAEGE_PATH = `${BASE_PATH}/projektauftraege`;

function llDir(paId: string): string {
  return `${AUFTRAEGE_PATH}/${paId}/lessons-learned`;
}

export function generateLessonLearnedId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ll-${timestamp}-${random}`;
}

function normalize(raw: any): LessonLearned {
  return {
    id: raw.id,
    paId: raw.paId,
    title: raw.title ?? '',
    themengebiet: raw.themengebiet ?? 'basis',
    kategorie: raw.kategorie ?? 'strength',
    beschreibung: raw.beschreibung ?? '',
    auswirkung: raw.auswirkung ?? '',
    empfehlung: raw.empfehlung ?? '',
    version: typeof raw.version === 'number' ? raw.version : 1,
    createdBy: raw.createdBy ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// ============== CRUD ==============

export async function listLessonsLearned(paId: string): Promise<LessonLearned[]> {
  const dir = llDir(paId);
  const lessons: LessonLearned[] = [];
  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(dir)) {
      const file = Bun.file(`${dir}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        lessons.push(normalize(parse(content)));
      }
    }
  } catch {
    // Verzeichnis existiert noch nicht — leere Liste ist korrekt.
  }
  lessons.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return lessons;
}

export async function getLessonLearned(paId: string, llId: string): Promise<LessonLearned | null> {
  const file = Bun.file(`${llDir(paId)}/${llId}.yaml`);
  if (!(await file.exists())) return null;
  return normalize(parse(await file.text()));
}

export async function createLessonLearned(
  paId: string,
  input: LessonLearnedCreateInput,
  createdBy?: string,
): Promise<LessonLearned> {
  const id = generateLessonLearnedId();
  const now = new Date().toISOString();
  const lesson: LessonLearned = {
    id,
    paId,
    title: input.title,
    themengebiet: input.themengebiet ?? 'basis',
    kategorie: input.kategorie ?? 'strength',
    beschreibung: input.beschreibung ?? '',
    auswirkung: input.auswirkung ?? '',
    empfehlung: input.empfehlung ?? '',
    version: 1,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  return withLock(`lesson:${paId}:${id}`, async () => {
    await Bun.$`mkdir -p ${llDir(paId)}`;
    await Bun.write(`${llDir(paId)}/${id}.yaml`, stringify(lesson));
    return lesson;
  });
}

export async function updateLessonLearned(
  paId: string,
  llId: string,
  input: LessonLearnedUpdateInput,
): Promise<LessonLearned> {
  return withLock(`lesson:${paId}:${llId}`, async () => {
    const current = await getLessonLearned(paId, llId);
    if (!current) throw new Error(`Lesson Learned ${llId} nicht gefunden`);
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new VersionConflictError(current);
    }
    const next: LessonLearned = { ...current };
    if (input.title !== undefined) next.title = input.title;
    if (input.themengebiet !== undefined) next.themengebiet = input.themengebiet;
    if (input.kategorie !== undefined) next.kategorie = input.kategorie;
    if (input.beschreibung !== undefined) next.beschreibung = input.beschreibung;
    if (input.auswirkung !== undefined) next.auswirkung = input.auswirkung;
    if (input.empfehlung !== undefined) next.empfehlung = input.empfehlung;
    next.version = current.version + 1;
    next.updatedAt = new Date().toISOString();
    await Bun.write(`${llDir(paId)}/${llId}.yaml`, stringify(next));
    return next;
  });
}

export async function deleteLessonLearned(paId: string, llId: string): Promise<boolean> {
  return withLock(`lesson:${paId}:${llId}`, async () => {
    const file = Bun.file(`${llDir(paId)}/${llId}.yaml`);
    if (!(await file.exists())) return false;
    await Bun.$`rm -f ${llDir(paId)}/${llId}.yaml`;
    return true;
  });
}

// ============== KI-Vorschlaege ==============

export async function suggestLessonsLearnedFromStatusberichte(
  paId: string,
  triggeringUserId?: string,
): Promise<LessonLearnedSuggestion[]> {
  // Statusberichte laden — analog statusbericht-service.ts demo/messe
  const sbDir = `${AUFTRAEGE_PATH}/${paId}/statusberichte`;
  const berichte: Statusbericht[] = [];
  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(sbDir)) {
      const file = Bun.file(`${sbDir}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        berichte.push(parse(content) as Statusbericht);
      }
    }
  } catch {
    // Keine Statusberichte vorhanden — kein Material fuer Vorschlaege
  }
  if (berichte.length === 0) return [];

  // Juengste 5 Berichte
  berichte.sort((a, b) => b.nummer - a.nummer);
  const recent = berichte.slice(0, 5);

  // Projektname aus dem Auftrag holen
  const auftragFile = Bun.file(`${AUFTRAEGE_PATH}/${paId}/metadata.yaml`);
  let projektName = 'Unbenanntes Projekt';
  if (await auftragFile.exists()) {
    const auftrag = parse(await auftragFile.text()) as Projektauftrag;
    projektName = auftrag.name || projektName;
  }

  const summaries = recent.map((sb) => ({
    nummer: sb.nummer,
    datum: sb.datum,
    ampel: sb.ampel,
    management_summary: sb.management_summary,
    goals_bemerkung: sb.goals_tracking?.bemerkung,
    criteria_bemerkungen: (sb.criteria_tracking || []).map((c) => c.bemerkung).filter(Boolean),
    milestones_bemerkungen: (sb.milestones_tracking || []).map((m) => m.bemerkung).filter(Boolean),
    risiken: (sb.risk_tracking || []).map((r) => ({
      type: r.type,
      beschreibung: r.beschreibung,
      auswirkung: r.auswirkung,
      massnahmen: r.massnahmen,
      status: r.status,
    })),
  }));

  const prompt = buildSuggestPrompt(projektName, summaries);
  const messages: Message[] = [
    { role: 'system', content: 'Du bist ein PM-Coach. Antworte AUSSCHLIESSLICH mit valide formatiertem JSON. Keine Erklaerung drumherum.' },
    { role: 'user', content: prompt },
  ];
  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'extraction',
    operation: 'lessons_learned_suggest',
  };
  const response = await llmService.chat(messages, undefined, usageContext);
  return parseSuggestionResponse(response.content || '');
}

function buildSuggestPrompt(projektName: string, summaries: any[]): string {
  return `Leite aus den folgenden Statusberichten des Projekts "${projektName}" 3-7 Lessons Learned ab.

Jede Lesson Learned hat:
- title: kurzer Titel (max. 80 Zeichen)
- themengebiet: einer aus [basis, stakeholder, organisation, ziele, inhalt, roadmap, kosten, risiko, lessons_learned, projektidee, auftragsklaerung, umsetzung, projektabschluss]
- kategorie: SWOT-Klassifikation, einer aus [strength, weakness, opportunity, threat]
- beschreibung: "Worum geht es?" — 1-3 Saetze, konkret
- auswirkung: "Was ist die Folge?" — 1-2 Saetze
- empfehlung: "Was geben wir an andere weiter?" — 1-2 Saetze, generalisiert
- source: optional — z.B. "SB #3: Risiko XYZ"

Statusberichte (juengste zuerst):
${JSON.stringify(summaries, null, 2)}

Antworte als JSON-Objekt mit Schluessel "suggestions": [...]. Beispiel:
{
  "suggestions": [
    {
      "title": "Frueher Stakeholder-Workshop hat Anforderungen geschaerft",
      "themengebiet": "stakeholder",
      "kategorie": "strength",
      "beschreibung": "Der Kickoff-Workshop in Woche 2 hat die heterogenen Erwartungen frueh transparent gemacht.",
      "auswirkung": "Spaete Change-Requests wurden vermieden, der Scope blieb stabil.",
      "empfehlung": "Bei Projekten mit >3 Stakeholder-Gruppen einen Kickoff-Workshop in den ersten 2 Wochen einplanen.",
      "source": "SB #1: Stakeholder-Akzeptanz gruen"
    }
  ]
}`;
}

function parseSuggestionResponse(content: string): LessonLearnedSuggestion[] {
  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error(`LLM lieferte kein valides JSON: ${err instanceof Error ? err.message : err}`);
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  const items = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  return items
    .filter((s: any) => s && typeof s.title === 'string')
    .map((s: any) => ({
      title: String(s.title),
      themengebiet: typeof s.themengebiet === 'string' ? s.themengebiet : 'basis',
      kategorie: typeof s.kategorie === 'string' ? s.kategorie : 'strength',
      beschreibung: typeof s.beschreibung === 'string' ? s.beschreibung : '',
      auswirkung: typeof s.auswirkung === 'string' ? s.auswirkung : '',
      empfehlung: typeof s.empfehlung === 'string' ? s.empfehlung : '',
      source: typeof s.source === 'string' ? s.source : undefined,
    }));
}
