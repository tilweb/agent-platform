/**
 * GOV-4 — Admin/DSB-Protokollansicht (Owner-Gate) — Adapter auf den Antrag-Kern.
 *
 * Reine Lese-/Revisionssicht auf das app-weite Audit-Log inkl. Lesezugriffen
 * (`vorgang.geoeffnet`) und Exporten. NUR für App-Owner (DSB/Revision), nicht
 * für Bearbeiter. Der CSV-Export selbst wird auditiert (`protokoll.exportiert`).
 */
import { createAuditRoutes } from '../../_antrag-kern/audit';
import { listAuditEintraegeGesamt, countAuditEintraegeGesamt } from '../storage';
import { audit } from '../audit';
import { denyIfNotAppOwner } from './_shared';

export const auditRoutes = createAuditRoutes({
  store: { listAuditEintraegeGesamt, countAuditEintraegeGesamt },
  audit,
  denyIfNotAppOwner,
});
