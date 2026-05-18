/**
 * Abschlussbericht-Service — Phase F.
 *
 * 1:1 Sub-Resource am Projektauftrag (= Projekt-ID nach Phase A). Vorbefuellt
 * aus dem letzten Statusbericht + Projektauftrag-Feldern. Status-Modell
 * 'draft' → 'final'; bei Final-Wechsel setzt der Service `finalized_at` und
 * meldet via Return, dass das Frontend einen Projekt-Lifecycle-Modal anbieten
 * soll.
 *
 * Permissions erben vom Auftrag — analog Statusberichte + Lessons Learned.
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  paAbschlussberichte,
  paStatusberichte,
  paProjektauftraege,
  paLessonsLearned,
} from '../../db/schema/projektmgmt';
import { VersionConflictError } from './concurrency';
import { llmService, type Message } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { withLlmTimeout } from './llm-utils';
import type {
  Abschlussbericht,
  AbschlussberichtData,
  AbschlussberichtCreateInput,
  AbschlussberichtUpdateInput,
  AbschlussberichtSuggestion,
  Statusbericht,
  Projektauftrag,
  LessonLearned,
} from './types';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `abschluss-${timestamp}-${random}`;
}

function rowToBericht(row: typeof paAbschlussberichte.$inferSelect): Abschlussbericht {
  return {
    id: row.id,
    paId: row.paId,
    data: row.data as AbschlussberichtData,
    status: (row.status === 'final' ? 'final' : 'draft'),
    finalizedAt: row.finalizedAt ?? undefined,
    version: row.version,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function emptyData(): AbschlussberichtData {
  return {
    ampel: 'gruen',
    datum: new Date().toISOString().slice(0, 10),
    management_summary: '',
    goals_snapshot: '',
    goals_tracking: { fortschritt: 0, ampel: 'gruen', bemerkung: '' },
    criteria_snapshot: [],
    criteria_tracking: [],
    milestones_snapshot: [],
    milestones_tracking: [],
    tasks_snapshot: [],
    tasks_tracking: [],
    quality_gates_snapshot: [],
    quality_gates_tracking: [],
    cost_budget: 0,
    cost_months: [],
    risk_tracking: [],
    risks_plan: [],
    in_scope: [],
    out_scope: [],
    stakeholders_snapshot: [],
    organization_snapshot: [],
    budget_plan: [],
    key_findings: '',
    stakeholder_akzeptanz: [],
    uebergabe_an: '',
    uebergabe_datum: '',
    uebergabe_inhalte: '',
    folgeprojekt_empfehlung: '',
    abnahme_durch: '',
    abnahme_datum: '',
    abnahme_signiert: false,
  };
}

/**
 * Ermittelt den letzten Statusbericht fuer Pre-Fill. Bevorzugt finale Berichte,
 * faellt sonst auf den neuesten zurueck.
 */
async function pickPrefillSb(paId: string): Promise<Statusbericht | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paStatusberichte)
    .where(eq(paStatusberichte.paId, paId))
    .orderBy(desc(paStatusberichte.reportDate));
  if (rows.length === 0) return null;
  const datas = rows.map((r) => r.data as unknown as Statusbericht);
  // Bevorzugt finale; sonst neuester (= rows[0]).
  return datas.find((d) => d.status === 'final') ?? datas[0] ?? null;
}

function buildPrefillData(
  sb: Statusbericht | null,
  auftrag: Projektauftrag | null,
  overrides: Partial<AbschlussberichtData> = {},
): AbschlussberichtData {
  const base = emptyData();
  if (sb) {
    base.ampel = sb.ampel;
    base.management_summary = sb.management_summary || '';
    base.goals_snapshot = sb.goals_snapshot || '';
    base.goals_tracking = sb.goals_tracking || base.goals_tracking;
    base.criteria_snapshot = sb.criteria_snapshot || [];
    base.criteria_tracking = sb.criteria_tracking || [];
    base.milestones_snapshot = sb.milestones_snapshot || [];
    base.milestones_tracking = sb.milestones_tracking || [];
    base.tasks_snapshot = sb.tasks_snapshot || [];
    base.tasks_tracking = sb.tasks_tracking || [];
    base.quality_gates_snapshot = sb.quality_gates_snapshot || [];
    base.quality_gates_tracking = sb.quality_gates_tracking || [];
    base.cost_budget = sb.cost_budget || 0;
    base.cost_months = sb.cost_months || [];
    base.risk_tracking = sb.risk_tracking || [];
  }
  if (auftrag) {
    base.project_type = auftrag.project_type;
    base.auftraggeber = auftrag.auftraggeber;
    base.description = auftrag.description;
    base.start_date_plan = auftrag.start_date;
    base.end_date_plan = auftrag.end_date;
    base.scope = auftrag.scope;
    base.in_scope = auftrag.in_scope || [];
    base.out_scope = auftrag.out_scope || [];
    base.stakeholders_snapshot = auftrag.stakeholders || [];
    base.organization_snapshot = auftrag.organization || [];
    base.budget_plan = auftrag.budget || [];
    base.risks_plan = auftrag.risks || [];
    // Stakeholder-Akzeptanz: einen Eintrag pro Stakeholder vorbereiten (gelb = "noch zu bewerten")
    base.stakeholder_akzeptanz = (auftrag.stakeholders || []).map((s) => ({
      stakeholder_id: s.id,
      name: s.name,
      bewertung: 'gelb',
      bemerkung: '',
    }));
  }
  return { ...base, ...overrides };
}

// ============== CRUD ==============

export async function getAbschlussbericht(paId: string): Promise<Abschlussbericht | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paAbschlussberichte)
    .where(eq(paAbschlussberichte.paId, paId))
    .limit(1);
  return rows[0] ? rowToBericht(rows[0]) : null;
}

export async function createAbschlussbericht(
  paId: string,
  input: AbschlussberichtCreateInput,
  createdBy?: string,
): Promise<Abschlussbericht> {
  const db = getDb();

  // 1:1-Constraint: existiert schon einer?
  const existing = await getAbschlussbericht(paId);
  if (existing) {
    throw new Error('Abschlussbericht existiert bereits');
  }

  // Pre-Fill aus letztem SB + Auftrag
  const sb = await pickPrefillSb(paId);
  const auftragRows = await db.select().from(paProjektauftraege).where(eq(paProjektauftraege.id, paId)).limit(1);
  const auftrag = auftragRows[0]?.data as Projektauftrag | undefined;

  const data = buildPrefillData(sb, auftrag ?? null, input.overrides ?? {});
  const id = generateId();

  await db.insert(paAbschlussberichte).values({
    id,
    paId,
    data: data as never,
    status: 'draft',
    version: 1,
    createdBy: createdBy ?? null,
  });

  const created = await getAbschlussbericht(paId);
  if (!created) throw new Error(`Abschlussbericht ${id} verschwand nach Insert`);
  return created;
}

export async function updateAbschlussbericht(
  paId: string,
  input: AbschlussberichtUpdateInput,
): Promise<Abschlussbericht> {
  const db = getDb();
  const current = await getAbschlussbericht(paId);
  if (!current) throw new Error(`Abschlussbericht nicht gefunden`);
  if (current.status === 'final') {
    throw new Error('Abschlussbericht ist final — bitte erst wiedereroeffnen');
  }
  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new VersionConflictError(current);
  }

  const mergedData: AbschlussberichtData = { ...current.data, ...(input.data ?? {}) };

  const result = await db
    .update(paAbschlussberichte)
    .set({
      data: mergedData as never,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    } as never)
    .where(and(eq(paAbschlussberichte.paId, paId), eq(paAbschlussberichte.version, current.version)))
    .returning({ id: paAbschlussberichte.id });

  if (result.length === 0) {
    const latest = await getAbschlussbericht(paId);
    throw new VersionConflictError(latest ?? current);
  }

  const updated = await getAbschlussbericht(paId);
  if (!updated) throw new Error('Abschlussbericht verschwand nach Update');
  return updated;
}

export async function deleteAbschlussbericht(paId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(paAbschlussberichte)
    .where(eq(paAbschlussberichte.paId, paId))
    .returning({ id: paAbschlussberichte.id });
  return result.length > 0;
}

// ============== Status-Transitions ==============

export async function finalizeAbschlussbericht(paId: string): Promise<Abschlussbericht> {
  const db = getDb();
  const current = await getAbschlussbericht(paId);
  if (!current) throw new Error('Abschlussbericht nicht gefunden');
  if (current.status === 'final') return current;
  const result = await db
    .update(paAbschlussberichte)
    .set({
      status: 'final',
      finalizedAt: new Date().toISOString(),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    } as never)
    .where(and(eq(paAbschlussberichte.paId, paId), eq(paAbschlussberichte.version, current.version)))
    .returning({ id: paAbschlussberichte.id });
  if (result.length === 0) {
    const latest = await getAbschlussbericht(paId);
    throw new VersionConflictError(latest ?? current);
  }
  const finalized = await getAbschlussbericht(paId);
  if (!finalized) throw new Error('Abschlussbericht verschwand nach Finalize');
  return finalized;
}

export async function reopenAbschlussbericht(paId: string): Promise<Abschlussbericht> {
  const db = getDb();
  const current = await getAbschlussbericht(paId);
  if (!current) throw new Error('Abschlussbericht nicht gefunden');
  if (current.status === 'draft') return current;
  const result = await db
    .update(paAbschlussberichte)
    .set({
      status: 'draft',
      finalizedAt: null,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    } as never)
    .where(and(eq(paAbschlussberichte.paId, paId), eq(paAbschlussberichte.version, current.version)))
    .returning({ id: paAbschlussberichte.id });
  if (result.length === 0) {
    const latest = await getAbschlussbericht(paId);
    throw new VersionConflictError(latest ?? current);
  }
  const reopened = await getAbschlussbericht(paId);
  if (!reopened) throw new Error('Abschlussbericht verschwand nach Reopen');
  return reopened;
}

// ============== KI-Entwurf ==============

export async function suggestAbschlussDraft(
  paId: string,
  triggeringUserId?: string,
): Promise<AbschlussberichtSuggestion | null> {
  const db = getDb();

  const sbRows = await db
    .select()
    .from(paStatusberichte)
    .where(eq(paStatusberichte.paId, paId))
    .orderBy(desc(paStatusberichte.reportDate))
    .limit(5);
  const auftragRows = await db.select().from(paProjektauftraege).where(eq(paProjektauftraege.id, paId)).limit(1);
  const llRows = await db
    .select()
    .from(paLessonsLearned)
    .where(eq(paLessonsLearned.paId, paId))
    .orderBy(desc(paLessonsLearned.createdAt));

  if (sbRows.length === 0 && llRows.length === 0) return null;

  const auftrag = auftragRows[0]?.data as Projektauftrag | undefined;
  const projektName = auftrag?.name ?? 'Unbenanntes Projekt';

  const sbSummaries = sbRows.map((row) => {
    const sb = row.data as unknown as Statusbericht;
    return {
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
        status: r.status,
        massnahmen: r.massnahmen,
      })),
    };
  });

  const lessons = llRows.map((r) => ({
    title: r.title,
    themengebiet: r.themengebiet,
    kategorie: r.kategorie,
    empfehlung: r.empfehlung,
  })) as Array<Pick<LessonLearned, 'title' | 'themengebiet' | 'kategorie' | 'empfehlung'>>;

  const prompt = buildPrompt(projektName, auftrag, sbSummaries, lessons);
  const messages: Message[] = [
    { role: 'system', content: 'Du bist ein PMO-Berater für Projektabschlüsse. Antworte AUSSCHLIESSLICH mit valide formatiertem JSON. Keine Erklärung drumherum. WICHTIG: Schreibe die Texte in korrektem Deutsch mit Umlauten (ä, ö, ü, ß) — NICHT in ASCII-Ersatzschreibung (ae/oe/ue/ss).' },
    { role: 'user', content: prompt },
  ];
  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'extraction',
    operation: 'abschlussbericht_suggest',
  };
  const response = await withLlmTimeout(
    llmService.chat(messages, undefined, usageContext),
    'abschlussbericht_suggest',
  );
  return parseSuggestResponse(response.content || '');
}

function buildPrompt(
  projektName: string,
  auftrag: Projektauftrag | undefined,
  sbSummaries: any[],
  lessons: any[],
): string {
  return `Erstelle einen Initial-Entwurf für den Abschlussbericht des Projekts "${projektName}".

Liefere drei Textfelder:
- management_summary: 3-6 Sätze, professioneller Management-Ton, konsolidiert die wichtigsten Erkenntnisse aus den Statusberichten über die Projektlaufzeit.
- key_findings: 3-5 Aufzählungspunkte, jeweils 1-2 Sätze. Fokus: Wo standen wir am Ende vs. Plan? (Termine, Kosten, Scope, Risiken).
- folgeprojekt_empfehlung: 2-4 Sätze, konkrete Hinweise für Folgeprojekte mit ähnlicher Charakteristik.

Projektauftrag (Highlights):
${auftrag ? JSON.stringify({
  goals: auftrag.goals,
  scope: auftrag.scope,
  start_date: auftrag.start_date,
  end_date: auftrag.end_date,
  risks_plan: (auftrag.risks || []).map((r) => ({ description: r.description, mitigation: r.mitigation })),
}, null, 2) : '(kein Auftrag verfuegbar)'}

Statusberichte (juengste zuerst):
${JSON.stringify(sbSummaries, null, 2)}

Lessons Learned aus diesem Projekt:
${JSON.stringify(lessons, null, 2)}

Antworte als JSON-Objekt. Beispiel:
{
  "management_summary": "Das Projekt 'X' wurde planmaessig abgeschlossen; der Scope blieb stabil...",
  "key_findings": "- Terminziel mit 5 Tagen Puffer erreicht\\n- Budget um 3% überschritten...",
  "folgeprojekt_empfehlung": "Bei ähnlich gelagerten Vorhaben empfehlen wir..."
}`;
}

function parseSuggestResponse(content: string): AbschlussberichtSuggestion | null {
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
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    management_summary: typeof parsed.management_summary === 'string' ? parsed.management_summary : '',
    key_findings: typeof parsed.key_findings === 'string' ? parsed.key_findings : '',
    folgeprojekt_empfehlung: typeof parsed.folgeprojekt_empfehlung === 'string' ? parsed.folgeprojekt_empfehlung : '',
  };
}
