/**
 * Portfolio-Dashboard-Service — Phase D3.
 *
 * Aggregiert pro Portfolio:
 *  - Projekt-Counts (total / aktiv / abgeschlossen)
 *  - Health (Ampel-Mix aus letztem SB pro Projekt)
 *  - Phase-Mix (auftrag.project_status)
 *  - Budget-Performance (Plan vs Ist Summe ueber aktive Projekte)
 *  - Termine (on track / gefaehrdet / verspaetet)
 *  - Top-5-Risiken (Score = Wahrscheinlichkeit × Auswirkung, low=1/medium=2/high=3)
 *  - Letzte Statusberichte (1 Eintrag pro Projekt)
 *
 * RBAC: Filter passiert *vor* Aggregation — wir laden nur Projekte, auf die der
 * User mind. Viewer-Rolle hat. Konsequenz: zwei User sehen unterschiedliche
 * Aggregate. Das ist gewollt (Sonst würden private Projekte in Health-Counts
 * leaken).
 */

import { listProjekteByPortfolio } from './projekt-service';
import { getProjekt } from './projekt-service';
import { getPortfolio } from './portfolio-service';
import { getEffectiveAuftragRole } from './permissions';
import { getProjektauftrag } from './storage';
import { listStatusberichte } from './statusbericht-service';
import type {
  Portfolio,
  PortfolioDashboardResponse,
  PortfolioDashboardHealth,
  PortfolioDashboardPhaseMix,
  PortfolioDashboardBudget,
  PortfolioDashboardTermine,
  PortfolioDashboardTopRisk,
  PortfolioDashboardSbEntry,
  Statusbericht,
  Projektauftrag,
  RiskTrackingItem,
} from './types';

// Mapping fuer Score-Berechnung (appConfig.probability/impact-Werte sind
// string-Keys; hier in numerische Gewichte uebersetzt). Halten wir hier
// konstant — falls die App-Config mehrstufige Werte einfuehrt, kann der
// Score-Mapper hier zentral angepasst werden.
const SCORE_MAP: Record<string, number> = {
  low: 1, niedrig: 1,
  medium: 2, mittel: 2,
  high: 3, hoch: 3,
};

function scoreForRisk(r: RiskTrackingItem): number {
  const w = SCORE_MAP[(r.wahrscheinlichkeit || '').toLowerCase()] ?? 0;
  const a = SCORE_MAP[(r.auswirkung_bewertung || '').toLowerCase()] ?? 0;
  return w * a;
}

function pickLatestSb(berichte: Statusbericht[]): Statusbericht | null {
  if (berichte.length === 0) return null;
  // Bevorzuge finalen Bericht; sonst neuesten draft (nach nummer desc).
  const final = berichte.find((b) => b.status === 'final');
  if (final) return final;
  const sorted = [...berichte].sort((a, b) => (b.nummer || 0) - (a.nummer || 0));
  return sorted[0] ?? null;
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

interface ProjektContext {
  projektId: string;
  projektName: string;
  auftrag: Projektauftrag | null;
  latestSb: Statusbericht | null;
}

async function loadProjektContext(projektId: string, projektName: string): Promise<ProjektContext> {
  const [auftrag, berichte] = await Promise.all([
    getProjektauftrag(projektId).catch(() => null),
    listStatusberichte(projektId).catch(() => [] as Statusbericht[]),
  ]);
  return {
    projektId,
    projektName,
    auftrag: auftrag as Projektauftrag | null,
    latestSb: pickLatestSb(berichte),
  };
}

function buildHealth(contexts: ProjektContext[]): PortfolioDashboardHealth {
  const h: PortfolioDashboardHealth = { gruen: 0, gelb: 0, rot: 0, unbekannt: 0 };
  for (const ctx of contexts) {
    const ampel = ctx.latestSb?.ampel;
    if (ampel === 'gruen') h.gruen += 1;
    else if (ampel === 'gelb') h.gelb += 1;
    else if (ampel === 'rot') h.rot += 1;
    else h.unbekannt += 1;
  }
  return h;
}

function buildPhaseMix(contexts: ProjektContext[]): PortfolioDashboardPhaseMix {
  const mix: PortfolioDashboardPhaseMix = {
    initiation: 0, planning: 0, execution: 0, closing: 0, stopped: 0, unbekannt: 0,
  };
  for (const ctx of contexts) {
    const status = (ctx.auftrag as Projektauftrag & { project_status?: string } | null)?.project_status;
    if (status === 'initiation') mix.initiation += 1;
    else if (status === 'planning') mix.planning += 1;
    else if (status === 'execution') mix.execution += 1;
    else if (status === 'closing') mix.closing += 1;
    else if (status === 'stopped') mix.stopped += 1;
    else mix.unbekannt += 1;
  }
  return mix;
}

function buildBudget(contexts: ProjektContext[]): PortfolioDashboardBudget {
  let plan = 0;
  let ist = 0;
  for (const ctx of contexts) {
    const sb = ctx.latestSb;
    if (!sb) continue;
    plan += Number(sb.cost_budget) || 0;
    const sbIst = (sb.cost_months || []).reduce((s, m) => s + (Number(m.ist) || 0), 0);
    ist += sbIst;
  }
  const abweichung_pct = plan > 0 ? ((ist - plan) / plan) * 100 : null;
  return { plan_total: plan, ist_total: ist, abweichung_pct };
}

function buildTermine(contexts: ProjektContext[]): PortfolioDashboardTermine {
  const t: PortfolioDashboardTermine = { on_track: 0, gefaehrdet: 0, verspaetet: 0, unbekannt: 0 };
  const today = Date.now();
  for (const ctx of contexts) {
    const auftrag = ctx.auftrag as (Projektauftrag & { end_date?: string }) | null;
    const planEnd = auftrag?.end_date ? new Date(auftrag.end_date).getTime() : null;
    if (!planEnd || isNaN(planEnd)) {
      t.unbekannt += 1;
      continue;
    }
    // Ist-Ende aus letztem SB: max ist_datum aus tasks_tracking.
    const sb = ctx.latestSb;
    const istEnds = (sb?.tasks_tracking || [])
      .map((tr) => tr.ist_datum)
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime())
      .filter((n) => !isNaN(n));
    const istEnd = istEnds.length > 0 ? Math.max(...istEnds) : today;
    const diffDays = Math.round((istEnd - planEnd) / 86400000);
    if (diffDays <= 0) t.on_track += 1;
    else if (diffDays <= 30) t.gefaehrdet += 1;
    else t.verspaetet += 1;
  }
  return t;
}

function buildTopRisks(contexts: ProjektContext[], limit: number): PortfolioDashboardTopRisk[] {
  const all: PortfolioDashboardTopRisk[] = [];
  for (const ctx of contexts) {
    const tracking = ctx.latestSb?.risk_tracking || [];
    for (const r of tracking) {
      // Vermiedene Risiken sind aus PMO-Sicht erledigt — nicht in der Top-Liste.
      if ((r.status || '').toLowerCase() === 'vermieden') continue;
      const score = scoreForRisk(r);
      if (score <= 0) continue;
      all.push({
        projekt_id: ctx.projektId,
        projekt_name: ctx.projektName,
        risk_text: truncate(r.beschreibung || r.auswirkung || '', 200) || '',
        wahrscheinlichkeit: r.wahrscheinlichkeit || '',
        auswirkung: r.auswirkung_bewertung || '',
        score,
        ampel: r.ampel as PortfolioDashboardTopRisk['ampel'],
        status: r.status,
      });
    }
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, limit);
}

function buildLatestSbs(contexts: ProjektContext[]): PortfolioDashboardSbEntry[] {
  const out: PortfolioDashboardSbEntry[] = [];
  for (const ctx of contexts) {
    const sb = ctx.latestSb;
    out.push({
      projekt_id: ctx.projektId,
      projekt_name: ctx.projektName,
      sb_id: sb?.id,
      sb_nummer: sb?.nummer,
      datum: sb?.datum,
      ampel: sb?.ampel,
      management_summary: truncate(sb?.management_summary, 200),
      status: sb?.status,
    });
  }
  // Projekte ohne SB nach hinten.
  out.sort((a, b) => {
    if (!a.datum && !b.datum) return a.projekt_name.localeCompare(b.projekt_name);
    if (!a.datum) return 1;
    if (!b.datum) return -1;
    return new Date(b.datum).getTime() - new Date(a.datum).getTime();
  });
  return out;
}

/**
 * Eigentliche Aggregator-Funktion. Returnt `null` wenn Portfolio nicht existiert.
 * RBAC ist die Verantwortung des Aufrufers (Route checkt mit `denyIfBelow‐
 * PortfolioRole(userId, 'viewer')`), aber wir filtern hier zusaetzlich auf
 * Projekte, auf die der User mind. Auftrags-Viewer-Rolle hat.
 */
export async function getPortfolioDashboard(
  portfolioId: string,
  userId: string,
): Promise<PortfolioDashboardResponse | null> {
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio) return null;

  const allProjekte = await listProjekteByPortfolio(portfolioId);

  // RBAC-Filter: nur Projekte, auf die der User Auftrags-Viewer-Rolle hat.
  // Auftrags-Permissions koennen vom Projekt abweichen (z.B. Sub-Team), daher
  // pro Projekt einzeln pruefen. Parallel via Promise.all.
  const accessibleEntries = await Promise.all(
    allProjekte.map(async (p) => {
      const role = await getEffectiveAuftragRole(userId, p.id);
      return role ? p : null;
    }),
  );
  const accessible = accessibleEntries.filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  // Pro Projekt: Auftrag + letzter SB laden. Parallel.
  const contexts = await Promise.all(
    accessible.map((p) => loadProjektContext(p.id, p.name)),
  );

  // Aktiv = project_status in {initiation, planning, execution}.
  // Abgeschlossen = project_status in {closing, stopped} ODER Abschlussbericht
  //   final. Phase-D3 vereinfacht: nur project_status — Abschlussbericht-Check
  //   waere ein extra Load.
  const projekte_aktiv = contexts.filter((ctx) => {
    const s = (ctx.auftrag as Projektauftrag & { project_status?: string } | null)?.project_status;
    return s === 'initiation' || s === 'planning' || s === 'execution';
  }).length;
  const projekte_abgeschlossen = contexts.filter((ctx) => {
    const s = (ctx.auftrag as Projektauftrag & { project_status?: string } | null)?.project_status;
    return s === 'closing' || s === 'stopped';
  }).length;

  return {
    portfolio: portfolio as Portfolio,
    projekte_total: contexts.length,
    projekte_aktiv,
    projekte_abgeschlossen,
    health: buildHealth(contexts),
    phase_mix: buildPhaseMix(contexts),
    budget: buildBudget(contexts),
    termine: buildTermine(contexts),
    top_risiken: buildTopRisks(contexts, 5),
    letzte_statusberichte: buildLatestSbs(contexts),
  };
}

// Suppress unused import warnings — these are re-exports in case future modules
// want to read individual aggregations.
void getProjekt;
