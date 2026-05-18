/**
 * Abschlussbericht-Service — Phase F (demo/messe / YAML-Variante).
 *
 * 1:1 Sub-Resource am Projektauftrag. YAML-Storage als 1-File:
 *   data/apps/projektmanagement/projektauftraege/{id}/abschlussbericht.yaml
 *
 * Pre-Fill aus letztem Statusbericht + Projektauftrag-Feldern.
 */

import { parse, stringify } from 'yaml';
import { withLock, VersionConflictError } from './concurrency';
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

const BASE_PATH = './data/apps/projektmanagement';
const AUFTRAEGE_PATH = `${BASE_PATH}/projektauftraege`;

function berichtPath(paId: string): string {
  return `${AUFTRAEGE_PATH}/${paId}/abschlussbericht.yaml`;
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `abschluss-${timestamp}-${random}`;
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

function normalize(raw: any): Abschlussbericht {
  const data = { ...emptyData(), ...(raw.data || {}) };
  return {
    id: raw.id,
    paId: raw.paId,
    data,
    status: raw.status === 'final' ? 'final' : 'draft',
    finalizedAt: raw.finalizedAt ?? undefined,
    version: typeof raw.version === 'number' ? raw.version : 1,
    createdBy: raw.createdBy ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function loadAuftrag(paId: string): Promise<Projektauftrag | null> {
  const file = Bun.file(`${AUFTRAEGE_PATH}/${paId}/metadata.yaml`);
  if (!(await file.exists())) return null;
  return parse(await file.text()) as Projektauftrag;
}

async function pickPrefillSb(paId: string): Promise<Statusbericht | null> {
  const dir = `${AUFTRAEGE_PATH}/${paId}/statusberichte`;
  const berichte: Statusbericht[] = [];
  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(dir)) {
      const file = Bun.file(`${dir}/${path}`);
      if (await file.exists()) {
        berichte.push(parse(await file.text()) as Statusbericht);
      }
    }
  } catch {
    // Verzeichnis fehlt → keine SBs
  }
  if (berichte.length === 0) return null;
  berichte.sort((a, b) => b.nummer - a.nummer);
  return berichte.find((b) => b.status === 'final') ?? berichte[0] ?? null;
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
  const file = Bun.file(berichtPath(paId));
  if (!(await file.exists())) return null;
  return normalize(parse(await file.text()));
}

export async function createAbschlussbericht(
  paId: string,
  input: AbschlussberichtCreateInput,
  createdBy?: string,
): Promise<Abschlussbericht> {
  return withLock(`abschluss:${paId}`, async () => {
    const existing = await getAbschlussbericht(paId);
    if (existing) throw new Error('Abschlussbericht existiert bereits');

    const sb = await pickPrefillSb(paId);
    const auftrag = await loadAuftrag(paId);
    const data = buildPrefillData(sb, auftrag, input.overrides ?? {});
    const now = new Date().toISOString();
    const bericht: Abschlussbericht = {
      id: generateId(),
      paId,
      data,
      status: 'draft',
      finalizedAt: undefined,
      version: 1,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
    await Bun.$`mkdir -p ${AUFTRAEGE_PATH}/${paId}`;
    await Bun.write(berichtPath(paId), stringify(bericht));
    return bericht;
  });
}

export async function updateAbschlussbericht(
  paId: string,
  input: AbschlussberichtUpdateInput,
): Promise<Abschlussbericht> {
  return withLock(`abschluss:${paId}`, async () => {
    const current = await getAbschlussbericht(paId);
    if (!current) throw new Error('Abschlussbericht nicht gefunden');
    if (current.status === 'final') {
      throw new Error('Abschlussbericht ist final — bitte erst wiedereroeffnen');
    }
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new VersionConflictError(current);
    }
    const next: Abschlussbericht = {
      ...current,
      data: { ...current.data, ...(input.data ?? {}) },
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await Bun.write(berichtPath(paId), stringify(next));
    return next;
  });
}

export async function deleteAbschlussbericht(paId: string): Promise<boolean> {
  return withLock(`abschluss:${paId}`, async () => {
    const file = Bun.file(berichtPath(paId));
    if (!(await file.exists())) return false;
    await Bun.$`rm -f ${berichtPath(paId)}`;
    return true;
  });
}

// ============== Status-Transitions ==============

export async function finalizeAbschlussbericht(
  paId: string,
  expectedVersion?: number,
): Promise<Abschlussbericht> {
  return withLock(`abschluss:${paId}`, async () => {
    const current = await getAbschlussbericht(paId);
    if (!current) throw new Error('Abschlussbericht nicht gefunden');
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new VersionConflictError(current);
    }
    if (current.status === 'final') return current;
    const now = new Date().toISOString();
    const next: Abschlussbericht = {
      ...current,
      status: 'final',
      finalizedAt: now,
      version: current.version + 1,
      updatedAt: now,
    };
    await Bun.write(berichtPath(paId), stringify(next));
    return next;
  });
}

export async function reopenAbschlussbericht(
  paId: string,
  expectedVersion?: number,
): Promise<Abschlussbericht> {
  return withLock(`abschluss:${paId}`, async () => {
    const current = await getAbschlussbericht(paId);
    if (!current) throw new Error('Abschlussbericht nicht gefunden');
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new VersionConflictError(current);
    }
    if (current.status === 'draft') return current;
    const next: Abschlussbericht = {
      ...current,
      status: 'draft',
      finalizedAt: undefined,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await Bun.write(berichtPath(paId), stringify(next));
    return next;
  });
}

// ============== KI-Entwurf ==============

export async function suggestAbschlussDraft(
  paId: string,
  triggeringUserId?: string,
): Promise<AbschlussberichtSuggestion | null> {
  // letzte 5 SBs
  const dir = `${AUFTRAEGE_PATH}/${paId}/statusberichte`;
  const berichte: Statusbericht[] = [];
  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(dir)) {
      const file = Bun.file(`${dir}/${path}`);
      if (await file.exists()) {
        berichte.push(parse(await file.text()) as Statusbericht);
      }
    }
  } catch {
    // ignore
  }
  berichte.sort((a, b) => b.nummer - a.nummer);
  const recent = berichte.slice(0, 5);

  // LL des Projekts
  const llDir = `${AUFTRAEGE_PATH}/${paId}/lessons-learned`;
  const lessons: LessonLearned[] = [];
  try {
    const glob = new Bun.Glob('*.yaml');
    for await (const path of glob.scan(llDir)) {
      const file = Bun.file(`${llDir}/${path}`);
      if (await file.exists()) {
        lessons.push(parse(await file.text()) as LessonLearned);
      }
    }
  } catch {
    // ignore
  }

  if (recent.length === 0 && lessons.length === 0) return null;

  const auftrag = await loadAuftrag(paId);
  const projektName = auftrag?.name ?? 'Unbenanntes Projekt';

  const sbSummaries = recent.map((sb) => ({
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
  }));

  const llHighlights = lessons.map((l) => ({
    title: l.title,
    themengebiet: l.themengebiet,
    kategorie: l.kategorie,
    empfehlung: l.empfehlung,
  }));

  const prompt = buildPrompt(projektName, auftrag ?? undefined, sbSummaries, llHighlights);
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

Antworte als JSON-Objekt:
{
  "management_summary": "...",
  "key_findings": "...",
  "folgeprojekt_empfehlung": "..."
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
