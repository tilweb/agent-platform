/**
 * Lessons-Learned-Service — Phase E.
 *
 * Sub-Resource am Projektauftrag (= Projekt-ID nach Phase A). CRUD analog
 * Statusberichte, plus ein Suggest-Endpoint, der auf Basis der letzten
 * Statusberichte LL-Vorschlaege via LLM ableitet.
 *
 * Permissions erbt vom Auftrag — Editor+ darf alles, Viewer nur lesen.
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { paLessonsLearned, paStatusberichte, paProjektauftraege } from '../../db/schema/projektmgmt';
import { VersionConflictError } from './concurrency';
import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import type {
  LessonLearned,
  LessonLearnedCreateInput,
  LessonLearnedUpdateInput,
  LessonLearnedSuggestion,
  Statusbericht,
} from './types';

export function generateLessonLearnedId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ll-${timestamp}-${random}`;
}

function rowToLesson(row: typeof paLessonsLearned.$inferSelect): LessonLearned {
  return {
    id: row.id,
    paId: row.paId,
    title: row.title,
    themengebiet: row.themengebiet,
    kategorie: row.kategorie,
    beschreibung: row.beschreibung,
    auswirkung: row.auswirkung,
    empfehlung: row.empfehlung,
    version: row.version,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ============== CRUD ==============

export async function listLessonsLearned(paId: string): Promise<LessonLearned[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paLessonsLearned)
    .where(eq(paLessonsLearned.paId, paId))
    .orderBy(desc(paLessonsLearned.createdAt));
  return rows.map(rowToLesson);
}

export async function getLessonLearned(paId: string, llId: string): Promise<LessonLearned | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paLessonsLearned)
    .where(and(eq(paLessonsLearned.paId, paId), eq(paLessonsLearned.id, llId)))
    .limit(1);
  return rows[0] ? rowToLesson(rows[0]) : null;
}

export async function createLessonLearned(
  paId: string,
  input: LessonLearnedCreateInput,
  createdBy?: string,
): Promise<LessonLearned> {
  const db = getDb();
  const id = generateLessonLearnedId();
  await db.insert(paLessonsLearned).values({
    id,
    paId,
    title: input.title,
    themengebiet: input.themengebiet ?? 'basis',
    kategorie: input.kategorie ?? 'strength',
    beschreibung: input.beschreibung ?? '',
    auswirkung: input.auswirkung ?? '',
    empfehlung: input.empfehlung ?? '',
    version: 1,
    createdBy: createdBy ?? null,
  });
  const created = await getLessonLearned(paId, id);
  if (!created) throw new Error(`Lesson Learned ${id} verschwand nach Insert`);
  return created;
}

export async function updateLessonLearned(
  paId: string,
  llId: string,
  input: LessonLearnedUpdateInput,
): Promise<LessonLearned> {
  const db = getDb();
  const current = await getLessonLearned(paId, llId);
  if (!current) throw new Error(`Lesson Learned ${llId} nicht gefunden`);
  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new VersionConflictError(
      `Lesson Learned ${llId}: version conflict (expected ${input.expectedVersion}, got ${current.version})`,
    );
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.themengebiet !== undefined) patch.themengebiet = input.themengebiet;
  if (input.kategorie !== undefined) patch.kategorie = input.kategorie;
  if (input.beschreibung !== undefined) patch.beschreibung = input.beschreibung;
  if (input.auswirkung !== undefined) patch.auswirkung = input.auswirkung;
  if (input.empfehlung !== undefined) patch.empfehlung = input.empfehlung;

  const result = await db
    .update(paLessonsLearned)
    .set(patch as never)
    .where(and(
      eq(paLessonsLearned.paId, paId),
      eq(paLessonsLearned.id, llId),
      eq(paLessonsLearned.version, current.version),
    ))
    .returning({ id: paLessonsLearned.id });

  if (result.length === 0) {
    throw new VersionConflictError(`Lesson Learned ${llId}: concurrent update`);
  }

  const updated = await getLessonLearned(paId, llId);
  if (!updated) throw new Error(`Lesson Learned ${llId} verschwand nach Update`);
  return updated;
}

export async function deleteLessonLearned(paId: string, llId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(paLessonsLearned)
    .where(and(eq(paLessonsLearned.paId, paId), eq(paLessonsLearned.id, llId)))
    .returning({ id: paLessonsLearned.id });
  return result.length > 0;
}

// ============== KI-Vorschlaege ==============

/**
 * Erzeugt LL-Vorschlaege aus den letzten Statusberichten via LLM.
 *
 * Strategie:
 *   - Lade die letzten 5 Statusberichte (sortiert nach Datum absteigend)
 *   - Extrahiere relevante Felder (Management-Summary, Goals-Tracking-Bemerkungen,
 *     Roadmap-Bemerkungen, Risiko-Bemerkungen + Status)
 *   - Bitte das LLM, daraus 3-7 SWOT-orientierte Lessons Learned abzuleiten
 *   - Parse JSON-Response in LessonLearnedSuggestion[]
 *
 * Wirft, wenn LLM kaputt ist — Frontend zeigt Fehler an. Keine LL-Vorschlaege
 * werden persistiert; der User entscheidet pro Vorschlag, ob er ihn als
 * echte Lesson Learned anlegt.
 */
export async function suggestLessonsLearnedFromStatusberichte(
  paId: string,
  triggeringUserId?: string,
): Promise<LessonLearnedSuggestion[]> {
  const db = getDb();
  const sbRows = await db
    .select()
    .from(paStatusberichte)
    .where(eq(paStatusberichte.paId, paId))
    .orderBy(desc(paStatusberichte.reportDate))
    .limit(5);

  if (sbRows.length === 0) {
    return [];
  }

  const auftragRows = await db
    .select()
    .from(paProjektauftraege)
    .where(eq(paProjektauftraege.id, paId))
    .limit(1);
  const projektName = auftragRows[0]?.name ?? 'Unbenanntes Projekt';

  const summaries = sbRows.map((row) => {
    const data = row.data as unknown as Statusbericht;
    return {
      nummer: data.nummer,
      datum: data.datum,
      ampel: data.ampel,
      management_summary: data.management_summary,
      goals_bemerkung: data.goals_tracking?.bemerkung,
      criteria_bemerkungen: (data.criteria_tracking || []).map((c) => c.bemerkung).filter(Boolean),
      milestones_bemerkungen: (data.milestones_tracking || []).map((m) => m.bemerkung).filter(Boolean),
      risiken: (data.risk_tracking || []).map((r) => ({
        type: r.type,
        beschreibung: r.beschreibung,
        auswirkung: r.auswirkung,
        massnahmen: r.massnahmen,
        status: r.status,
      })),
    };
  });

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
  // LLMs verpacken JSON oft in ```json ... ``` Fences. Entfernen.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    // Letzter Versuch: ersten { bis letzten } extrahieren
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
