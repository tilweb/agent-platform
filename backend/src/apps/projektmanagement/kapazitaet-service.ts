/**
 * Kapazitaet-Service — aggregiert die Auslastung einer Kapazitaetsperson ueber
 * ALLE verknuepften Projektauftraege (Person via TeamMember.person_id verlinkt).
 *
 * Je Monat: Kapazitaet (17 × WAZ%/100) − Linie − Projektbedarf. Bedarf getrennt
 * nach `Projektauftrag.status`: != 'draft' = genehmigt/laufend, == 'draft' = Entwurf.
 * RBAC: nur Auftraege, auf die der User mind. Viewer-Rolle hat (sonst wuerden
 * fremde Belegungen in die Summen leaken). Storage-agnostisch — API der Storage-
 * Module ist in beiden Worktrees signaturgleich, daher byte-identisch.
 */

import type {
  PersonAuslastung,
  PersonAuslastungMonat,
  PersonAuslastungProjekt,
  Projektauftrag,
  TeamMember,
  KapazitaetOverviewResponse,
  PortfolioCapacityRow,
  PortfolioCapacityCell,
} from './types';
import { KAPAZITAET_MAX_PT_MONAT } from './types';
import { getPerson, listPersonen } from './kapazitaet-storage';
import { getProjektauftraege } from './storage';
import { getEffectiveAuftragRole } from './permissions';

/** Monatsschluessel "YYYY-MM" von `from` bis `to` (inklusive). */
function monthKeys(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map((s) => parseInt(s, 10));
  const [ty, tm] = to.split('-').map((s) => parseInt(s, 10));
  const out: string[] = [];
  if (!fy || !fm || !ty || !tm) return out;
  let y = fy;
  let m = fm;
  for (let i = 0; i < 240 && (y < ty || (y === ty && m <= tm)); i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Bedarf (PT) eines Teammitglieds fuer einen Monat: Monatswert schlaegt Ø. */
function bedarfOfMonth(member: TeamMember, month: string): number {
  const b = member.projekt_bedarf;
  if (!b) return 0;
  const mv = b.monate?.[month];
  if (mv !== undefined && mv !== null) return Number(mv) || 0;
  return Number(b.avg) || 0;
}

export async function getPersonAuslastung(
  personId: string,
  userId: string,
  opts: { from?: string; to?: string; excludeAuftragId?: string } = {},
): Promise<PersonAuslastung | null> {
  const person = await getPerson(personId);
  if (!person) return null;

  const nowYear = new Date().getFullYear();
  const from = opts.from || `${nowYear}-01`;
  const to = opts.to || `${nowYear}-12`;
  const months = monthKeys(from, to);

  // Alle Auftraege laden, RBAC-gefiltert, mit dieser Person verknuepft (ausser dem
  // ggf. aktuell bearbeiteten Auftrag).
  const alle = await getProjektauftraege();
  const relevant: Array<{ auftrag: Projektauftrag; member: TeamMember }> = [];
  await Promise.all(alle.map(async (a) => {
    if (opts.excludeAuftragId && a.id === opts.excludeAuftragId) return;
    const member = (a.organization || []).find((m) => m.person_id === personId);
    if (!member) return;
    const role = await getEffectiveAuftragRole(userId, a.id);
    if (!role) return;
    relevant.push({ auftrag: a, member });
  }));

  const kapMonat = KAPAZITAET_MAX_PT_MONAT * (Number(person.wochenarbeitszeit_pct) || 0) / 100;

  const monate: PersonAuslastungMonat[] = months.map((month) => {
    const linie = person.linie_monate?.[month] !== undefined
      ? Number(person.linie_monate[month]) || 0
      : Number(person.linie_avg_pt) || 0;
    let bedarf_genehmigt = 0;
    let bedarf_entwurf = 0;
    for (const { auftrag, member } of relevant) {
      const b = bedarfOfMonth(member, month);
      if (b <= 0) continue;
      if (auftrag.status === 'draft') bedarf_entwurf += b;
      else bedarf_genehmigt += b;
    }
    return {
      month,
      kapazitaet: kapMonat,
      linie,
      bedarf_genehmigt,
      bedarf_entwurf,
      frei_genehmigt: kapMonat - linie - bedarf_genehmigt,
    };
  });

  const projekte: PersonAuslastungProjekt[] = relevant.map(({ auftrag, member }) => {
    const m: Record<string, number> = {};
    for (const month of months) {
      const b = bedarfOfMonth(member, month);
      if (b > 0) m[month] = b;
    }
    return { auftrag_id: auftrag.id, name: auftrag.name, status: auftrag.status || 'draft', monate: m };
  });

  return {
    person_id: personId,
    name: person.name,
    wochenarbeitszeit_pct: person.wochenarbeitszeit_pct,
    monate,
    projekte,
  };
}

// ============== Gesamtübersicht (Ressourcen-/Engpassansicht) ==============

/** "YYYY-MM" aus einem Datum (oder null). */
function overviewToMonthKey(d?: string): string | null {
  if (!d) return null;
  const s = String(d);
  return s.length >= 7 ? s.slice(0, 7) : null;
}

/**
 * Auslastungs-Übersicht ÜBER ALLE zentralen Personen für den Kapazitätsplanung-Tab.
 * Effizient: lädt die Aufträge EINMAL (nicht je Person wie getPersonAuslastung) und
 * verteilt den Bedarf per `person_id`. Personen ohne Projektlink erscheinen ebenfalls
 * (Linie-only). Je Zelle Kapazität/Linie/Bedarf (genehmigt vs Entwurf/Anfragen).
 * RBAC: nur Aufträge, auf die der User mind. Viewer-Rolle hat.
 */
export async function getKapazitaetOverview(
  userId: string,
  opts: { from?: string; to?: string } = {},
): Promise<KapazitaetOverviewResponse> {
  const persons = await listPersonen();

  // Aufträge einmal laden + RBAC-filtern; Bedarf je person_id sammeln.
  const alle = await getProjektauftraege();
  const accessible: Projektauftrag[] = [];
  await Promise.all(alle.map(async (a) => {
    const role = await getEffectiveAuftragRole(userId, a.id);
    if (role) accessible.push(a);
  }));

  const linksByPerson = new Map<string, Array<{ member: TeamMember; status: string }>>();
  let minMonth: string | null = null;
  let maxMonth: string | null = null;
  for (const a of accessible) {
    const auftrag = a as Projektauftrag & { start_date?: string; end_date?: string };
    const members = (auftrag.organization || []).filter((m) => m.person_id);
    if (members.length === 0) continue;
    const status = auftrag.status || 'draft';
    const sd = overviewToMonthKey(auftrag.start_date);
    const ed = overviewToMonthKey(auftrag.end_date);
    if (sd && (!minMonth || sd < minMonth)) minMonth = sd;
    if (ed && (!maxMonth || ed > maxMonth)) maxMonth = ed;
    for (const m of members) {
      const arr = linksByPerson.get(m.person_id!) || [];
      arr.push({ member: m, status });
      linksByPerson.set(m.person_id!, arr);
    }
  }

  const nowYear = new Date().getFullYear();
  const from = opts.from || minMonth || `${nowYear}-01`;
  const to = opts.to || maxMonth || `${nowYear}-12`;
  const months = monthKeys(from, to);

  const personen: PortfolioCapacityRow[] = persons.map((person) => {
    const links = linksByPerson.get(person.id) || [];
    const kapMonat = KAPAZITAET_MAX_PT_MONAT * (Number(person.wochenarbeitszeit_pct) || 0) / 100;
    const monate: PortfolioCapacityCell[] = months.map((month) => {
      const linie = person.linie_monate?.[month] !== undefined
        ? Number(person.linie_monate[month]) || 0
        : Number(person.linie_avg_pt) || 0;
      let bedarf_genehmigt = 0;
      let bedarf_entwurf = 0;
      for (const { member, status } of links) {
        const b = bedarfOfMonth(member, month);
        if (b <= 0) continue;
        if (status === 'draft') bedarf_entwurf += b;
        else bedarf_genehmigt += b;
      }
      return { month, kapazitaet: kapMonat, linie, bedarf_genehmigt, bedarf_entwurf };
    });
    return { id: person.id, name: person.name, role: person.role || null, monate };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return { months, personen };
}
