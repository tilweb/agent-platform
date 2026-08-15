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
} from './types';
import { KAPAZITAET_MAX_PT_MONAT } from './types';
import { getPerson } from './kapazitaet-storage';
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
