/**
 * GOV-4 — Admin/DSB-Protokollansicht (Owner-Gate).
 *
 * Reine Lese-/Revisionssicht auf das app-weite Audit-Log inkl. Lesezugriffen
 * (`vorgang.geoeffnet`) und Exporten. NUR für App-Owner (DSB/Revision), nicht
 * für Bearbeiter. Der CSV-Export selbst wird auditiert (`protokoll.exportiert`).
 */
import { Hono, type Context } from 'hono';
import { listAuditEintraegeGesamt, countAuditEintraegeGesamt, type AuditGesamtFilter } from '../storage';
import { audit, auditEintraegeToCsv } from '../audit';
import { denyIfNotAppOwner } from './_shared';

export const auditRoutes = new Hono();

/** Query → Filter (leere Strings ignorieren). */
function filterFromQuery(c: Context): AuditGesamtFilter {
  const q = (name: string) => {
    const v = c.req.query(name);
    return v && v.trim() ? v.trim() : undefined;
  };
  const limitRaw = q('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return {
    aktion: q('aktion'),
    akteurId: q('akteurId'),
    objektTyp: q('objektTyp'),
    vorgangId: q('vorgangId'),
    von: q('von'),
    bis: q('bis'),
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

auditRoutes.get('/audit', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  const filter = filterFromQuery(c);
  const [eintraege, gesamt] = await Promise.all([
    listAuditEintraegeGesamt(filter),
    countAuditEintraegeGesamt(filter),
  ]);
  return c.json({ eintraege, gesamt });
});

auditRoutes.get('/audit/export', async (c) => {
  const denied = denyIfNotAppOwner(c);
  if (denied) return c.json(denied, 403);
  const format = (c.req.query('format') ?? 'csv').toLowerCase();
  if (format !== 'csv') return c.json({ error: 'format muss csv sein' }, 400);
  const filter = filterFromQuery(c);
  // Export = größerer Standardumfang, aber weiterhin gedeckelt in der Storage-Funktion.
  const eintraege = await listAuditEintraegeGesamt({ ...filter, limit: filter.limit ?? 5000 });
  const csv = auditEintraegeToCsv(eintraege);
  // Der Export selbst ist eine Weitergabe → auditieren.
  await audit(c, { aktion: 'protokoll.exportiert', objektTyp: 'protokoll', detail: `${eintraege.length} Eintrag/Einträge · CSV` });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Protokoll-${stamp}.csv"`,
    },
  });
});
